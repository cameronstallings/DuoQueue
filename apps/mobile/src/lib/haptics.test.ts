import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hapticError,
  hapticHeavy,
  hapticLight,
  hapticMedium,
  hapticRigid,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
} from "./haptics";

/**
 * The one haptics module: eight wrappers, each firing exactly one expo-haptics call, every one of
 * them gated by the Settings > Appearance > Haptics switch, and none able to throw or reject into
 * the tap it is attached to.
 *
 * expo-haptics and the haptics store are mocked by their literal specifiers (vitest has no `@/`
 * alias and no native module). vitest hoists `vi.hoisted` and `vi.mock` above the imports, so the
 * module under test is loaded against the doubles.
 */
const mocks = vi.hoisted(() => {
  const state = { enabled: true, fail: false, calls: [] as string[] };
  const settle = () => (state.fail ? Promise.reject(new Error("no haptics engine")) : Promise.resolve());
  const Haptics = {
    ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy", Soft: "soft", Rigid: "rigid" },
    NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
    impactAsync: (style: string) => {
      state.calls.push(`impact:${style}`);
      return settle();
    },
    notificationAsync: (kind: string) => {
      state.calls.push(`notification:${kind}`);
      return settle();
    },
    selectionAsync: () => {
      state.calls.push("selection");
      return settle();
    },
  };
  return { state, Haptics };
});

vi.mock("expo-haptics", () => mocks.Haptics);
vi.mock("@/store/haptics-store", () => ({
  useHapticsStore: { getState: () => ({ enabled: mocks.state.enabled }) },
}));

const WRAPPERS: [string, () => void, string][] = [
  ["hapticLight", hapticLight, "impact:light"],
  ["hapticMedium", hapticMedium, "impact:medium"],
  ["hapticHeavy", hapticHeavy, "impact:heavy"],
  ["hapticRigid", hapticRigid, "impact:rigid"],
  ["hapticSelection", hapticSelection, "selection"],
  ["hapticSuccess", hapticSuccess, "notification:success"],
  ["hapticWarning", hapticWarning, "notification:warning"],
  ["hapticError", hapticError, "notification:error"],
];

beforeEach(() => {
  mocks.state.enabled = true;
  mocks.state.fail = false;
  mocks.state.calls = [];
});

describe("haptics", () => {
  it.each(WRAPPERS)("%s fires exactly one %s", (_name, fire, expected) => {
    fire();
    expect(mocks.state.calls).toEqual([expected]);
  });

  it.each(WRAPPERS)("%s fires nothing with the switch off", (_name, fire) => {
    mocks.state.enabled = false;
    fire();
    expect(mocks.state.calls).toEqual([]);
  });

  it.each(WRAPPERS)("%s returns nothing and never rejects when the device has no haptics", async (_name, fire) => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      mocks.state.fail = true;
      expect(fire()).toBeUndefined();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("reads the switch on every call, so flipping it applies to the very next tap", () => {
    hapticLight();
    mocks.state.enabled = false;
    hapticLight();
    mocks.state.enabled = true;
    hapticLight();
    expect(mocks.state.calls).toEqual(["impact:light", "impact:light"]);
  });
});
