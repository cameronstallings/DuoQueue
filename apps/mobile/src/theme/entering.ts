import {
  type ComplexAnimationBuilder,
  Easing,
  type EntryOrExitLayoutType,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

import { type Entrance, SPRINGS, staggerDelay } from "./motion";
import { motion } from "./tokens";

/**
 * The Reanimated entering, exiting and layout builders the whole app shares, so "fades in" means
 * the same 220ms everywhere and nobody writes a new spring by hand. Use these rather than writing
 * new ones; the numbers live in `tokens.ts` (durations) and `motion.ts` (springs, stagger).
 *
 * EVERY CALL RETURNS A FRESH BUILDER. Reanimated builders are mutable objects (`.delay(100)` on
 * an instance changes that instance), so a module-level constant shared by every row would let
 * one row's delay leak into the next. Calling the function per render is cheap and safe.
 *
 * REDUCE MOTION. Movement keeps Reanimated's default, `ReduceMotion.System`, which cuts the
 * animation when the phone asks for less motion. A fade is not motion, so every fade here passes
 * `ReduceMotion.Never` and still plays: with Reduce Motion on, things still arrive gently instead
 * of popping in, they just do not slide or bounce.
 *
 * Untested on purpose: these only assemble Reanimated objects, and vitest has no Reanimated. The
 * decisions they depend on (`staggerDelay`, `entranceKind`, the springs) are tested in
 * `motion.test.ts`.
 */

/** The standard arrival for content that was not there a moment ago: an empty state, a block that
 * finished loading, a step of a wizard. A plain fade over motion.reveal (220ms), even under
 * Reduce Motion. */
export function revealEntering() {
  return FadeIn.duration(motion.reveal).reduceMotion(ReduceMotion.Never);
}

/** A small, quick arrival (motion.quick, 140ms): a count updating, a typing line, an inline error. */
export function quickEntering() {
  return FadeIn.duration(motion.quick).reduceMotion(ReduceMotion.Never);
}

/** The matching quick departure, so a thing that fades in never just vanishes. */
export function quickExiting() {
  return FadeOut.duration(motion.quick).reduceMotion(ReduceMotion.Never);
}

/**
 * Row `index` of a list on its first reveal: rises 25pt and fades over motion.deliberate, 45ms
 * after the row above it (capped at 400ms). Under Reduce Motion (`reduced`, from
 * `useReducedMotion()`) it is a plain fade with no delay: no slide and no stagger.
 */
export function listItemEntering(index: number, reduced: boolean) {
  if (reduced) return revealEntering();
  return FadeInDown.duration(motion.deliberate).delay(staggerDelay(index)).easing(Easing.out(Easing.cubic));
}

/**
 * The entrance a list row gets, from `entranceKind` in motion.ts: undefined for a row already seen
 * (a refetch never replays an entrance), the cascade on the list's first reveal, a lone fade for a
 * row that arrives later.
 */
export function entranceFor(kind: Entrance, index: number, reduced: boolean): EntryOrExitLayoutType | undefined {
  if (kind === "none") return undefined;
  if (kind === "stagger") return listItemEntering(index, reduced);
  return revealEntering();
}

/** For a container whose children come and go: its size and position glide over motion.base
 * instead of jumping. Movement, so Reduce Motion cuts it. */
export function layoutTransition() {
  return LinearTransition.duration(motion.base);
}

/**
 * A spring arrival on SPRINGS.stack with all three numbers set, e.g.
 * `stackSpringEntering(FadeInUp)` for a new chat row. `.springify()` alone, or with only damping
 * and stiffness, runs at Reanimated's default mass of 4 and wobbles for seconds (motion.ts
 * header), so this is the only way the app springifies a builder.
 *
 * Takes the builder class (`FadeInUp`) or an instance (`FadeInUp.delay(80)`).
 */
export function stackSpringEntering(builder: { springify(duration?: number): ComplexAnimationBuilder }) {
  return builder.springify().mass(1).stiffness(SPRINGS.stack.stiffness).damping(SPRINGS.stack.damping);
}
