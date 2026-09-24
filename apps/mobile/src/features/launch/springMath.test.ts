import { describe, expect, it } from "vitest";

import { type SpringPhysics, springAt, springDoneMs, springFirstReachMs, springRange, springShape } from "./springMath";

/** An independent check: plain RK4 on m x'' = -k (x - to) - c x', stepped at 0.01ms. */
function integrate(config: SpringPhysics, from: number, to: number, ms: number): { value: number; velocity: number } {
  const { stiffness: k, damping: c, mass: m } = config;
  const dt = 1e-5;
  const acc = (x: number, v: number) => (-k * (x - to) - c * v) / m;
  let x = from;
  let v = config.velocity ?? 0;
  const steps = Math.round(ms / 1000 / dt);
  for (let i = 0; i < steps; i++) {
    const k1x = v;
    const k1v = acc(x, v);
    const k2x = v + 0.5 * dt * k1v;
    const k2v = acc(x + 0.5 * dt * k1x, v + 0.5 * dt * k1v);
    const k3x = v + 0.5 * dt * k2v;
    const k3v = acc(x + 0.5 * dt * k2x, v + 0.5 * dt * k2v);
    const k4x = v + dt * k3v;
    const k4v = acc(x + dt * k3x, v + dt * k3v);
    x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }
  return { value: x, velocity: v };
}

const RUSH = { stiffness: 225, damping: 18, mass: 1 };
const POP = { stiffness: 400, damping: 20, mass: 1, velocity: 2.9288 };

describe("springAt", () => {
  it("is Reanimated's closed form: the physics, to 1e-9", () => {
    for (const [config, from, to] of [
      [RUSH, -0.07, 1],
      [POP, 1, 1],
      [{ stiffness: 420, damping: 24, mass: 1 }, 0, 1],
    ] as const) {
      for (const ms of [10, 77, 184.5, 400, 900]) {
        const exact = integrate(config, from, to, ms);
        const closed = springAt(config, from, to, ms);
        expect(Math.abs(closed.value - exact.value)).toBeLessThan(1e-9);
        expect(Math.abs(closed.velocity - exact.velocity)).toBeLessThan(1e-6);
      }
    }
  });

  it("starts where it is released, at the config's velocity (units per second)", () => {
    const rush = springAt(RUSH, -0.07, 1, 0);
    expect(rush.value).toBeCloseTo(-0.07, 12);
    expect(rush.velocity).toBeCloseTo(0, 12);
    const start = springAt(POP, 1, 1, 0);
    expect(start.value).toBe(1);
    expect(start.velocity).toBeCloseTo(2.9288, 12);
  });

  it("models only underdamped springs, and says so", () => {
    expect(springShape(RUSH).zeta).toBeCloseTo(0.6, 12);
    expect(() => springShape({ stiffness: 100, damping: 20, mass: 1 })).toThrow(/underdamped/);
  });
});

describe("springFirstReachMs", () => {
  it("finds where a spring from rest first crosses its target, as the closed form has it", () => {
    // From rest: x0 (cos w1 t + (zeta w0 / w1) sin w1 t) = 0 first at w1 t = pi - atan(w1 / (zeta w0)).
    const { zeta, omega0, omega1 } = springShape(RUSH);
    const exact = ((Math.PI - Math.atan(omega1 / (zeta * omega0))) / omega1) * 1000;
    expect(springFirstReachMs(RUSH, -0.07, 1)).toBeCloseTo(exact, 2);
    expect(springFirstReachMs(RUSH, -0.07, 1)).toBeCloseTo(184.5, 1);
  });

  it("is zero for a spring already at its target, and fails loudly for one that never gets there", () => {
    expect(springFirstReachMs(RUSH, 1, 1)).toBe(0);
    expect(() => springFirstReachMs(RUSH, 0, 1, 50)).toThrow(/never reaches/);
  });
});

describe("springRange", () => {
  it("finds the overshoot's peak and when it comes", () => {
    const { max, maxAtMs } = springRange(POP, 1, 1, 0, 400);
    expect(max).toBeCloseTo(1.08, 4);
    expect(maxAtMs).toBeCloseTo(60.5, 0);
  });
});

describe("springDoneMs", () => {
  it("is when Reanimated calls an overshooting spring finished: long after it first arrives", () => {
    const done = springDoneMs(RUSH, -0.07, 1);
    // 1083.9ms by a 0.1ms scan; the device checks once a frame, so the first frame past it.
    expect(done).toBeGreaterThanOrEqual(1083.9);
    expect(done).toBeLessThan(1083.9 + 1000 / 60);
    expect(done - springFirstReachMs(RUSH, -0.07, 1)).toBeGreaterThan(890);
  });
});
