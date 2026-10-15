import type { PopNote, QueueUpRow } from "./types";

/**
 * Queue Up's state, worked out without React: the header pill's label, when that label next
 * changes, the pill's measured size, and what the Queue Up sheet shows for the sender's newest
 * queue-up. Pure and tested (queueState.test.ts); the hooks only feed it the profile and the row.
 *
 * TWO SOURCES, ON PURPOSE. The pill reads the session profile's `is_looking_now` and
 * `looking_now_expires_at` (already loaded, so the header never waits on a request and costs no
 * RPC per deck visit). The sheet reads `get_my_queue_up` when it opens, because only that row
 * knows how many players were pinged, why none were, and whether someone grabbed it. start_queue_up
 * writes both from one transaction, so they agree.
 */

const MINUTE_MS = 60_000;
/** A queue-up lasts an hour (start_queue_up's looking_until), so the label never reads more. */
const MAX_MINUTES = 60;
/** The smallest wait a label timer is ever given, so a clock that lands a hair early (or an
 * expiry already in the past) can never spin a timer loop. */
const MIN_TIMER_MS = 250;

export type QueueState = { kind: "idle" } | { kind: "queued"; minutesLeft: number; untilMs: number };

function parseMs(value: string | null | undefined): number | null {
  if (typeof value !== "string" || value === "") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function minutesLeftOf(untilMs: number, nowMs: number): number {
  return Math.min(MAX_MINUTES, Math.max(1, Math.ceil((untilMs - nowMs) / MINUTE_MS)));
}

/**
 * Queued only while the flag is on AND its expiry is a real time still ahead. The old free-to-duo
 * switch read the flag alone, so a profile whose flag outlived its expiry (0074's sweep runs every
 * 5 minutes) showed a switch that was on for nobody; the expiry is the truth, the flag its shadow.
 * Minutes count up (41.5 left reads 42), clamped to 1..60.
 */
export function queueStateOf(input: {
  isLookingNow: boolean | null | undefined;
  expiresAt: string | null | undefined;
  nowMs: number;
}): QueueState {
  if (input.isLookingNow !== true) return { kind: "idle" };
  const untilMs = parseMs(input.expiresAt);
  if (untilMs === null || untilMs <= input.nowMs) return { kind: "idle" };
  return { kind: "queued", minutesLeft: minutesLeftOf(untilMs, input.nowMs), untilMs };
}

/** The deck header pill (type.chipText uppercases it): "Queue up" / "Queued 42m". */
export function queueUpButtonLabel(state: QueueState): string {
  return state.kind === "queued" ? `Queued ${state.minutesLeft}m` : "Queue up";
}

/** The empty deck's primary button: "Queue up" / "Queued for 42 min". */
export function queueUpEmptyDeckLabel(state: QueueState): string {
  return state.kind === "queued" ? `Queued for ${state.minutesLeft} min` : "Queue up";
}

/**
 * How long until the label above reads something else: the next whole-minute boundary of the
 * time left (or the expiry, in the last minute). Null when idle, so an idle header holds no timer
 * at all. One timeout per minute while queued, never a poll.
 */
export function msUntilLabelChange(state: QueueState, nowMs: number): number | null {
  if (state.kind !== "queued") return null;
  const remaining = state.untilMs - nowMs;
  // ceil(remaining / 1 min) drops by one exactly when `remaining` reaches a whole minute, so the
  // wait is what is left past the last boundary (a whole minute when it sits on one).
  const toBoundary = ((((remaining - 1) % MINUTE_MS) + MINUTE_MS) % MINUTE_MS) + 1;
  return Math.max(MIN_TIMER_MS, remaining <= 0 ? 0 : toBoundary);
}

/**
 * The header pill's box: 84 x 28pt with a 1px border and 6pt of padding each side, so its content
 * gets 84 - 12 - 2 = 70pt. Measured from the bundled IBM Plex Mono on 14 Oct (deckHeaderFit.ts has
 * the method): at type.chipText (10pt, letter spacing 0.6) every character advances
 * PLEX_CHIP_ADVANCE = 0.6em + 0.6 = 6.6pt, so "QUEUE UP" is 52.8 (67.8 with the 12pt icon and its
 * 3pt gap) and "QUEUED 60M", the longest label, 66.0. Both fit; deckHeaderFit.test.ts proves it for
 * every minute.
 */
export const QUEUE_UP_PILL = { width: 84, height: 28, paddingX: 6, border: 1, iconSize: 12, iconGap: 3 } as const;

export const PLEX_CHIP_ADVANCE = 6.6;

/** The width a pill label takes, in points, with or without the idle icon in front of it. */
export function pillContentWidth(label: string, withIcon: boolean): number {
  const text = label.length * PLEX_CHIP_ADVANCE;
  return withIcon ? text + QUEUE_UP_PILL.iconSize + QUEUE_UP_PILL.iconGap : text;
}

/** What the Duo Pops did, as the sheet says it: still inside the 10-minute window, the window
 * passed with nobody in, or the server's reason none were sent. */
export type PopOutcome = "popping" | "no_answer" | PopNote;

export type SheetView =
  | { kind: "idle" }
  | { kind: "queued"; outcome: PopOutcome; notified: number; minutesLeft: number; canShare: boolean }
  | { kind: "locked"; partnerName: string; matchId: string; poppedInSeconds: number | null };

/**
 * The sheet's phase for the sender's newest queue-up (get_my_queue_up), or idle without one.
 *
 * Stopped, or past its hour: idle, whatever else the row says, so Queue up is there again. (The
 * plan put "locked" first; a stopped or finished queue-up whose pop was grabbed would then hold the
 * sheet on "Duo locked" for up to 70 minutes with no way to queue again. The duo itself is in
 * Matches either way.)
 *
 * Locked: someone tapped I'm in and the match exists. Otherwise queued, with the server's
 * pop_note when it sent no pops, else "popping" while the 10-minute window is open and
 * "no_answer" after it. The post can be shared only while the row still carries its code.
 */
export function sheetViewOf(row: QueueUpRow | null | undefined, nowMs: number): SheetView {
  if (!row) return { kind: "idle" };
  const untilMs = parseMs(row.looking_until);
  if (row.ended_at !== null || untilMs === null || untilMs <= nowMs) return { kind: "idle" };

  if (row.locked_at !== null && row.match_id !== null) {
    const name = row.partner_name?.trim();
    return {
      kind: "locked",
      partnerName: name ? name : "your duo",
      matchId: row.match_id,
      poppedInSeconds: row.popped_in_seconds ?? null,
    };
  }

  const popUntil = parseMs(row.pop_expires_at);
  const outcome: PopOutcome = row.pop_note ?? (popUntil !== null && popUntil > nowMs ? "popping" : "no_answer");
  return {
    kind: "queued",
    outcome,
    notified: row.notified,
    minutesLeft: minutesLeftOf(untilMs, nowMs),
    canShare: row.call_code !== null,
  };
}
