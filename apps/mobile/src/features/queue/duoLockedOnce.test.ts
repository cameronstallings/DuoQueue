import { describe, expect, it } from "vitest";

import {
  CELEBRATED_MAX,
  celebrateOnResume,
  DUO_LOCKED_SEEN_KEY,
  parseCelebrated,
  rememberCelebrated,
  RESUME_WINDOW_MS,
  wasCelebrated,
} from "./duoLockedOnce";

const NOW = Date.parse("2026-10-15T22:00:00.000Z");
const MIN = 60_000;
const POP = "6a2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";

function lockedRow(
  over: Partial<{
    queue_id: string;
    locked_at: string | null;
    match_id: string | null;
    popped_in_seconds: number | null;
  }> = {},
) {
  return {
    queue_id: POP,
    locked_at: new Date(NOW - 2 * MIN).toISOString(),
    match_id: "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b",
    popped_in_seconds: 41,
    ...over,
  };
}

describe("the celebrated list", () => {
  it("has a versioned key and a cap of 20", () => {
    expect(DUO_LOCKED_SEEN_KEY).toBe("duoqueue.duo-locked-seen.v1");
    expect(CELEBRATED_MAX).toBe(20);
  });

  it("remembers newest first, once each, case-blind", () => {
    let list = rememberCelebrated([], "a");
    list = rememberCelebrated(list, "b");
    list = rememberCelebrated(list, "A");
    expect(list).toEqual(["a", "b"]);
    expect(wasCelebrated(list, "B")).toBe(true);
    expect(wasCelebrated(list, "c")).toBe(false);
  });

  it("keeps the 20 newest", () => {
    let list: string[] = [];
    for (let i = 0; i < 25; i++) list = rememberCelebrated(list, `pop-${i}`);
    expect(list).toHaveLength(20);
    expect(list[0]).toBe("pop-24");
    expect(wasCelebrated(list, "pop-4")).toBe(false);
    expect(wasCelebrated(list, "pop-5")).toBe(true);
  });

  it("does not change the list it was given", () => {
    const list = ["a"];
    rememberCelebrated(list, "b");
    expect(list).toEqual(["a"]);
  });

  it("ignores an empty id", () => {
    expect(rememberCelebrated(["a"], "  ")).toEqual(["a"]);
    expect(wasCelebrated(["a"], "")).toBe(false);
  });

  it("reads the stored list tolerantly", () => {
    expect(parseCelebrated(JSON.stringify(["a", "b"]))).toEqual(["a", "b"]);
    expect(parseCelebrated(null)).toEqual([]);
    expect(parseCelebrated("{")).toEqual([]);
    expect(parseCelebrated('{"a":1}')).toEqual([]);
    expect(parseCelebrated(JSON.stringify(["a", 3, null, "B"]))).toEqual(["a", "b"]);
    expect(parseCelebrated(JSON.stringify(Array.from({ length: 30 }, (_, i) => `p${i}`)))).toHaveLength(20);
  });
});

describe("celebrateOnResume", () => {
  it("celebrates a lock from the last 15 minutes that has not been shown", () => {
    expect(celebrateOnResume(lockedRow(), NOW, [])).toBe(true);
  });

  it("holds at exactly 15 minutes and lets go after", () => {
    expect(RESUME_WINDOW_MS).toBe(15 * MIN);
    expect(celebrateOnResume(lockedRow({ locked_at: new Date(NOW - 15 * MIN).toISOString() }), NOW, [])).toBe(true);
    expect(celebrateOnResume(lockedRow({ locked_at: new Date(NOW - 15 * MIN - 1).toISOString() }), NOW, [])).toBe(
      false,
    );
  });

  it("never celebrates twice", () => {
    expect(celebrateOnResume(lockedRow(), NOW, [POP])).toBe(false);
    expect(celebrateOnResume(lockedRow(), NOW, [POP.toUpperCase()])).toBe(false);
  });

  it("needs a lock and its match", () => {
    expect(celebrateOnResume(lockedRow({ locked_at: null }), NOW, [])).toBe(false);
    expect(celebrateOnResume(lockedRow({ match_id: null }), NOW, [])).toBe(false);
    expect(celebrateOnResume(lockedRow({ locked_at: "garbage" }), NOW, [])).toBe(false);
    expect(celebrateOnResume(null, NOW, [])).toBe(false);
  });

  it("never opens DUO LOCKED for a duo that came from the LFG post (no popped-in time)", () => {
    // Its sentence would say "You and {name} both queued up", which is not what happened; the
    // sheet and the push already say who answered the post.
    expect(celebrateOnResume(lockedRow({ popped_in_seconds: null }), NOW, [])).toBe(false);
  });

  it("still celebrates a lock stamped a little ahead of this phone's clock", () => {
    expect(celebrateOnResume(lockedRow({ locked_at: new Date(NOW + 30_000).toISOString() }), NOW, [])).toBe(true);
  });
});
