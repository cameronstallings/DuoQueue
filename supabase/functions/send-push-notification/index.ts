// Internal-only: called by Postgres triggers (via pg_net) on new matches, new
// messages, and Super Pings — never by the client directly. Authenticated with a
// shared secret (INTERNAL_TRIGGER_AUTH_TOKEN) rather than a user JWT, since there's
// no end-user session in a database trigger.
import { createClient } from "npm:@supabase/supabase-js@2";

import { sendExpoPush } from "../_shared/expo-push.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TRIGGER_AUTH_TOKEN = requireSecret("INTERNAL_TRIGGER_AUTH_TOKEN");

type NotificationCategory =
  | "new_match"
  | "new_message"
  | "super_ping"
  | "daily_swipes_refreshed"
  | "nudge_online";

interface NewMatchEvent {
  type: "new_match";
  matchId: string;
  userAId: string;
  userBId: string;
}
interface NewMessageEvent {
  type: "new_message";
  matchId: string;
  messageId: string;
  senderId: string;
}
interface SuperPingEvent {
  type: "super_ping";
  senderId: string;
  receiverId: string;
}
interface LookingNowEvent {
  type: "looking_now";
  matchId: string;
  togglerId: string;
  recipientId: string;
}
type NotificationEvent = NewMatchEvent | NewMessageEvent | SuperPingEvent | LookingNowEvent;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getDisplayName(profileId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", profileId).single();
  return data?.display_name ?? "Someone";
}

async function notifyProfile(profileId: string, category: NotificationCategory, title: string, body: string) {
  const { data: settings } = await supabase
    .from("notification_settings")
    .select(category)
    .eq("profile_id", profileId)
    .maybeSingle();

  // Default to notifying when no settings row exists yet, rather than silently
  // dropping the notification (settings rows are created by the signup trigger, so
  // a missing row is unexpected, not an intentional opt-out).
  const enabled = settings ? (settings as Record<string, boolean>)[category] !== false : true;
  if (!enabled) return;

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .eq("profile_id", profileId);

  const tokenList = (tokens ?? []).map((t) => t.expo_push_token as string);
  await sendExpoPush(tokenList, title, body, { category });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const unauthorized = await checkBearerAuth(req, INTERNAL_TRIGGER_AUTH_TOKEN);
  if (unauthorized) return unauthorized;

  const event = (await req.json().catch(() => null)) as NotificationEvent | null;
  if (!event?.type) {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  switch (event.type) {
    case "new_match": {
      const [nameA, nameB] = await Promise.all([
        getDisplayName(event.userAId),
        getDisplayName(event.userBId),
      ]);
      await Promise.all([
        notifyProfile(event.userAId, "new_match", "New match!", `You matched with ${nameB}.`),
        notifyProfile(event.userBId, "new_match", "New match!", `You matched with ${nameA}.`),
      ]);
      break;
    }
    case "new_message": {
      const { data: match } = await supabase
        .from("matches")
        .select("user_a_id, user_b_id")
        .eq("id", event.matchId)
        .single();
      if (match) {
        const recipientId = match.user_a_id === event.senderId ? match.user_b_id : match.user_a_id;
        const senderName = await getDisplayName(event.senderId);
        await notifyProfile(recipientId, "new_message", senderName, "Sent you a message");
      }
      break;
    }
    case "super_ping": {
      const senderName = await getDisplayName(event.senderId);
      await notifyProfile(event.receiverId, "super_ping", "Super Ping!", `${senderName} is very interested in you.`);
      break;
    }
    case "looking_now": {
      const togglerName = await getDisplayName(event.togglerId);
      await notifyProfile(
        event.recipientId,
        "nudge_online",
        `${togglerName} is free to duo right now`,
        "Jump in before the window closes.",
      );
      break;
    }
  }

  return jsonResponse({ ok: true }, 200);
});
