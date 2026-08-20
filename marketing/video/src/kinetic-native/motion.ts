/**
 * The motion doctrine, translated from a timeline runtime into frames.
 *
 * Every number below comes from `.claude/skills/motion-doctrine/SKILL.md` and
 * `.claude/skills/cut-the-curve/SKILL.md`. Those skills are written against GSAP, which is a
 * timeline library with named eases; Remotion is frame based and takes an easing function per
 * interpolation. The principles and the parameters carry over exactly, the API does not, so
 * the translation is done once here and nowhere else in this direction.
 *
 *   power4.in    ->  Easing.in(Easing.poly(4))
 *   power4.out   ->  Easing.out(Easing.poly(4))
 *   power3.in    ->  Easing.in(Easing.poly(3))
 *   expo.out     ->  Easing.out(Easing.exp)
 *
 * Durations are written as an explicit division at 30fps rather than as a bare frame count,
 * so the number in the skill and the number in the code can be compared without arithmetic.
 * At 30fps 0.6s is 18 frames; that division is done here, once, per constant.
 *
 * Two eases are forbidden outright by the doctrine and appear nowhere in this directory:
 * bounce.out and elastic.out. Remotion's `spring()` with a low damping is the same thing by
 * another name, which is why the word entrances in this direction are interpolations and not
 * springs. Direction B used underdamped springs everywhere; that is the single biggest reason
 * its cuts read as unmatched, because a spring starts from rest and the doctrine's whole
 * argument is that starting from rest after a cut is a dead beat.
 */
import { Easing } from "remotion";

import { FPS, VIDEO_W } from "@/lib/scale";

/** Seconds to frames. Written out at every call site so a duration is readable as the skill
 * wrote it, not as a frame count somebody has to divide back. */
export const sec = (seconds: number): number => seconds * FPS;

export const EASE = {
  power4In: Easing.in(Easing.poly(4)),
  power4Out: Easing.out(Easing.poly(4)),
  power3In: Easing.in(Easing.poly(3)),
  expoOut: Easing.out(Easing.exp),
  linear: Easing.linear,
} as const;

/**
 * Partial travel. The doctrine's figure is "about 12% of frame, 230px at 1920", measured on
 * the axis the move happens along. This film is 1080x1920 and its current is horizontal, so
 * the axis dimension is the 1080 and the travel is 130px. Using 230 here would be 21% of the
 * frame, which is a push rather than a curve, and a full off screen move is exactly what the
 * skill's anti pattern table forbids.
 */
export const TRAVEL = Math.round(VIDEO_W * 0.12);

/**
 * The film's current. LEFT, the house default. Every ordinary seam in this direction uses it
 * and nothing mirrors it, because the doctrine treats a ping pong between opposing directions
 * as an error rather than as variety.
 *
 * A leftward move is negative x on the way out and positive x waiting on the way in: the
 * outgoing accelerates off to the left, the incoming is already left of where it started
 * from, off to the right, and continues the same direction into place.
 */
export const CURRENT = -1;

/**
 * Technique 3, cut the curve. The default scene boundary.
 *
 * Total 0.6s. The exit and entry are the two halves of one power4.inOut split at the cut, so
 * the incoming element's initial velocity is the outgoing element's final velocity exactly.
 * Entry is about 127% of exit, which is the doctrine's stated inversion of its own "exit is
 * 75% of entry" rule for this technique specifically.
 */
export const CURVE = {
  exit: Math.round(sec(0.27)),
  entry: Math.round(sec(0.33)),
  /**
   * Where the outgoing opacity hits zero, as a fraction of the exit's duration.
   *
   * The rule is that the fade completes at 25 to 30 percent of TRAVEL, not of time, and under
   * power4 those are very different numbers: distance is t^4, so 28% of travel is reached at
   * t = 0.28^0.25 = 0.727 of the duration. Fading on a time fraction instead would kill the
   * word at 8% of its travel, which reads as a disappearance rather than as speed.
   */
  fadeAt: 0.727,
  /** The incoming ignites mid path rather than from nothing. A binary 0 to 1 pops. */
  ignite: 0.35,
} as const;

/**
 * Technique 4, the waterfall cut. Cut the curve at word granularity, and the seam this film
 * uses at every text to text boundary. Outgoing words peel off on their own curves while the
 * incoming words cascade in mid flight, so the eye rides one wave across the cut instead of
 * being handed off between two blocks.
 *
 * The skill's parameters verbatim, converted: 0.34s exit, 0.022s exit stagger, 0.3s entry,
 * 0.05s entry gap decaying by 0.84, entry igniting at 0.35 opacity.
 */
export const WATERFALL_CUT = {
  exit: Math.round(sec(0.34)),
  /**
   * Where the outgoing opacity hits zero, as a fraction of the exit's duration.
   *
   * A DELIBERATE DEPARTURE from the catalog, made after watching a render, and the reason is
   * that the catalog gives two numbers for this parameter that do not agree with each other.
   * It says the fade is 0.18s against a 0.34s exit, which under power4 is 0.53^4 = 8% of the
   * travel. It also says the word is gone by 25 to 30% of the travel, which under power4 is
   * t = 0.72. Both were written against a 1920 wide landscape frame where the travel is
   * 230px, so 30% of it is 69px of real displacement.
   *
   * This frame is 1080 wide and the travel is 130px, so 30% of it is 39px, which is thinner
   * than the stroke of the display face at this size. On the first render every seam in the
   * film read as a crossfade rather than as a cut, and that is the note Cameron already gave
   * once about direction B. 0.84 puts the fade at 0.84^4 = 50% of the travel, 65px, which is
   * the same absolute displacement the catalog buys on its own frame. The word is still
   * accelerating when it goes, which is the rule the number actually serves.
   */
  exitFade: Math.round(sec(0.34) * 0.84),
  /** Reading order within one line, so a line peels rather than sliding as a block. */
  exitStagger: sec(0.022),
  /**
   * Between LINES, and far bigger than the within-line stagger.
   *
   * 0.022s is a per word figure for one long horizontal line. This direction stacks two to
   * four short lines instead, and at 30fps 0.022s is two thirds of a frame, so a four line
   * block staggered by it comes apart over 2 frames and reads as one block fading out.
   * 0.085s is 2.5 frames a line: the top line is a third of the way through its exit before
   * the bottom line has moved at all, which is what makes the block visibly come apart.
   * Four lines cost 7.6 frames, inside the doctrine's 15 frame total stagger ceiling.
   */
  exitLineGap: sec(0.085),
  entry: Math.round(sec(0.3)),
  ignite: 0.35,
  entryGap: sec(0.05),
  entryDecay: 0.84,
} as const;

/**
 * Technique 6, the waterfall entry. An in scene ARRIVAL, not a seam, and the model for the
 * caption rail: words whip up from below, each starting before the last has settled, gaps
 * shrinking across the cascade so it accelerates and resolves composed.
 *
 * It is deliberately NOT the same as technique 4 and the skill spells out why: an arrival's
 * opacity is binary, set at entry, because a fade fights the snap. A seam's opacity ignites
 * at 0.35 mid path, because there the fade IS the velocity trick. Mixing the two is the
 * mistake this constant exists to prevent.
 */
export const WATERFALL_ENTRY = {
  /** Velocity varies by weight: an anchor travels further and longer, punctuation snaps. */
  anchor: { lift: 74, frames: Math.round(sec(0.19)) },
  normal: { lift: 46, frames: Math.round(sec(0.15)) },
  light: { lift: 36, frames: Math.round(sec(0.12)) },
  gap: sec(0.066),
  decay: 0.84,
} as const;

/**
 * Technique 2, the inverse zoom through. A RESERVED vector: it means ARRIVAL, something
 * bigger landing, and it is spent exactly once in this film, on the payoff.
 *
 * Everything shrinks across the cut. The outgoing recedes from 1 to 0.8; the incoming arrives
 * oversized at 1.25 as if it were just behind the camera and retracts into the focal plane.
 * A grow from small entrance anywhere in that window would flip the sign and turn the arrival
 * into a push, which is the most common violation in the book, so the incoming beat composes
 * its words rather than staggering them in.
 *
 * Blur is 10px and not 18 to 20, because the subject either side is text scale. 20px smears
 * letterforms and the cut reads as a glitch.
 */
export const INVERSE = {
  exit: Math.round(sec(0.2)),
  entry: Math.round(sec(0.5)),
  exitScale: 0.8,
  entryScale: 1.25,
  blur: 10,
  /** Opacity at the swap frame, identical on both sides. */
  cut: 0.15,
} as const;

/**
 * Stillness before climax. The doctrine schedules 0.3 to 0.75s of genuine rest between the
 * major action and its result, and it is the one place in this film where nothing moves.
 * Everywhere else a still frame would be the bug; here it is the dramatic comma.
 */
export const STILLNESS = Math.round(sec(0.5));

/**
 * The camera, which is the carrier across every hard cut in the film.
 *
 * One constant velocity for the whole film: the plate pans LEFT at a fixed rate and pushes in
 * at a fixed rate, so at every cut the outgoing plate and the incoming plate are moving at
 * the same speed in the same direction and the eye reads twelve seconds as one camera move
 * rather than as nine shots. Each beat re-centres its own pan around zero so the drift never
 * exposes an edge; the absolute position resets at the cut, the velocity does not.
 *
 * This is the doctrine's "camera with intent" route, and it is explicitly not idle wobble.
 * Direction B's camera added a per frame random weave on both axes on top of a random drift.
 * That is the banned thing: motion with no destination, which reads as the video waiting.
 */
export const CAMERA = {
  /**
   * Composition pixels of leftward travel per frame.
   *
   * 4.4, not the 1.8 this started at. A camera is only a sustained motion route if a viewer
   * can see it move: 1.8px a frame across a plate that is blurred, greyscaled and sunk to
   * 36% is under two pixels of a texture with no edges in it, and on the first render every
   * beat of this film was pixel for pixel identical for about a second. The doctrine's test
   * is that pausing at any second finds something meaningful mid flight, and a camera that
   * cannot be seen fails it while technically satisfying the rule it was written for.
   *
   * 4.4px a frame is 220px over the longest beat, a fifth of the frame width, which reads
   * as travel. It is still ONE constant velocity for the whole film, which is the property
   * that matters at a cut.
   */
  pan: 4.4,
  /** Scale gained per frame. 0.0034 is 17% over a 50 frame beat: a push, not a creep. */
  push: 0.0034,
  /**
   * Base scale. Must leave more headroom than half the longest beat's pan plus half its push.
   * At 1.36 the plate is 1469px wide in a 1080px frame, so 194px each side; the longest beat
   * spends 110px of that and the push takes the scale no lower than 1.275, which still leaves
   * 148px. Both fit.
   */
  base: 1.36,
} as const;

/**
 * Cascade delay for the nth element, with the gap shrinking geometrically.
 *
 * This is the "overlap, do not queue" rule as arithmetic: the gaps between arrivals shrink by
 * `decay` each time, so the cascade accelerates and the last element snaps. Equal gaps across
 * a cascade are in the anti pattern table.
 *
 * Sum of a geometric series rather than a loop, so a word's delay does not depend on anything
 * having been computed for the words before it and a component can render one word in
 * isolation. Total stagger for eight words at gap 1.5 and decay 0.84 is about 6.6 frames,
 * inside the doctrine's 500ms ceiling with room to spare.
 */
export const cascade = (index: number, gap: number, decay: number): number =>
  index <= 0 ? 0 : (gap * (1 - Math.pow(decay, index))) / (1 - decay);
