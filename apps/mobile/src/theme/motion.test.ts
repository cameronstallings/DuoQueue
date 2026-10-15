import { describe, expect, it } from "vitest";

import { springFirstReachMs, springShape } from "../features/launch/springMath";

import { entranceKind, SPRINGS, STAGGER_CAP_MS, STAGGER_STEP_MS, staggerDelay } from "./motion";

describe("SPRINGS", () => {
  const entries = Object.entries(SPRINGS);

  it("names the four springs the app uses", () => {
    expect(Object.keys(SPRINGS).sort()).toEqual(["press", "release", "sheet", "stack"]);
  });

  it.each(entries)("%s is a FULL config with mass 1", (_name, config) => {
    // A partial config is merged over Reanimated 4.1.7's defaults (mass 4, stiffness 900,
    // damping 120), so every key has to be there or the spring is not the one written down.
    expect(config.mass).toBe(1);
    expect(typeof config.stiffness).toBe("number");
    expect(typeof config.damping).toBe("number");
  });

  it.each(entries)("%s settles without wobble (damping ratio 0.55 to 0.95)", (_name, config) => {
    const { zeta } = springShape(config);
    expect(zeta).toBeGreaterThanOrEqual(0.55);
    expect(zeta).toBeLessThanOrEqual(0.95);
  });

  it("has the damping ratios the plan measured", () => {
    expect(springShape(SPRINGS.press).zeta).toBeCloseTo(0.667, 3);
    expect(springShape(SPRINGS.release).zeta).toBeCloseTo(0.62, 3);
    expect(springShape(SPRINGS.stack).zeta).toBeCloseTo(0.742, 3);
    expect(springShape(SPRINGS.sheet).zeta).toBeCloseTo(0.904, 3);
  });

  it("the press spring reaches the pressed scale inside a tap", () => {
    // 1 to 0.97 lands in about 160ms (a tap is held for roughly 100 to 200ms); anything much
    // slower and the press reads as lag rather than as the button giving way.
    expect(springFirstReachMs(SPRINGS.press, 1, 0.97)).toBeLessThan(200);
  });
});

describe("staggerDelay", () => {
  it("steps 45ms per row", () => {
    expect(STAGGER_STEP_MS).toBe(45);
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(45);
    expect(staggerDelay(3)).toBe(135);
  });

  it("caps at 400ms so a long list never waits", () => {
    expect(STAGGER_CAP_MS).toBe(400);
    expect(staggerDelay(8)).toBe(360);
    expect(staggerDelay(9)).toBe(400);
    expect(staggerDelay(10)).toBe(400);
    expect(staggerDelay(500)).toBe(400);
  });

  it("treats a negative or fractional index as the row it floors to", () => {
    expect(staggerDelay(-1)).toBe(0);
    expect(staggerDelay(-0.5)).toBe(0);
    expect(staggerDelay(2.9)).toBe(90);
  });

  it("never returns NaN", () => {
    expect(staggerDelay(Number.NaN)).toBe(0);
  });
});

describe("entranceKind", () => {
  it.each([
    { seen: true, firstReveal: true, kind: "none" },
    { seen: true, firstReveal: false, kind: "none" },
    { seen: false, firstReveal: true, kind: "stagger" },
    { seen: false, firstReveal: false, kind: "fade" },
  ] as const)("seen $seen, firstReveal $firstReveal gives $kind", ({ seen, firstReveal, kind }) => {
    expect(entranceKind({ seen, firstReveal })).toBe(kind);
  });
});
