// The two decisions inside `send-new-player-alerts` that can be wrong in a way a user would
// see, pulled out of the handler so they can be tested without Deno, without a service-role
// key and without sending anybody a push.
//
// Same shape apps/mobile/src/features/swipe/deckQueue.ts established for the deck: everything
// here is pure, and what is left in index.ts after this is wiring — auth, one RPC, a loop, an
// insert and a fetch. Nothing here imports Deno or npm, which is what lets apps/mobile's
// vitest run the tests next to this file (see apps/mobile/vitest.config.ts).

/** One row of `get_new_player_alert_batch`, as it arrives over PostgREST. */
export interface AlertBatchRow {
  recipient_id: string;
  new_profile_ids: string[];
  new_player_count: number;
  headline_game: string | null;
}

export interface AlertCopy {
  title: string;
  body: string;
}

/**
 * What the push says.
 *
 * THE CONSTRAINTS, because they are not obvious from the strings:
 *
 *  - DuoQueue is an 18+ PLATONIC gaming app that was rejected once under App Store guideline
 *    2.3.6. Nothing here may read as dating, and "player", "deck" and "duo" are the app's own
 *    vocabulary for a reason. There is a test asserting the copy never matches
 *    /date|dating|singles|nearby|hookup/i, for the same reason the empty-deck copy has one:
 *    this is a string App Review can be shown without opening the app.
 *  - Every clause has to be true of EVERY recipient it goes to. "they are in your deck now" is
 *    only sayable because the batch query runs both deck gates per pair (D3) — the new player
 *    really is visible to this recipient. "They play games from your list" is only sayable
 *    because overlap is required (D2).
 *  - No display name and no profile id, here or in the payload. The deck is where identity
 *    belongs; the push is an invitation to open it.
 *
 * `headlineGame` is non-null by construction — the batch only produces a pair when a shared
 * game exists, and it names that game — but it is typed nullable because it arrives over the
 * wire, and "Someone new plays null" is exactly the sort of thing that ships. The fallback
 * copy is still true, it just leads with less.
 */
export function buildNewPlayerAlertCopy(count: number, headlineGame: string | null): AlertCopy {
  const game = headlineGame?.trim() ? headlineGame.trim() : null;

  if (count === 1) {
    return {
      title: game ? `Someone new plays ${game}` : "Someone new just joined",
      body: "A new player just joined DuoQueue and they are in your deck now.",
    };
  }

  return {
    title: `${count} new players joined`,
    body: game
      ? `They play games from your list, ${game} among them. Open your deck to see who.`
      : "They play games from your list. Open your deck to see who.",
  };
}

/**
 * Whether to actually send, given what happened when we tried to claim the ledger rows.
 *
 * THE LEDGER IS WRITTEN BEFORE THE PUSH, ON PURPOSE. `sendExpoPush` never throws, and the
 * Expo ticket it reports (push_log, 0080) says "accepted", not "arrived", so this function can
 * never know whether a send succeeded. Recording first
 * means a crash between the two produces a MISSED notification rather than a duplicate one,
 * and it means the 24 hour cooldown is honoured even while Expo is down. A missed new-player
 * ping is superseded by the next new player; a duplicate is a bug the user can see.
 *
 * The insert is `on conflict do nothing ... returning`, so the rows that come back are the
 * rows THIS run actually claimed. That turns the ledger's primary key from a dedupe that
 * works across sequential re-runs into one that also holds if two runs ever overlap: the
 * loser claims nothing and therefore sends nothing. Sequential re-runs are already blocked
 * upstream — the batch query excludes pairs that are in the ledger and recipients inside the
 * 24 hour cooldown — but "a scheduler double-fire cannot mass-notify" is the assertion this
 * whole workstream is judged on, and it should not depend on the two runs being politely
 * spaced.
 *
 * Since 0072 the claim is the claim_new_player_alert RPC, which also claims nothing when the
 * recipient's shared one-person-push-a-day budget was spent after the batch was read (a like
 * alert got there first). That zero is handled exactly like a lost race: skip.
 *
 * `claimedCount === null` means the insert came back without a representation to count, which
 * is an absence of an answer rather than a "somebody else has it". That resolves to sending:
 * the pair is in the ledger either way, so the failure mode is at worst one duplicate in a
 * situation that also requires a concurrent run, against a certain silent miss on every run
 * if it resolved the other way.
 */
export type SendDecision = "send" | "skip-ledger-write-failed" | "skip-claimed-by-another-run";

export function sendDecision(input: { ledgerError: boolean; claimedCount: number | null }): SendDecision {
  if (input.ledgerError) return "skip-ledger-write-failed";
  if (input.claimedCount === 0) return "skip-claimed-by-another-run";
  return "send";
}
