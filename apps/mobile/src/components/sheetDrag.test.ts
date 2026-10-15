import { describe, expect, it } from "vitest";

import {
  CLOSE_MAX_MS,
  CLOSE_MIN_MS,
  DISMISS_FLING_VELOCITY,
  DISMISS_FRACTION,
  DRAG_ACTIVATION,
  DRAG_SIDEWAYS_FAIL,
  RUBBER_LIMIT,
  closeDuration,
  exitFraction,
  scrimOpacity,
  sheetDragOffset,
  shouldDismiss,
  springBackVelocity,
} from "./sheetDrag";

describe("the drag constants", () => {
  it("closes past a quarter of the panel, on the deck's 800pt/s flick, and lifts at most 64pt", () => {
    expect(DISMISS_FRACTION).toBe(0.25);
    expect(DISMISS_FLING_VELOCITY).toBe(800);
    expect(RUBBER_LIMIT).toBe(64);
    expect(CLOSE_MIN_MS).toBe(140);
    expect(CLOSE_MAX_MS).toBe(280);
  });

  it("starts a drag after 10pt down and gives up after 20pt sideways, so a chip row still scrolls", () => {
    expect(DRAG_ACTIVATION).toBe(10);
    expect(DRAG_SIDEWAYS_FAIL).toBe(20);
    expect(DRAG_SIDEWAYS_FAIL).toBeGreaterThan(DRAG_ACTIVATION);
  });
});

describe("shouldDismiss", () => {
  const panel = 400; // a quarter is 100pt

  it("closes a slow release past a quarter of the panel's height", () => {
    expect(shouldDismiss(101, 0, panel)).toBe(true);
    expect(shouldDismiss(300, 200, panel)).toBe(true);
    expect(shouldDismiss(399, -100, panel)).toBe(true);
  });

  it("keeps a slow release at or short of a quarter", () => {
    expect(shouldDismiss(100, 0, panel)).toBe(false);
    expect(shouldDismiss(60, 300, panel)).toBe(false);
    expect(shouldDismiss(0, 0, panel)).toBe(false);
  });

  it("closes a downward flick faster than 800pt/s from any distance", () => {
    expect(shouldDismiss(12, 801, panel)).toBe(true);
    expect(shouldDismiss(1, 2400, panel)).toBe(true);
  });

  it("does not count a flick at exactly 800pt/s, or one that has not gone down at all", () => {
    expect(shouldDismiss(40, 800, panel)).toBe(false);
    expect(shouldDismiss(0, 1500, panel)).toBe(false);
    expect(shouldDismiss(-30, 1500, panel)).toBe(false);
  });

  it("keeps a sheet dragged past a quarter but thrown back up hard (changing your mind works)", () => {
    expect(shouldDismiss(250, -801, panel)).toBe(false);
    expect(shouldDismiss(250, -800, panel)).toBe(true);
  });

  it("never closes on an upward pull", () => {
    expect(shouldDismiss(-50, 0, panel)).toBe(false);
    expect(shouldDismiss(-200, -1200, panel)).toBe(false);
  });

  it("scales the quarter with the panel: a short menu closes sooner than a tall form", () => {
    expect(shouldDismiss(80, 0, 300)).toBe(true);
    expect(shouldDismiss(80, 0, 600)).toBe(false);
  });

  it("closes only on a flick while the panel has not reported its height", () => {
    expect(shouldDismiss(300, 0, 0)).toBe(false);
    expect(shouldDismiss(300, 0, Number.NaN)).toBe(false);
    expect(shouldDismiss(300, 0, -10)).toBe(false);
    expect(shouldDismiss(20, 1000, 0)).toBe(true);
  });

  it("keeps the sheet when the gesture reports garbage", () => {
    expect(shouldDismiss(Number.NaN, 2000, panel)).toBe(false);
    expect(shouldDismiss(300, Number.NaN, panel)).toBe(false);
    expect(shouldDismiss(Number.POSITIVE_INFINITY, 0, panel)).toBe(false);
  });
});

describe("sheetDragOffset", () => {
  it("follows the finger one to one downward", () => {
    expect(sheetDragOffset(0)).toBe(0);
    expect(sheetDragOffset(1)).toBe(1);
    expect(sheetDragOffset(137.5)).toBe(137.5);
    expect(sheetDragOffset(900)).toBe(900);
  });

  it("resists upward: the panel lifts less than the finger, and less and less", () => {
    const small = sheetDragOffset(-20);
    const large = sheetDragOffset(-200);
    expect(small).toBeLessThan(0);
    expect(small).toBeGreaterThan(-20);
    expect(large).toBeLessThan(small);
    expect(large).toBeGreaterThan(-200);
    // Starts at UIScrollView's 0.55 and stiffens from there.
    expect(sheetDragOffset(-1)).toBeCloseTo(-0.55, 1);
    expect(-large / 200).toBeLessThan(-small / 20);
  });

  it("never lifts the panel past the limit, however far the finger goes", () => {
    expect(sheetDragOffset(-10_000)).toBeGreaterThan(-RUBBER_LIMIT);
    expect(sheetDragOffset(-1_000_000)).toBeGreaterThan(-RUBBER_LIMIT);
    expect(sheetDragOffset(-1_000_000)).toBeLessThan(-RUBBER_LIMIT + 1);
  });

  it("is monotonic across zero, so the panel never jumps as the finger crosses where it started", () => {
    let previous = sheetDragOffset(-400);
    for (let t = -399; t <= 400; t += 1) {
      const next = sheetDragOffset(t);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
  });

  it("stays put on a non-number", () => {
    expect(sheetDragOffset(Number.NaN)).toBe(0);
  });
});

describe("closeDuration", () => {
  it("leaves at the release speed on out-quad (2000 x distance / speed)", () => {
    expect(closeDuration(300, 3000)).toBe(200);
    expect(closeDuration(200, 2000)).toBe(200);
  });

  it("clamps a violent flick and a gentle release", () => {
    expect(closeDuration(300, 100_000)).toBe(CLOSE_MIN_MS);
    expect(closeDuration(300, 900)).toBe(CLOSE_MAX_MS);
  });

  it("takes the slowest close when there is no downward speed", () => {
    expect(closeDuration(300, 0)).toBe(CLOSE_MAX_MS);
    expect(closeDuration(300, -500)).toBe(CLOSE_MAX_MS);
    expect(closeDuration(300, Number.NaN)).toBe(CLOSE_MAX_MS);
  });

  it("takes the quickest close when there is nowhere left to go", () => {
    expect(closeDuration(0, 1200)).toBe(CLOSE_MIN_MS);
    expect(closeDuration(-20, 1200)).toBe(CLOSE_MIN_MS);
  });
});

describe("springBackVelocity", () => {
  // The spring back runs with overshootClamping, and Reanimated 4.1.7 ends a clamped spring at
  // its target the first frame it leaves the band between where it started and rest, in EITHER
  // direction (springUtils.ts, isAnimationTerminatingCalculation). A speed pointing away from
  // rest leaves that band on frame one, so the panel would jump home in a single frame.

  it("keeps the release speed when it already points home", () => {
    expect(springBackVelocity(80, -500)).toBe(-500);
    expect(springBackVelocity(80, -3000)).toBe(-3000);
    expect(springBackVelocity(-40, 900)).toBe(900);
  });

  it("drops a speed that points away from rest, so the panel springs back instead of jumping", () => {
    // Pulled down less than a quarter and let go still moving down (the common change of mind).
    expect(springBackVelocity(80, 200)).toBe(0);
    expect(springBackVelocity(100, 780)).toBe(0);
    // Rubber-banded up and flicked further up.
    expect(springBackVelocity(-40, -900)).toBe(0);
  });

  it("starts from still at rest or when the gesture reports garbage", () => {
    expect(springBackVelocity(0, 500)).toBe(0);
    expect(springBackVelocity(0, -500)).toBe(0);
    expect(springBackVelocity(Number.NaN, -500)).toBe(0);
    expect(springBackVelocity(80, Number.NaN)).toBe(0);
    expect(springBackVelocity(80, Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("exitFraction", () => {
  it("is how far down the panel already is, as a share of its height", () => {
    expect(exitFraction(100, 400)).toBe(0.25);
    expect(exitFraction(300, 400)).toBe(0.75);
  });

  it("is never past fully out or above rest", () => {
    expect(exitFraction(500, 400)).toBe(1);
    expect(exitFraction(-20, 400)).toBe(0);
  });

  it("is fully out when there is no height to measure against (the panel is not drawn yet)", () => {
    expect(exitFraction(100, 0)).toBe(1);
    expect(exitFraction(100, Number.NaN)).toBe(1);
    expect(exitFraction(Number.NaN, 400)).toBe(1);
  });
});

describe("scrimOpacity", () => {
  it("is full at rest and while the panel is lifted", () => {
    expect(scrimOpacity(0, 400)).toBe(1);
    expect(scrimOpacity(-40, 400)).toBe(1);
  });

  it("lightens in step with how far the panel has gone down", () => {
    expect(scrimOpacity(100, 400)).toBe(0.75);
    expect(scrimOpacity(200, 400)).toBe(0.5);
    expect(scrimOpacity(400, 400)).toBe(0);
    expect(scrimOpacity(800, 400)).toBe(0);
  });

  it("stays full before the panel has a height", () => {
    expect(scrimOpacity(100, 0)).toBe(1);
    expect(scrimOpacity(100, Number.NaN)).toBe(1);
  });
});
