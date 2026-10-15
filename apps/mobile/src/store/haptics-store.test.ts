import { beforeEach, describe, expect, it, vi } from "vitest";

import { HAPTICS_STORAGE_KEY } from "../lib/hapticsPreference";

import { loadHapticsPreference, useHapticsStore } from "./haptics-store";

/**
 * The store end of the Haptics switch. hapticsPreference.test.ts proves the parsing rule; this
 * proves the two things only the store can get wrong: that loading never turns haptics on or
 * throws, and that a failed write never escapes the switch as an unhandled rejection.
 *
 * AsyncStorage is mocked by its literal specifier with an in-memory double that can be told to
 * fail (vitest hoists `vi.hoisted` and `vi.mock` above the imports).
 */
const mocks = vi.hoisted(() => {
  const state = {
    stored: new Map<string, string>(),
    failRead: false,
    failWrite: false,
    writes: [] as [string, string][],
  };
  const AsyncStorage = {
    getItem: (key: string) =>
      state.failRead ? Promise.reject(new Error("read failed")) : Promise.resolve(state.stored.get(key) ?? null),
    setItem: (key: string, value: string) => {
      state.writes.push([key, value]);
      if (state.failWrite) return Promise.reject(new Error("write failed"));
      state.stored.set(key, value);
      return Promise.resolve();
    },
  };
  return { state, AsyncStorage };
});

vi.mock("@react-native-async-storage/async-storage", () => ({ default: mocks.AsyncStorage }));

beforeEach(() => {
  mocks.state.stored.clear();
  mocks.state.writes = [];
  mocks.state.failRead = false;
  mocks.state.failWrite = false;
  useHapticsStore.setState({ enabled: true });
});

describe("useHapticsStore", () => {
  it("starts on", () => {
    expect(useHapticsStore.getState().enabled).toBe(true);
  });

  it("setEnabled updates the state at once and writes 'on' or 'off'", () => {
    useHapticsStore.getState().setEnabled(false);
    expect(useHapticsStore.getState().enabled).toBe(false);
    useHapticsStore.getState().setEnabled(true);
    expect(useHapticsStore.getState().enabled).toBe(true);
    expect(mocks.state.writes).toEqual([
      [HAPTICS_STORAGE_KEY, "off"],
      [HAPTICS_STORAGE_KEY, "on"],
    ]);
  });

  it("a failed write keeps the new state and never rejects unhandled", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      mocks.state.failWrite = true;
      useHapticsStore.getState().setEnabled(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(useHapticsStore.getState().enabled).toBe(false);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});

describe("loadHapticsPreference", () => {
  it("turns haptics off when 'off' was saved", async () => {
    mocks.state.stored.set(HAPTICS_STORAGE_KEY, "off");
    await loadHapticsPreference();
    expect(useHapticsStore.getState().enabled).toBe(false);
  });

  it("leaves them on when nothing was saved", async () => {
    await loadHapticsPreference();
    expect(useHapticsStore.getState().enabled).toBe(true);
  });

  it("never turns them back on: a saved 'on' does not override a switch already flipped off", async () => {
    mocks.state.stored.set(HAPTICS_STORAGE_KEY, "on");
    useHapticsStore.setState({ enabled: false });
    await loadHapticsPreference();
    expect(useHapticsStore.getState().enabled).toBe(false);
  });

  it("a failed read keeps the default and does not throw", async () => {
    mocks.state.failRead = true;
    await expect(loadHapticsPreference()).resolves.toBeUndefined();
    expect(useHapticsStore.getState().enabled).toBe(true);
  });

  it("writes nothing", async () => {
    mocks.state.stored.set(HAPTICS_STORAGE_KEY, "off");
    await loadHapticsPreference();
    expect(mocks.state.writes).toEqual([]);
  });
});
