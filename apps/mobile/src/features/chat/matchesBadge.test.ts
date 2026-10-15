import { describe, expect, it } from "vitest";

import type { FlagStore } from "../tour/tourSeen";

import { badgeLabel, matchesBadgeCount, matchesSeenKey, nextSeen, parseSeen, readSeen, writeSeen } from "./matchesBadge";

function match(id: string, unread: number, locked = false) {
  return { match_id: id, unread_count: unread, is_locked: locked };
}

function memoryStore(): FlagStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => Promise.resolve(data.get(key) ?? null),
    setItem: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

const broken: FlagStore = {
  getItem: () => Promise.reject(new Error("locked")),
  setItem: () => Promise.reject(new Error("locked")),
};

describe("matchesBadgeCount", () => {
  it("counts unread conversations, not unread messages", () => {
    const matches = [match("a", 3), match("b", 1), match("c", 0)];
    expect(matchesBadgeCount({ matches, pendingPartyInvites: 0, seen: ["a", "b", "c"] })).toBe(2);
  });

  it("counts a new match that already has an unread message once", () => {
    const matches = [match("new", 2)];
    expect(matchesBadgeCount({ matches, pendingPartyInvites: 0, seen: [] })).toBe(1);
  });

  it("adds no unseen term while the seen set is unknown", () => {
    const matches = [match("a", 0), match("b", 1)];
    expect(matchesBadgeCount({ matches, pendingPartyInvites: 0, seen: null })).toBe(1);
    expect(matchesBadgeCount({ matches, pendingPartyInvites: 0, seen: undefined })).toBe(1);
  });

  it("counts every unread-free match not yet seen on the tab", () => {
    const matches = [match("a", 0), match("b", 0), match("c", 0)];
    expect(matchesBadgeCount({ matches, pendingPartyInvites: 0, seen: [] })).toBe(3);
    expect(matchesBadgeCount({ matches, pendingPartyInvites: 0, seen: ["a"] })).toBe(2);
  });

  it("adds pending party invites", () => {
    expect(matchesBadgeCount({ matches: [match("a", 1)], pendingPartyInvites: 2, seen: ["a"] })).toBe(3);
    expect(matchesBadgeCount({ matches: undefined, pendingPartyInvites: 1, seen: undefined })).toBe(1);
  });

  it("counts a locked chat's unread messages (someone really is waiting; Q20)", () => {
    expect(matchesBadgeCount({ matches: [match("a", 1, true)], pendingPartyInvites: 0, seen: ["a"] })).toBe(1);
  });

  it("never goes negative on odd input", () => {
    expect(matchesBadgeCount({ matches: [match("a", -1)], pendingPartyInvites: -4, seen: ["a"] })).toBe(0);
  });
});

describe("badgeLabel", () => {
  it("shows nothing at 0, the number up to 9 and 9+ above", () => {
    expect(badgeLabel(0)).toBeUndefined();
    expect(badgeLabel(-1)).toBeUndefined();
    expect(badgeLabel(Number.NaN)).toBeUndefined();
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(9)).toBe("9");
    expect(badgeLabel(10)).toBe("9+");
    expect(badgeLabel(42)).toBe("9+");
  });
});

describe("nextSeen", () => {
  it("seeds with the current ids when nothing was stored, so an upgrade shows no stale badge", () => {
    expect(nextSeen(null, ["a", "b"])).toEqual(["a", "b"]);
  });

  it("unions with the current ids", () => {
    expect(nextSeen(["a"], ["a", "b"]).sort()).toEqual(["a", "b"]);
  });

  it("prunes ids that are no longer matches", () => {
    expect(nextSeen(["gone", "a"], ["a"])).toEqual(["a"]);
  });

  it("never repeats an id", () => {
    expect(nextSeen(["a", "a"], ["a", "a"])).toEqual(["a"]);
  });
});

describe("parseSeen", () => {
  it("reads a JSON array of ids", () => {
    expect(parseSeen('["a","b"]')).toEqual(["a", "b"]);
    expect(parseSeen("[]")).toEqual([]);
  });

  it("treats anything else as nothing stored", () => {
    expect(parseSeen(null)).toBeNull();
    expect(parseSeen("")).toBeNull();
    expect(parseSeen("{")).toBeNull();
    expect(parseSeen('{"a":1}')).toBeNull();
    expect(parseSeen("42")).toBeNull();
  });

  it("drops non-string entries", () => {
    expect(parseSeen('["a",1,null,"b"]')).toEqual(["a", "b"]);
  });
});

describe("the seen store", () => {
  it("is keyed per account", () => {
    expect(matchesSeenKey("p1")).toBe("duoqueue.matches-seen.v1.p1");
  });

  it("round-trips through a FlagStore", async () => {
    const store = memoryStore();
    expect(await readSeen(store, "p1")).toBeNull();
    await writeSeen(store, "p1", ["a", "b"]);
    expect(await readSeen(store, "p1")).toEqual(["a", "b"]);
    expect(await readSeen(store, "p2")).toBeNull();
  });

  it("reads a throwing store as nothing stored (which seeds, so a broken store means no badge, never a stuck one)", async () => {
    expect(await readSeen(broken, "p1")).toBeNull();
    await expect(writeSeen(broken, "p1", ["a"])).resolves.toBeUndefined();
  });
});
