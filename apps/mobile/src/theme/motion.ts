/**
 * The motion constants every animated surface shares: the four springs, the list stagger, and the
 * rule for which entrance a list row gets. Pure, zero imports, so the numbers are tested in node
 * (motion.test.ts checks every spring's damping ratio with the launch intro's closed-form maths).
 * The Reanimated builders that use these live next door in `entering.ts`.
 *
 * THE PARTIAL-CONFIG TRAP, and the reason every spring here spells out all three numbers.
 * Reanimated 4.1.7 does not fill a missing key of a spring config with a sensible default: it
 * merges what you pass OVER its own defaults, which are mass 4, stiffness 900, damping 120. So
 * `withSpring(1, { damping: 16, stiffness: 180 })` (what the chat rows used to pass) is really a
 * spring of mass 4, four times as heavy as intended, and it wobbles on for seconds instead of
 * settling. The same goes for a builder chain: `.springify().damping(16).stiffness(180)` never
 * sets mass, so it runs at mass 4 too.
 *
 * The rule: every `withSpring` and every `.springify()` in the app takes a FULL config, from
 * SPRINGS or a spread of one (`{ ...SPRINGS.release, velocity }`), or a builder chain that also
 * calls `.mass(1)` (`stackSpringEntering` does). The final verification greps for it.
 *
 * Damping ratios (zeta = damping / (2 * sqrt(stiffness * mass))), all inside 0.55 to 0.95, which
 * is the band where a spring overshoots once, a little, and stops:
 *   press   0.667  a finger going down: quick, one small dip
 *   release 0.620  letting go and snap-backs: a touch livelier so the return reads as a bounce
 *   stack   0.742  the card behind rising to the front (about 360ms)
 *   sheet   0.904  a sheet panel arriving: almost critically damped, a sheet never bounces much
 */

export const SPRINGS = {
  press: { mass: 1, stiffness: 380, damping: 26 },
  release: { mass: 1, stiffness: 260, damping: 20 },
  stack: { mass: 1, stiffness: 220, damping: 22 },
  sheet: { mass: 1, stiffness: 240, damping: 28 },
} as const;

export type SpringName = keyof typeof SPRINGS;

/** One row's step in a list cascade. */
export const STAGGER_STEP_MS = 45;
/** No row waits longer than this, however far down the list it is. */
export const STAGGER_CAP_MS = 400;

/** The delay before row `index` starts its entrance: 45ms a row, capped at 400ms. A negative,
 * fractional or non-numeric index floors to the nearest real row (never below 0). */
export function staggerDelay(index: number): number {
  const row = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return Math.min(row * STAGGER_STEP_MS, STAGGER_CAP_MS);
}

/**
 * How a list row arrives:
 * - "none": the row was already on screen (a refetch must never replay an entrance);
 * - "stagger": the list's first reveal, so rows cascade in with `staggerDelay`;
 * - "fade": a row that arrives later (a new match while you look) fades in on its own.
 */
export type Entrance = "stagger" | "fade" | "none";

export function entranceKind({ seen, firstReveal }: { seen: boolean; firstReveal: boolean }): Entrance {
  if (seen) return "none";
  return firstReveal ? "stagger" : "fade";
}
