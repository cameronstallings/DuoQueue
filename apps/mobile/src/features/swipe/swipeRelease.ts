import type { SwipeDirection } from "./types";

/**
 * What a card does when the finger lets go of it, and how it leaves. Pure, so the numbers are
 * tested in node (swipeRelease.test.ts); every function is a worklet because SwipeCard's pan
 * gesture calls them on the UI thread in `onEnd`.
 *
 * WHY THE VELOCITY COUNTS NOW. Up to 1.0.1 only distance decided: past 120pt the swipe counted,
 * short of it the card sprang home, however hard it was thrown. A quick flick of the thumb, the
 * most natural way to dismiss a card on a phone, travelled 40 or 60pt and snapped back, so it
 * felt like the deck had ignored you. Now a flick faster than 800pt/s counts once it has moved
 * 32pt the same way (less than that is a tap with a twitch, not a throw), and a card dragged past
 * the threshold can still be cancelled by throwing it back the other way just as hard.
 *
 * WHY THE EXIT MATCHES THE THROW. The card used to leave on a fixed 200ms (gesture) or 250ms
 * (button) linear timing, whatever speed it was released at, so a hard throw braked and a slow
 * drag lurched. The exit runs on Easing.out(quad), which starts at twice its average speed: a
 * duration of 2000 x distance / speed (ms) makes the card leave at exactly the speed the finger
 * gave it, clamped to 140..320ms so a gentle release still goes and a violent one still reads.
 * The vertical drift is carried the same way (exitY), so the card keeps its angle of travel
 * instead of snapping level as it goes.
 *
 * The numbers are first guesses to confirm on a ProMotion iPhone (plan Q19).
 */

/** Past this many points either way, a release counts (unless thrown back, see below). */
export const SWIPE_THRESHOLD = 120;
/** A release faster than this (pt/s) is a flick. */
export const FLING_VELOCITY = 800;
/** A flick counts only once the card has moved at least this far its way. */
export const FLING_MIN_TRAVEL = 32;
/** The fastest and slowest a decided card leaves the screen. */
export const EXIT_MIN_MS = 140;
export const EXIT_MAX_MS = 320;
/** How far past the window's edge a leaving card goes, so its rotated corner clears too. */
export const OFFSCREEN_MARGIN = 120;
/** How far a blocked swipe (the free limit) nudges the card before it springs back. */
export const BLOCKED_NUDGE = 28;

/**
 * The swipe a release means, or null for "spring back home". `tx` is the card's horizontal
 * travel (pt), `vx` the release velocity (pt/s), both positive to the right (like).
 *
 * - Past the threshold it counts, unless it was thrown back faster than FLING_VELOCITY the other
 *   way (changing your mind mid-drag works).
 * - Short of it, a flick faster than FLING_VELOCITY counts when it moved at least
 *   FLING_MIN_TRAVEL the same way.
 * - Anything else is null.
 */
export function releaseDecision(tx: number, vx: number): SwipeDirection | null {
  "worklet";
  if (Math.abs(tx) > SWIPE_THRESHOLD) {
    const thrownBack = Math.sign(vx) === -Math.sign(tx) && Math.abs(vx) > FLING_VELOCITY;
    if (thrownBack) return null;
    return tx > 0 ? "like" : "pass";
  }
  if (Math.abs(vx) > FLING_VELOCITY && Math.abs(tx) >= FLING_MIN_TRAVEL && Math.sign(tx) === Math.sign(vx)) {
    return tx > 0 ? "like" : "pass";
  }
  return null;
}

/**
 * How long the decided card takes to leave: `remaining` points to go at `speed` pt/s in the
 * direction it is leaving (negative or zero when it is drifting the other way or still). Out-quad
 * starts at twice its average speed, so 2000 x remaining / speed matches the release velocity;
 * clamped to EXIT_MIN_MS..EXIT_MAX_MS, and the slowest exit when there is no speed its way.
 */
export function exitDuration(remaining: number, speed: number): number {
  "worklet";
  if (speed <= 0) return EXIT_MAX_MS;
  const ms = (2000 * remaining) / speed;
  return Math.round(Math.min(EXIT_MAX_MS, Math.max(EXIT_MIN_MS, ms)));
}

/** Where the card ends up vertically after `ms` on the same out-quad: its vertical travel `ty`
 * plus the drift its release velocity `vy` carries (the curve's average speed is half the start). */
export function exitY(ty: number, vy: number, ms: number): number {
  "worklet";
  return ty + (vy * ms) / 2000;
}

/** The horizontal distance at which a card of this window is fully off screen. */
export function offscreenX(windowWidth: number): number {
  "worklet";
  return windowWidth + OFFSCREEN_MARGIN;
}
