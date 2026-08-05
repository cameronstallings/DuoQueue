// Internal-only: called by Postgres triggers (via pg_net) on new matches, new
// messages, and Super Pings — never by the client directly. Authenticated with a
// shared secret (INTERNAL_TRIGGER_AUTH_TOKEN) rather than a user JWT, since there's
// no end-user session in a database trigger.
import { createClient } from "npm:@supabase/supabase-js@2";

import { sendExpoPush } from "../_shared/expo-push.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";
import { isUuid, readJsonBody } from "../_shared/validation.ts";

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

// This function only ever runs behind checkBearerAuth — its callers are Postgres
// triggers (via pg_net) and other server-side code, never the client directly — but
// "holds the right bearer token" isn't the same guarantee as "sent well-formed IDs",
// and every field below ends up in a query (get_display_name, a push-token lookup) that
// would otherwise surface a malformed value as a raw 500 deep in that lookup instead of
// a clean 400 here.
function isValidEvent(data: unknown): data is NotificationEvent {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  switch (d.type) {
    case "new_match":
      return isUuid(d.matchId) && isUuid(d.userAId) && isUuid(d.userBId);
    case "new_message":
      return isUuid(d.matchId) && isUuid(d.messageId) && isUuid(d.senderId);
    case "super_ping":
      return isUuid(d.senderId) && isUuid(d.receiverId);
    case "looking_now":
      return isUuid(d.matchId) && isUuid(d.togglerId) && isUuid(d.recipientId);
    default:
      return false;
  }
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

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return bodyResult.response;
  if (!isValidEvent(bodyResult.data)) {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }
  const event = bodyResult.data;

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
