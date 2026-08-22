// Scheduled (not trigger-driven) — invoked hourly at minute :20 by pg_cron
// (0064_schedule_new_player_alerts.sql), hitting this URL with
// `Authorization: Bearer <INTERNAL_TRIGGER_AUTH_TOKEN>`, the same mechanism
// send-reengagement-nudges and sync-verified-stats use.
//
// WHAT IT IS FOR. DuoQueue launches at a density where an install lands in an empty deck, and
// an empty deck is churn. This sweep turns every completed signup into a reason for whoever
// was already here — and plays the same game — to open the app again, so acquisition
// compounds into retention instead of leaking out of it.
//
// WHERE THE RULES LIVE: NOT HERE. Every eligibility rule and all four rate limits are in
// public.get_new_player_alert_batch (0063_new_player_alerts.sql), deliberately, because a
// firehose bug is a mass-notification incident and cannot be recalled. This file cannot widen
// any of them; the worst a bug in here can do is send fewer notifications than it should. In
// one paragraph, what the SQL guarantees before a row ever reaches this loop:
//
//   * The new player finished onboarding in the last 48 hours, and neither side is a demo
//     profile, banned, suspended, deactivated or incomplete.
//   * They share at least one game_id with the recipient, and the row names the recipient's
//     highest-priority shared game.
//   * The new player passes BOTH deck gates for that recipient — they would genuinely appear
//     in that deck. A push that leads to an empty deck is the failure this exists to remove.
//   * The recipient has the new_player toggle on, has at least one push token, has not been
//     sent a new-player alert in 24 hours, has never been told about this exact new player,
//     and their LOCAL clock reads between 10:00 and 21:00.
//   * At most 200 recipients per run; the rest are picked up next hour.
//
// The kill switch, worth knowing before you need it:
//   select cron.unschedule('new-player-alerts-hourly');
import { createClient } from "npm:@supabase/supabase-js@2";

import { sendExpoPush } from "../_shared/expo-push.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";
import { type AlertBatchRow, buildNewPlayerAlertCopy, sendDecision } from "../_shared/new-player-alert.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TRIGGER_AUTH_TOKEN = requireSecret("INTERNAL_TRIGGER_AUTH_TOKEN");

const MAX_RECIPIENTS_PER_RUN = 200;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  // Each run fans out a push per recipient, so a GET from a crawler or a scheduler
  // double-fire shouldn't be able to kick it off.
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const unauthorized = await checkBearerAuth(req, INTERNAL_TRIGGER_AUTH_TOKEN);
  if (unauthorized) return unauthorized;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: batch, error } = await supabase.rpc("get_new_player_alert_batch", {
    p_max_recipients: MAX_RECIPIENTS_PER_RUN,
  });
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const rows = (batch ?? []) as AlertBatchRow[];
  let notified = 0;

  for (const row of rows) {
    // CLAIM FIRST, SEND SECOND. sendExpoPush returns void and swallows transport errors, so
    // there is no "did it arrive" to branch on; the only ordering that cannot produce a
    // duplicate is writing the ledger before the send. `ignoreDuplicates` makes the insert
    // `on conflict do nothing`, and `.select()` brings back only the rows this run actually
    // claimed — see sendDecision() for why that distinction is load-bearing.
    const { data: claimed, error: ledgerError } = await supabase
      .from("new_player_alerts")
      .upsert(
        row.new_profile_ids.map((newProfileId) => ({
          recipient_id: row.recipient_id,
          new_profile_id: newProfileId,
        })),
        { onConflict: "recipient_id,new_profile_id", ignoreDuplicates: true },
      )
      .select("new_profile_id");

    const decision = sendDecision({
      ledgerError: ledgerError != null,
      claimedCount: Array.isArray(claimed) ? claimed.length : null,
    });

    if (decision !== "send") {
      // Not an error worth a 500: the next hourly run picks up anything a failed ledger write
      // left behind, and a row claimed by a concurrent run has already been sent by that run.
      console.warn(`Skipping recipient ${row.recipient_id}: ${decision}`, ledgerError?.message ?? "");
      continue;
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("profile_id", row.recipient_id);

    const tokenList = (tokens ?? []).map((t) => t.expo_push_token as string);
    if (tokenList.length === 0) {
      // The batch query requires a push_tokens row, so this is only reachable if the token was
      // deleted between the RPC and here. Counting it as notified would make the two numbers in
      // the response identical by construction and useless for telling that apart.
      console.warn(`Recipient ${row.recipient_id} has no push token at send time.`);
      continue;
    }

    const { title, body } = buildNewPlayerAlertCopy(row.new_player_count, row.headline_game);
    await sendExpoPush(tokenList, title, body, { category: "new_player" });
    notified++;
  }

  return jsonResponse({ recipients: rows.length, notified }, 200);
});
