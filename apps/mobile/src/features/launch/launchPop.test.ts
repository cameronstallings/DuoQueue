import { beforeEach, describe, expect, it, vi } from "vitest";

import { launchPopKick } from "./launchPop";
import { LAUNCH_POP_SPRING } from "./launchTiming";
import { springAt, springDoneMs } from "./springMath";

/*
 * The pop, run through Reanimated's own shipped code (4.1.7) as the UI thread runs it: the value
 * setter a shared value calls (valueSetter.js), withDelay and withSpring, all as they are in
 * node_modules. Only what that code imports from the native side is stubbed: react-native's
 * Platform, react-native-worklets' serialisation (its RuntimeKind is the real one) and the system
 * Reduce Motion setting. vitest.config.mts inlines react-native-reanimated so the stubs reach its
 * modules. The frames are stepped by hand.
 *
 * springMath.test.ts checks the spring's maths; it cannot see that Reanimated's setter drops a
 * spring whose target is the value it starts from, which is exactly the pop: kicked at rest at 1.
 */

vi.hoisted(() => {
  // Reanimated's modules read these as they load: a release build, on the UI runtime.
  const g = globalThis as { __DEV__?: boolean; __RUNTIME_KIND?: number };
  g.__DEV__ = false;
  g.__RUNTIME_KIND = 2; // RuntimeKind.UI
});

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("react-native-worklets", async () => {
  const { RuntimeKind } = await vi.importActual<{ RuntimeKind: Record<string, number> }>(
    "react-native-worklets/lib/module/runtimeKind.js",
  );
  return {
    RuntimeKind,
    createSerializable: (value: unknown) => value,
    isWorkletFunction: () => true,
    runOnUI: (fn: unknown) => fn,
    serializableMappingCache: new Map(),
  };
});
vi.mock("react-native-reanimated/lib/module/ReducedMotion", () => ({
  ReducedMotionManager: { jsValue: false, uiValue: { value: false } },
}));
// launchPop.ts imports these two from the package; they are the shipped ones.
vi.mock("react-native-reanimated", async () => {
  const { withDelay } = await vi.importActual<{ withDelay: unknown }>("react-native-reanimated/lib/module/animation/delay");
  const { withSpring } = await vi.importActual<{ withSpring: unknown }>("react-native-reanimated/lib/module/animation/spring");
  return { withDelay, withSpring };
});

interface Mutable {
  _value: number;
  _animation: unknown;
  readonly value: number;
}
type Frame = (timestamp: number) => void;

const { valueSetter } = await vi.importActual<{ valueSetter: (mutable: Mutable, value: unknown) => void }>(
  "react-native-reanimated/lib/module/valueSetter",
);
const { withSpring } = await vi.importActual<{ withSpring: (to: number, config: object) => unknown }>(
  "react-native-reanimated/lib/module/animation/spring",
);

let queued: Frame[] = [];
beforeEach(() => {
  queued = [];
  vi.stubGlobal("requestAnimationFrame", (callback: Frame) => queued.push(callback));
});

const KICK_AT = 10_000;
const g = globalThis as { __frameTimestamp?: number };

/**
 * A shared value resting at `initial` is set to `animation` inside the UI frame at KICK_AT, as the
 * lock's reaction sets it, then the frames are stepped every `frameMs` until the animation stops
 * asking for them. The value after each frame, by ms since the kick.
 */
function kick(initial: number, animation: unknown, frameMs: number): { ms: number; value: number }[] {
  const mutable: Mutable = {
    _value: initial,
    _animation: null,
    get value() {
      return this._value;
    },
  };
  g.__frameTimestamp = KICK_AT;
  valueSetter(mutable, animation);
  g.__frameTimestamp = undefined;
  const trace = [{ ms: 0, value: mutable._value }];
  for (let frame = 1; queued.length > 0; frame++) {
    if (frame > 1000) throw new Error("still animating after 1000 frames");
    const due = queued;
    queued = [];
    for (const callback of due) callback(KICK_AT + frame * frameMs);
    trace.push({ ms: frame * frameMs, value: mutable._value });
  }
  return trace;
}

describe("Reanimated's setter, as the harness runs it", () => {
  it("drops a bare spring to 1 from rest at 1: the pop as first built never ran", () => {
    const trace = kick(1, withSpring(1, LAUNCH_POP_SPRING), 1000 / 120);
    expect(trace).toEqual([{ ms: 0, value: 1 }]);
  });

  it("runs the same spring from anywhere else", () => {
    const trace = kick(1.0001, withSpring(1, LAUNCH_POP_SPRING), 1000 / 120);
    expect(trace.length).toBeGreaterThan(10);
    expect(Math.max(...trace.map((f) => f.value))).toBeGreaterThan(1.07);
  });
});

describe("launchPopKick", () => {
  for (const hz of [120, 60]) {
    it(`pops the mark from rest at 1 to 1.08 about 60ms after the lock, and back, at ${hz}Hz`, () => {
      const frameMs = 1000 / hz;
      const trace = kick(1, launchPopKick(), frameMs);
      // Every frame on the spring's own curve, from the lock's frame: the velocity is 2.9288,
      // not lost and not added to anything.
      for (const { ms, value } of trace.slice(0, -1)) {
        expect(value).toBeCloseTo(springAt(LAUNCH_POP_SPRING, 1, 1, ms).value, 9);
      }
      // It moves from the very next frame.
      expect(trace[1]?.value).toBeGreaterThan(1.01);
      const peak = trace.reduce((a, b) => (b.value > a.value ? b : a));
      expect(peak.value).toBeGreaterThan(1.0785);
      expect(peak.value).toBeLessThanOrEqual(1.08);
      expect(Math.abs(peak.ms - 60.5)).toBeLessThanOrEqual(frameMs / 2);
      // Then it settles at exactly 1, and asks for no more frames.
      expect(trace.at(-1)).toEqual({ ms: expect.any(Number), value: 1 });
      expect(trace.at(-1)?.ms).toBeLessThan(springDoneMs(LAUNCH_POP_SPRING, 1, 1) + frameMs);
    });
  }
});
