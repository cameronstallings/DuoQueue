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
//     sent a person-push in 24 hours (a new-player alert or, since 0072, a like alert: one shared
//     budget, read again under a lock at claim time), has never been told about this exact new player,
//     and their LOCAL clock reads between 10:00 and 21:00.
//   * At most 200 recipients per run; the rest are picked up next hour.
//
// The kill switch, worth knowing before you need it:
//   select cron.unschedule('new-player-alerts-hourly');
import { createClient } from "npm:@supabase/supabase-js@2";

import { pushToProfile } from "../_shared/push-delivery.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";
import { type AlertBatchRow, buildNewPlayerAlertCopy, sendDecision } from "../_shared/new-player-alert.ts";
import { supabaseSecretKey } from "../_shared/supabase-keys.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY = supabaseSecretKey();
const INTERNAL_TRIGGER_AUTH_TOKEN = requireSecret("INTERNAL_TRIGGER_AUTH_TOKEN");

const MAX_RECIPIENTS_PER_RUN = 200;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type ServiceClient = ReturnType<typeof createClient>;

/**
 * The ledger claim for one recipient: the rows this call claimed, or an error.
 *
 * claim_new_player_alert (0072) when it exists. If this function is deployed before 0072 is
 * applied, PostgREST answers PGRST202 (no such function) and the claim falls back to the direct
 * upsert this function always used. That fallback has no budget race to lose: like alerts do
 * not exist until 0072 and 0083 are applied.
 */
async function claimNewPlayerAlert(
  supabase: ServiceClient,
  recipientId: string,
  newProfileIds: string[],
): Promise<{ data: unknown[] | null; error: { message: string } | null }> {
  const rpc = await supabase.rpc("claim_new_player_alert", {
    p_recipient: recipientId,
    p_new_profile_ids: newProfileIds,
  });
  if (rpc.error?.code !== "PGRST202") {
    return { data: (rpc.data as unknown[] | null) ?? null, error: rpc.error };
  }

  const upsert = await supabase
    .from("new_player_alerts")
    .upsert(
      newProfileIds.map((newProfileId) => ({
        recipient_id: recipientId,
        new_profile_id: newProfileId,
      })),
      { onConflict: "recipient_id,new_profile_id", ignoreDuplicates: true },
    )
    .select("new_profile_id");
  return { data: (upsert.data as unknown[] | null) ?? null, error: upsert.error };
}

Deno.serve(async (req) => {
  // Each run fans out a push per recipient, so a GET from a crawler or a scheduler
  // double-fire shouldn't be able to kick it off.
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const unauthorized = await checkBearerAuth(req, INTERNAL_TRIGGER_AUTH_TOKEN);
  if (unauthorized) return unauthorized;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  const { data: batch, error } = await supabase.rpc("get_new_player_alert_batch", {
    p_max_recipients: MAX_RECIPIENTS_PER_RUN,
  });
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const rows = (batch ?? []) as AlertBatchRow[];
  let notified = 0;

  for (const row of rows) {
    // CLAIM FIRST, SEND SECOND. sendExpoPush reports Expo's tickets (since 0080), but a ticket
    // is not delivery, so there is still no "did it arrive" to branch on; the only ordering that cannot produce a
    // duplicate is writing the ledger before the send. The claim is `on conflict do nothing`
    // and brings back only the rows this run actually claimed — see sendDecision() for why that
    // distinction is load-bearing.
    //
    // Since 0072 the claim is the claim_new_player_alert RPC, not a direct upsert: the batch read
    // the shared one-person-push-a-day budget once, at the top of this run, and a like alert
    // (0072/0083) can spend it for this recipient while the loop is still working through the
    // rows ahead. The RPC takes the same per-recipient lock dispatch_like_alert takes, reads the
    // budget again under it and claims nothing if it is spent, so the two kinds of person-push
    // cannot both go out inside one day. Nothing claimed resolves to a skip, as before.
    const { data: claimed, error: ledgerError } = await claimNewPlayerAlert(
      supabase,
      row.recipient_id,
      row.new_profile_ids,
    );

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

    // Every attempt is recorded in push_log (0080) as event "new_player_alert", including the
    // no-token case, which sendExpoPush answers as "no_token" without a request.
    const { title, body } = buildNewPlayerAlertCopy(row.new_player_count, row.headline_game);
    const outcome = await pushToProfile(supabase, {
      recipientId: row.recipient_id,
      event: "new_player_alert",
      category: "new_player",
      tokens: tokenList,
      title,
      body,
    });
    if (outcome.tokens === 0) {
      // The batch query requires a push_tokens row, so this is only reachable if the token was
      // deleted between the RPC and here. Counting it as notified would make the two numbers in
      // the response identical by construction and useless for telling that apart.
      console.warn(`Recipient ${row.recipient_id} has no push token at send time.`);
      continue;
    }
    notified++;
  }

  return jsonResponse({ recipients: rows.length, notified }, 200);
});
