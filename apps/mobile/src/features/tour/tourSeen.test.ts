import { describe, expect, it } from "vitest";

import { hasSeenTour, markTourSeen, tourSeenKey, type FlagStore } from "./tourSeen";

function memoryStore(): FlagStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(data.get(key) ?? null),
    setItem: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

describe("the tour's once-per-account flag", () => {
  it("is keyed by the user id", () => {
    expect(tourSeenKey("u1")).toBe("duoqueue.tour-seen.v1.u1");
  });

  it("is unseen for a new account and seen once marked, per account", async () => {
    const store = memoryStore();
    expect(await hasSeenTour(store, "u1")).toBe(false);
    await markTourSeen(store, "u1");
    expect(await hasSeenTour(store, "u1")).toBe(true);
    expect(await hasSeenTour(store, "u2")).toBe(false);
  });

  it("treats an unreadable store as seen, so nobody sees the tour twice", async () => {
    const broken: FlagStore = { getItem: () => Promise.reject(new Error("locked")), setItem: () => Promise.resolve() };
    expect(await hasSeenTour(broken, "u1")).toBe(true);
  });

  it("swallows a failed write", async () => {
    const full: FlagStore = { getItem: () => Promise.resolve(null), setItem: () => Promise.reject(new Error("full")) };
    await expect(markTourSeen(full, "u1")).resolves.toBeUndefined();
  });
});
