// Scheduled (not trigger-driven) — invoke this every 30 minutes via a Supabase Cron
// Trigger or any external scheduler (same mechanism as daily-swipes-refreshed), hitting
// this URL with `Authorization: Bearer <INTERNAL_TRIGGER_AUTH_TOKEN>`. Each run asks
// Postgres which matches are sitting on a message that's been unread for at least an
// hour and haven't already been nudged for that exact message
// (get_stale_unread_conversations, which also excludes anyone who opted out via
// notification_settings.nudge_unread), sends one "Your duo is waiting" push per match,
// and records match_nudges — so a re-run within the same window, or a scheduler that
// skips a beat, never double-nudges the same stale conversation.
import { createClient } from "npm:@supabase/supabase-js@2";

import { sendExpoPush } from "../_shared/expo-push.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    await sendExpoPush(
      tokenList,
      "Your duo is waiting",
      `${sender?.display_name ?? "Someone"} sent you a message — say hi back.`,
      { category: "nudge_unread" },
    );
    notified++;

    await supabase.from("match_nudges").upsert({
      match_id: matchId,
      unread_nudge_sent_at: new Date().toISOString(),
      unread_nudge_message_id: messageId,
    });
  }

  return jsonResponse({ checked: candidates?.length ?? 0, notified }, 200);
});
