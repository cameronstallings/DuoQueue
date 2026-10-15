import { describe, expect, it } from "vitest";

import {
  msUntilLabelChange,
  PLEX_CHIP_ADVANCE,
  pillContentWidth,
  POP_RECHECK_GRACE_MS,
  popRecheckAtMs,
  QUEUE_UP_PILL,
  queueStateOf,
  queueUpButtonLabel,
  queueUpEmptyDeckLabel,
  sheetClockMs,
  sheetViewOf,
} from "./queueState";
import type { QueueUpRow } from "./types";

const NOW = Date.parse("2026-10-15T22:00:00.000Z");
const MIN = 60_000;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** A live queue-up created 5 minutes ago, still popping, with a call code. */
function row(over: Partial<QueueUpRow> = {}): QueueUpRow {
  return {
    queue_id: "6a2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b",
    game_id: "1f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b",
    game_name: "League of Legends",
    ping: true,
    notified: 4,
    pop_note: null,
    created_at: iso(NOW - 5 * MIN),
    pop_expires_at: iso(NOW + 5 * MIN),
    looking_until: iso(NOW + 55 * MIN),
    ended_at: null,
    call_code: "K7Q2M9XA4P",
    locked_at: null,
    match_id: null,
    partner_id: null,
    partner_name: null,
    popped_in_seconds: null,
    already_queued: false,
    ...over,
  };
}

describe("queueStateOf", () => {
  it("is idle when the flag is off", () => {
    expect(queueStateOf({ isLookingNow: false, expiresAt: iso(NOW + 30 * MIN), nowMs: NOW })).toEqual({ kind: "idle" });
  });

  it("is idle for a missing, unparseable or past expiry, so a stale ON never shows", () => {
    // The old free-to-duo switch read only the flag, so a phone whose flag outlived its expiry
    // (the 5-minute sweep had not run) showed a switch that was on for nobody.
    expect(queueStateOf({ isLookingNow: true, expiresAt: null, nowMs: NOW })).toEqual({ kind: "idle" });
    expect(queueStateOf({ isLookingNow: true, expiresAt: undefined, nowMs: NOW })).toEqual({ kind: "idle" });
    expect(queueStateOf({ isLookingNow: true, expiresAt: "not a date", nowMs: NOW })).toEqual({ kind: "idle" });
    expect(queueStateOf({ isLookingNow: true, expiresAt: iso(NOW - 1), nowMs: NOW })).toEqual({ kind: "idle" });
    expect(queueStateOf({ isLookingNow: true, expiresAt: iso(NOW), nowMs: NOW })).toEqual({ kind: "idle" });
  });

  it("counts whole minutes up, clamped to 1..60", () => {
    expect(queueStateOf({ isLookingNow: true, expiresAt: iso(NOW + 41 * MIN + 1), nowMs: NOW })).toEqual({
      kind: "queued",
      minutesLeft: 42,
      untilMs: NOW + 41 * MIN + 1,
    });
    expect(queueStateOf({ isLookingNow: true, expiresAt: iso(NOW + 42 * MIN), nowMs: NOW })).toMatchObject({
      minutesLeft: 42,
    });
    expect(queueStateOf({ isLookingNow: true, expiresAt: iso(NOW + 1), nowMs: NOW })).toMatchObject({ minutesLeft: 1 });
    expect(queueStateOf({ isLookingNow: true, expiresAt: iso(NOW + 90 * MIN), nowMs: NOW })).toMatchObject({
      minutesLeft: 60,
    });
  });
});

describe("the two labels", () => {
  it("reads Queue up when idle", () => {
    expect(queueUpButtonLabel({ kind: "idle" })).toBe("Queue up");
    expect(queueUpEmptyDeckLabel({ kind: "idle" })).toBe("Queue up");
  });

  it("counts down while queued", () => {
    const state = { kind: "queued" as const, minutesLeft: 42, untilMs: NOW + 42 * MIN };
    expect(queueUpButtonLabel(state)).toBe("Queued 42m");
    expect(queueUpEmptyDeckLabel(state)).toBe("Queued for 42 min");
  });
});

describe("msUntilLabelChange", () => {
  it("is null when idle (no timer at all)", () => {
    expect(msUntilLabelChange({ kind: "idle" }, NOW)).toBeNull();
  });

  it("waits for the next whole-minute boundary of the time left", () => {
    // 41.5 minutes left reads 42m; it reads 41m once 41 are left, in 30 seconds.
    const state = queueStateOf({ isLookingNow: true, expiresAt: iso(NOW + 41.5 * MIN), nowMs: NOW });
    expect(msUntilLabelChange(state, NOW)).toBe(30_000);
  });

  it("waits a whole minute when the time left is exactly on a boundary", () => {
    const state = queueStateOf({ isLookingNow: true, expiresAt: iso(NOW + 2 * MIN), nowMs: NOW });
    expect(msUntilLabelChange(state, NOW)).toBe(MIN);
  });

  it("waits for the expiry in the last minute", () => {
    const state = queueStateOf({ isLookingNow: true, expiresAt: iso(NOW + 20_000), nowMs: NOW });
    expect(msUntilLabelChange(state, NOW)).toBe(20_000);
  });

  it("never schedules faster than 250 ms", () => {
    const state = queueStateOf({ isLookingNow: true, expiresAt: iso(NOW + 41 * MIN + 10), nowMs: NOW });
    expect(msUntilLabelChange(state, NOW)).toBe(250);
    expect(msUntilLabelChange({ kind: "queued", minutesLeft: 1, untilMs: NOW - 5 }, NOW)).toBe(250);
  });
});

describe("the pill", () => {
  it("measures the two labels as on 14 Oct", () => {
    expect(pillContentWidth("Queue up", false)).toBeCloseTo(52.8, 5);
    expect(pillContentWidth("Queued 60m", false)).toBeCloseTo(66.0, 5);
    expect(pillContentWidth("Queue up", true)).toBeCloseTo(52.8 + QUEUE_UP_PILL.iconSize + QUEUE_UP_PILL.iconGap, 5);
    expect(PLEX_CHIP_ADVANCE).toBe(6.6);
  });
});

describe("sheetViewOf", () => {
  it("is idle with no row", () => {
    expect(sheetViewOf(null, NOW)).toEqual({ kind: "idle" });
    expect(sheetViewOf(undefined, NOW)).toEqual({ kind: "idle" });
  });

  it("is queued and popping inside the pop window", () => {
    expect(sheetViewOf(row(), NOW)).toEqual({
      kind: "queued",
      outcome: "popping",
      notified: 4,
      minutesLeft: 55,
      canShare: true,
    });
  });

  it("says nobody answered once the pop window has passed", () => {
    expect(sheetViewOf(row({ pop_expires_at: iso(NOW - 1) }), NOW)).toMatchObject({ outcome: "no_answer" });
  });

  it("passes every pop note through, the sender rules included", () => {
    for (const note of ["ping_off", "outside_na", "daily_limit", "no_players", "too_new", "unavailable"] as const) {
      expect(sheetViewOf(row({ pop_note: note, notified: 0 }), NOW)).toMatchObject({ kind: "queued", outcome: note });
    }
  });

  it("offers the post only while there is a code", () => {
    expect(sheetViewOf(row({ call_code: null }), NOW)).toMatchObject({ canShare: false });
  });

  it("is locked once someone tapped I'm in, with the partner's name", () => {
    const matchId = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
    expect(
      sheetViewOf(
        row({ locked_at: iso(NOW - MIN), match_id: matchId, partner_name: "Kai", popped_in_seconds: 41 }),
        NOW,
      ),
    ).toEqual({ kind: "locked", partnerName: "Kai", matchId, poppedInSeconds: 41 });
  });

  it("falls back to 'your duo' with no partner name", () => {
    const view = sheetViewOf(row({ locked_at: iso(NOW - MIN), match_id: "m", partner_name: null }), NOW);
    expect(view).toMatchObject({ kind: "locked", partnerName: "your duo", poppedInSeconds: null });
    const blank = sheetViewOf(row({ locked_at: iso(NOW - MIN), match_id: "m", partner_name: "  " }), NOW);
    expect(blank).toMatchObject({ partnerName: "your duo" });
  });

  it("is not locked without the match id", () => {
    expect(sheetViewOf(row({ locked_at: iso(NOW - MIN) }), NOW)).toMatchObject({ kind: "queued" });
  });

  it("is idle once stopped or once the hour has passed, locked or not, so Queue up works again", () => {
    expect(sheetViewOf(row({ ended_at: iso(NOW - MIN) }), NOW)).toEqual({ kind: "idle" });
    expect(sheetViewOf(row({ looking_until: iso(NOW - 1) }), NOW)).toEqual({ kind: "idle" });
    const locked = { locked_at: iso(NOW - 2 * MIN), match_id: "m", partner_name: "Kai" };
    expect(sheetViewOf(row({ ...locked, ended_at: iso(NOW - MIN) }), NOW)).toEqual({ kind: "idle" });
    expect(sheetViewOf(row({ ...locked, looking_until: iso(NOW - 1) }), NOW)).toEqual({ kind: "idle" });
  });

  it("reads a malformed window as passed, and a malformed pop expiry as no answer", () => {
    expect(sheetViewOf(row({ looking_until: "garbage" }), NOW)).toEqual({ kind: "idle" });
    expect(sheetViewOf(row({ pop_expires_at: "garbage" }), NOW)).toMatchObject({ outcome: "no_answer" });
  });
});

describe("the pop window's end is confirmed by a read, never by the phone's clock", () => {
  const popEnds = NOW + 5 * MIN;

  it("keeps the sheet's clock inside the window until a read taken after it has landed", () => {
    const live = row();
    // Read before the window closed, and the 15 s tick has gone past it: still "popping".
    expect(sheetClockMs(live, popEnds + 30_000, NOW)).toBe(popEnds - 1);
    expect(sheetViewOf(live, sheetClockMs(live, popEnds + 30_000, NOW))).toMatchObject({ outcome: "popping" });
    // Inside the window the clock is the clock.
    expect(sheetClockMs(live, NOW + MIN, NOW)).toBe(NOW + MIN);
    // A read from after the window: the clock runs, and "nobody grabbed it" is the server's word.
    expect(sheetClockMs(live, popEnds + 30_000, popEnds + 1_000)).toBe(popEnds + 30_000);
    expect(sheetViewOf(live, sheetClockMs(live, popEnds + 30_000, popEnds + 1_000))).toMatchObject({
      outcome: "no_answer",
    });
  });

  it("leaves the clock alone when there is no window to wait on", () => {
    const later = popEnds + 30_000;
    expect(sheetClockMs(null, later, NOW)).toBe(later);
    expect(sheetClockMs(undefined, later, NOW)).toBe(later);
    expect(sheetClockMs(row({ pop_note: "ping_off" }), later, NOW)).toBe(later);
    expect(sheetClockMs(row({ locked_at: iso(NOW), match_id: "m" }), later, NOW)).toBe(later);
    expect(sheetClockMs(row({ ended_at: iso(NOW) }), later, NOW)).toBe(later);
    expect(sheetClockMs(row({ pop_expires_at: "garbage" }), later, NOW)).toBe(later);
  });

  it("asks for one re-read just after the window closes, only while unconfirmed", () => {
    expect(popRecheckAtMs(row(), NOW)).toBe(popEnds + POP_RECHECK_GRACE_MS);
    expect(popRecheckAtMs(row(), popEnds + 1)).toBeNull();
    expect(popRecheckAtMs(null, NOW)).toBeNull();
    expect(popRecheckAtMs(row({ pop_note: "no_players" }), NOW)).toBeNull();
    expect(popRecheckAtMs(row({ locked_at: iso(NOW), match_id: "m" }), NOW)).toBeNull();
    expect(popRecheckAtMs(row({ ended_at: iso(NOW) }), NOW)).toBeNull();
    expect(popRecheckAtMs(row({ pop_expires_at: "garbage" }), NOW)).toBeNull();
  });
});
