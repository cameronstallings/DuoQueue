/**
 * Reanimated's spring in closed form, so the launch intro's timing can be derived and tested in
 * node. Pure, zero imports: launchTiming.ts (and through it scripts/generate-launch-splash.ts)
 * loads this outside React Native.
 *
 * withSpring (react-native-reanimated 4.1.7, springUtils.ts underDampedSpringCalculations) moves a
 * value by m x'' = -k (x - to) - c x' with the start velocity in value units per SECOND, and steps
 * that closed form frame by frame from the current state: the same curve, sampled at each frame.
 * Only underdamped springs (damping ratio below 1) are used, so only that branch is here.
 */

export interface SpringPhysics {
  stiffness: number;
  damping: number;
  mass: number;
  /** The start velocity, value units per second. */
  velocity?: number;
}

export interface SpringState {
  value: number;
  /** Value units per second. */
  velocity: number;
}

/** zeta (the damping ratio), omega0 and omega1, as Reanimated's initialCalculations. */
export function springShape({ stiffness, damping, mass }: SpringPhysics): { zeta: number; omega0: number; omega1: number } {
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const omega0 = Math.sqrt(stiffness / mass);
  if (!(zeta > 0 && zeta < 1)) throw new Error(`only underdamped springs are modelled here (zeta ${zeta})`);
  return { zeta, omega0, omega1: omega0 * Math.sqrt(1 - zeta ** 2) };
}

/** Where a spring released at `from` (at its config's velocity) is `ms` later, heading for `to`. */
export function springAt(config: SpringPhysics, from: number, to: number, ms: number): SpringState {
  const { zeta, omega0, omega1 } = springShape(config);
  const t = Math.max(0, ms) / 1000;
  const x0 = from - to;
  const v0 = config.velocity ?? 0;
  const sin1 = Math.sin(omega1 * t);
  const cos1 = Math.cos(omega1 * t);
  const envelope = Math.exp(-zeta * omega0 * t);
  const frag = envelope * (sin1 * ((v0 + zeta * omega0 * x0) / omega1) + x0 * cos1);
  const velocity = -zeta * omega0 * frag + envelope * (cos1 * (v0 + zeta * omega0 * x0) - omega1 * x0 * sin1);
  return { value: to + frag, velocity };
}

/**
 * The first instant, in ms, a spring released at rest at `from` reaches `to`: where an overshooting
 * spring first crosses its target. Bisected on the closed form to a microsecond.
 */
export function springFirstReachMs(config: SpringPhysics, from: number, to: number, maxMs = 5000): number {
  const side = Math.sign(from - to);
  if (side === 0) return 0;
  const past = (ms: number) => Math.sign(springAt(config, from, to, ms).value - to) !== side;
  let lo = 0;
  let hi = 0;
  for (let ms = 0.1; ms <= maxMs; ms += 0.1) {
    if (past(ms)) {
      hi = ms;
      break;
    }
    lo = ms;
  }
  if (hi === 0) throw new Error(`the spring never reaches ${to} within ${maxMs}ms`);
  while (hi - lo > 1e-3) {
    const mid = (lo + hi) / 2;
    if (past(mid)) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** The value's lowest and highest points between `fromMs` and `toMs`, sampled every 0.05ms. */
export function springRange(
  config: SpringPhysics,
  from: number,
  to: number,
  fromMs: number,
  toMs: number,
): { min: number; max: number; maxAtMs: number } {
  let min = Infinity;
  let max = -Infinity;
  let maxAtMs = fromMs;
  for (let ms = fromMs; ms <= toMs; ms += 0.05) {
    const { value } = springAt(config, from, to, ms);
    if (value < min) min = value;
    if (value > max) {
      max = value;
      maxAtMs = ms;
    }
  }
  return { min, max, maxAtMs };
}

/**
 * When Reanimated calls the spring finished: the first frame at which its energy (spring plus
 * motion) has fallen to energyThreshold (6e-9 by default) of the energy it started with. Checked
 * at 60fps, as the device checks it. withSpring's completion callback fires here, which for an
 * overshooting spring is long after the value first reached its target.
 */
export function springDoneMs(config: SpringPhysics, from: number, to: number, energyThreshold = 6e-9): number {
  const energy = (x: number, v: number) => 0.5 * config.stiffness * x ** 2 + 0.5 * config.mass * v ** 2;
  const start = energy(from - to, config.velocity ?? 0);
  for (let frame = 1; frame <= 600; frame++) {
    const ms = (frame * 1000) / 60;
    const { value, velocity } = springAt(config, from, to, ms);
    if (energy(value - to, velocity) <= energyThreshold * start) return ms;
  }
  throw new Error("the spring is still moving after ten seconds");
}
