import { describe, expect, it, vi } from "vitest";

import { PUSH_ASK_INTERVAL_MS } from "../push/pushAsk";
import type { FlagStore } from "../tour/tourSeen";

import {
  duoPopsOfferKey,
  duoPopsWanted,
  hasSeenDuoPopsOffer,
  isNaRegion,
  markDuoPopsOfferSeen,
  offeredWithinWeek,
  readQueuePop,
  shouldOfferDuoPops,
} from "./duoPopsOptIn";

const USER = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";

function memoryStore(initial: Record<string, string> = {}): FlagStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: async (key) => data[key] ?? null,
    setItem: async (key, value) => {
      data[key] = value;
    },
  };
}

const throwing: FlagStore = {
  getItem: async () => {
    throw new Error("storage unavailable");
  },
  setItem: async () => {
    throw new Error("storage unavailable");
  },
};

describe("the seen flag", () => {
  it("is keyed per account", () => {
    expect(duoPopsOfferKey(USER)).toBe(`duoqueue.duo-pops-offer.v1.${USER}`);
  });

  it("round-trips through the store", async () => {
    const store = memoryStore();
    expect(await hasSeenDuoPopsOffer(store, USER)).toBe(false);
    await markDuoPopsOfferSeen(store, USER);
    expect(await hasSeenDuoPopsOffer(store, USER)).toBe(true);
    expect(await hasSeenDuoPopsOffer(store, "someone-else")).toBe(false);
  });

  it("counts an unreadable store as seen: a missed offer is harmless, a repeated one is not", async () => {
    expect(await hasSeenDuoPopsOffer(throwing, USER)).toBe(true);
  });

  it("swallows a failed write", async () => {
    await expect(markDuoPopsOfferSeen(throwing, USER)).resolves.toBeUndefined();
  });
});

describe("readQueuePop", () => {
  it("is undefined while the column does not exist (0085 not applied) or nothing has loaded", () => {
    expect(readQueuePop({ profile_id: USER, new_match: true })).toBeUndefined();
    expect(readQueuePop(undefined)).toBeUndefined();
    expect(readQueuePop(null)).toBeUndefined();
    expect(readQueuePop("queue_pop")).toBeUndefined();
  });

  it("reads the column when it is a boolean", () => {
    expect(readQueuePop({ queue_pop: true })).toBe(true);
    expect(readQueuePop({ queue_pop: false })).toBe(false);
  });

  it("does not guess at anything else", () => {
    expect(readQueuePop({ queue_pop: "true" })).toBeUndefined();
    expect(readQueuePop({ queue_pop: null })).toBeUndefined();
    expect(readQueuePop({ queue_pop: 1 })).toBeUndefined();
  });
});

describe("isNaRegion", () => {
  it("is the server's NA group: east and west", () => {
    expect(isNaRegion("na_east")).toBe(true);
    expect(isNaRegion("na_west")).toBe(true);
    for (const region of ["sa", "eu", "mena", "africa", "asia", "sea", "oce", "", null, undefined]) {
      expect(isNaRegion(region)).toBe(false);
    }
  });
});

describe("duoPopsWanted", () => {
  const yes = { onboarded: true, inNa: true, queuePop: false, seen: false } as const;

  it("wants the card for an onboarded NA player who has it off and has not been offered it", () => {
    expect(duoPopsWanted(yes)).toBe(true);
  });

  it("is blocked by each input on its own", () => {
    expect(duoPopsWanted({ ...yes, onboarded: false })).toBe(false);
    expect(duoPopsWanted({ ...yes, inNa: false })).toBe(false);
    expect(duoPopsWanted({ ...yes, queuePop: true })).toBe(false);
    expect(duoPopsWanted({ ...yes, queuePop: undefined })).toBe(false);
    expect(duoPopsWanted({ ...yes, seen: true })).toBe(false);
    expect(duoPopsWanted({ ...yes, seen: undefined })).toBe(false);
  });
});

describe("shouldOfferDuoPops", () => {
  const LAUNCH = 1_000_000;
  const base = {
    wanted: true,
    trigger: "like" as const,
    firstLikeAt: LAUNCH + 5,
    launchStartedAt: LAUNCH,
    askedWithinWeek: false,
    queueSheetOpen: false,
  };

  it("offers right after a like, and on the empty deck", () => {
    expect(shouldOfferDuoPops(base)).toBe(true);
    expect(shouldOfferDuoPops({ ...base, trigger: "empty", firstLikeAt: null })).toBe(true);
  });

  it("offers on focus only after a like in an earlier launch", () => {
    expect(shouldOfferDuoPops({ ...base, trigger: "focus", firstLikeAt: LAUNCH - 1 })).toBe(true);
    expect(shouldOfferDuoPops({ ...base, trigger: "focus", firstLikeAt: LAUNCH + 5 })).toBe(false);
    expect(shouldOfferDuoPops({ ...base, trigger: "focus", firstLikeAt: LAUNCH })).toBe(false);
    expect(shouldOfferDuoPops({ ...base, trigger: "focus", firstLikeAt: null })).toBe(false);
  });

  it("never offers when not wanted, within a week of another ask, or over the open sheet", () => {
    for (const trigger of ["like", "focus", "empty"] as const) {
      const t = { ...base, trigger, firstLikeAt: LAUNCH - 1 };
      expect(shouldOfferDuoPops({ ...t, wanted: false })).toBe(false);
      expect(shouldOfferDuoPops({ ...t, askedWithinWeek: true })).toBe(false);
      expect(shouldOfferDuoPops({ ...t, queueSheetOpen: true })).toBe(false);
    }
  });

  it("does not depend on the clock", () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(0);
    expect(shouldOfferDuoPops(base)).toBe(true);
    spy.mockRestore();
  });
});

describe("offeredWithinWeek (the one weekly cap every ask shares)", () => {
  const NOW = 10 * PUSH_ASK_INTERVAL_MS;

  it("is unknown until the record has loaded", () => {
    expect(offeredWithinWeek(undefined, NOW)).toBeUndefined();
  });

  it("is false with no ask on record, and from exactly a week on", () => {
    expect(offeredWithinWeek(null, NOW)).toBe(false);
    expect(offeredWithinWeek(NOW - PUSH_ASK_INTERVAL_MS, NOW)).toBe(false);
  });

  it("is true inside the week, matching pushAskKind's rule (a stamp in the near future counts too)", () => {
    expect(offeredWithinWeek(NOW - PUSH_ASK_INTERVAL_MS + 1, NOW)).toBe(true);
    expect(offeredWithinWeek(NOW, NOW)).toBe(true);
    expect(offeredWithinWeek(NOW + 60_000, NOW)).toBe(true);
  });
});
