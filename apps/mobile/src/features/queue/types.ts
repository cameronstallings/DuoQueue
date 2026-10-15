/**
 * Queue Up's server shapes, mirroring 0085_queue_up.sql exactly (Group S's S2). Types only: the
 * pure modules and tests import these with `import type`, and every hook reads the RPC rows into
 * them without reshaping.
 *
 * 0085 is written but not applied while 1.0.2 is being built, so every RPC here can answer
 * PGRST202 (no such function). The hooks treat that as "not ready" and the screens say so or hide;
 * nothing below is ever assumed to exist.
 */

/** Why a Queue up sent no Duo Pops (`queue_ups.pop_note`), or null when it sent some. */
export type PopNote = "ping_off" | "outside_na" | "daily_limit" | "no_players" | "too_new" | "unavailable";

/** One row of `start_queue_up` / `get_my_queue_up` (queue_up_out): the 17 columns, in order. */
export interface QueueUpRow {
  queue_id: string;
  game_id: string;
  game_name: string | null;
  ping: boolean;
  /** How many players were sent a Duo Pop (cardinality(recipients)). */
  notified: number;
  pop_note: PopNote | null;
  created_at: string;
  /** created_at + 10 minutes: the Duo Pops' window. */
  pop_expires_at: string;
  /** created_at + 60 minutes: the queue window (the same instant as looking_now_expires_at). */
  looking_until: string;
  ended_at: string | null;
  /** The Duo Call code, only while the row is live (not ended, window not passed) and, since
   * 0088 (one duo per Queue up), not yet locked: the first duo by either path ends the call. */
  call_code: string | null;
  locked_at: string | null;
  match_id: string | null;
  /** The player who tapped I'm in, or (0088) who joined with the LFG post's code. */
  partner_id: string | null;
  partner_name: string | null;
  /** ceil(locked_at - created_at), clamped 1..600, when a Duo Pop locked it. Null when unlocked
   * and, since 0088, null for a lock that came from the LFG post (locked_via 'call'): a post
   * answered forty minutes in did not "pop in 10:00". queueState reads that null as `viaPost`. */
  popped_in_seconds: number | null;
  /** start_queue_up only: a live row already existed and was returned unchanged. */
  already_queued: boolean;
}

/** `get_duo_pop`'s status, from the recipient's side. "taken" since 0088 also means the sender's
 * call found its duo through the LFG post. */
export type DuoPopStatus = "open" | "locked_by_you" | "taken" | "expired" | "ended";

/** One row of `get_duo_pop`: the 10 columns, in order. AGES STAY: `age` is shown on the card. */
export interface DuoPopCard {
  pop_id: string;
  sender_id: string;
  display_name: string;
  age: number | null;
  game_name: string | null;
  /** Trimmed, null when blank. */
  rank_text: string | null;
  /** Riot's duo table lets the two queue Ranked Solo/Duo together. */
  can_duo: boolean;
  /** Server time left (0 unless open), so a phone with a wrong clock still counts down right. */
  seconds_left: number;
  status: DuoPopStatus;
  /** Only when status is locked_by_you. */
  match_id: string | null;
}

/** What `answer_duo_pop` says happened. Never raised: every outcome is a row. */
export type DuoPopResult = "locked" | "declined" | "taken" | "expired" | "ended" | "already_matched" | "unavailable";

/** One row of `answer_duo_pop`. */
export interface DuoPopAnswer {
  result: DuoPopResult;
  match_id: string | null;
  popped_in_seconds: number | null;
}
