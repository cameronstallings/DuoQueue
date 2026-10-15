// Scheduled (not trigger-driven) — invoke this every 30 minutes via a Supabase Cron
// Trigger or any external scheduler (same mechanism as daily-swipes-refreshed), hitting
// this URL with `Authorization: Bearer <INTERNAL_TRIGGER_AUTH_TOKEN>`. Each run asks
// Postgres which matches are sitting on a message that's been unread for at least an
// hour and haven't already been nudged for that exact message
// (get_stale_unread_conversations, which also excludes anyone who opted out via
// notification_settings.nudge_unread), sends one "Your duo is waiting" push per match,
// and records match_nudges — so a re-run within the same window, or a scheduler that
// skips a beat, never double-nudges the same stale conversation.
//
// Since 0075 the RPC also keeps the nudge to 10:00-21:00 in the recipient's local time and
// skips blocked pairs, locked chats and demo accounts; its columns are unchanged, so nothing
// here had to change for that. The first-message nudge (a match nobody has written in yet) is
// NOT sent from here: it is a pure-SQL sweep (send_first_message_nudges, 0075, scheduled by
// 0083) that goes out through send-push-notification's first_message_nudge event.
//
// Each push is recorded in push_log (0080) as event "nudge_unread" (pushToProfile).
import { createClient } from "npm:@supabase/supabase-js@2";

import { pushToProfile } from "../_shared/push-delivery.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";
import { supabaseSecretKey } from "../_shared/supabase-keys.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY = supabaseSecretKey();
const INTERNAL_TRIGGER_AUTH_TOKEN = requireSecret("INTERNAL_TRIGGER_AUTH_TOKEN");

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  // Each run fans out a query-plus-push per candidate, so a GET from a crawler or a
  // scheduler double-fire shouldn't be able to kick it off.
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const unauthorized = await checkBearerAuth(req, INTERNAL_TRIGGER_AUTH_TOKEN);
  if (unauthorized) return unauthorized;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  const { data: candidates, error } = await supabase.rpc("get_stale_unread_conversations");
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  let notified = 0;

  for (const candidate of candidates ?? []) {
    const matchId = candidate.match_id as string;
    const recipientId = candidate.recipient_id as string;
    const senderId = candidate.sender_id as string;
    const messageId = candidate.message_id as string;

    const [{ data: sender }, { data: tokens }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", senderId).single(),
      supabase.from("push_tokens").select("expo_push_token").eq("profile_id", recipientId),
    ]);

    const tokenList = (tokens ?? []).map((t) => t.expo_push_token as string);
    // `matchId` lets a tap open this conversation instead of resuming wherever the app was left
    // (apps/mobile/src/lib/notificationRouting.ts). Additive, like send-push-notification's: a
    // build that predates it reads only `category`. `category` stays last so nothing replaces it.
    await pushToProfile(supabase, {
      recipientId,
      event: "nudge_unread",
      category: "nudge_unread",
      tokens: tokenList,
      title: "Your duo is waiting",
      body: `${sender?.display_name ?? "Someone"} sent you a message. Say hi back.`,
      extra: { matchId },
    });
    notified++;

    await supabase.from("match_nudges").upsert({
      match_id: matchId,
      unread_nudge_sent_at: new Date().toISOString(),
      unread_nudge_message_id: messageId,
    });
  }

  return jsonResponse({ checked: candidates?.length ?? 0, notified }, 200);
});
