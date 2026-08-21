/**
 * THE MOTION, AS MEASURED. Every curve in this file is a law read off the reference reels frame
 * by frame, not a preset. The three directions differ in WHAT moves; none of them differs in HOW
 * a thing arrives, gestures or leaves, because that is the part the last nine attempts got wrong.
 *
 * =====================================================================================
 * THE FOUR FINDINGS THIS FILE EXISTS TO IMPLEMENT
 * =====================================================================================
 *
 * 1  AN OBJECT ARRIVES ROTATED AND OVERSIZED UNDER BLUR AND UNWINDS TO FLAT. Two independent
 *    references, the same law. Uber's card, f101-f110: at f101 the app list is legible, at f103
 *    everything is a directional smear and the target row has ballooned past final size, at f105
 *    the card exists but soft, at f108 sharp and flat. Quad fit at f104, mid-arrival:
 *    TL(127,290) TR(585,364) BR(576,501) BL(116,566) - left edge 276px tall, right edge 137px
 *    tall, so the RIGHT SIDE IS AWAY FROM CAMERA - unwinding to a perfect rectangle by f108,
 *    four frames later. ClickUp's window does the same thing in ten frames at half the angle.
 *
 *    The rejected direction's answer to this was `TILT = { perspective: 2400, transform:
 *    "rotateY(7deg) rotateX(2deg)" }`: a CONSTANT, NEVER ANIMATED tilt. Three failures in one
 *    line. The angle is a third of the measured peak, the perspective is 1.7x too far away so
 *    what rotation there is barely projects, and it never changes, which is the entire difference
 *    between a 3D move and a Dribbble mockup. In the reference the tilt exists for four to ten
 *    frames and is GONE at rest.
 *
 * 2  INTERNAL ELEMENTS ENTER ON A WATERFALL, EACH WITH ITS OWN BLUR. Uber f105-f111: at f105 the
 *    car and the card body are sharp while the price and the subtitle are still smeared; at f107
 *    the title is sharp, the subtitle is not, and the badge is a blank pill with no text in it;
 *    at f109 the badge text arrives blurred. Body, title, subtitle, price, badge, about two
 *    frames apart, each resolving from its own directional blur. Never composite a finished card
 *    and animate it as one rigid picture.
 *
 * 3  THE MID-BEAT PERSPECTIVE GESTURE, which is the thing Cameron saw and none of ours had. Uber
 *    f153-f167, with the card ALREADY AT REST:
 *
 *      frame  top w  bottom w   dW      left h  right h   dH
 *      152     452     452     0.0%      474     474     0.0%
 *      158     448     483    -7.6%      470     510    -8.3%
 *      162     445     506   -12.7%      461     546   -18.4%
 *      166     449     467    -4.0%      457     486    -6.3%
 *      167     452     452     0.0%       -       -      0.0%
 *
 *    Bottom edge 12.7% wider than top, right edge 18.4% taller than left, nine frames out and
 *    five frames back. And the corners move INDEPENDENTLY, proven from the contents rather than
 *    the outline: the price blob's principal axis swings 17.3 degrees across the gesture and its
 *    centroid drops 34px and rises 33px, while the badge at the opposite corner moves two pixels.
 *    That is a real perspective transform and it cannot be faked with a scale or a slide.
 *
 * 4  TYPE BUILDS WORD BY WORD IN PLACE AND LEAVES ON AN ACCELERATION. Never a fade, never a
 *    slide-up. Both halves are measured below.
 *
 * =====================================================================================
 * A NOTE ON SIGNS, because getting one backwards inverts the whole gesture
 * =====================================================================================
 *
 * CSS rotation is right-handed about axes where +x is right, +y is DOWN and +z is toward the
 * viewer. Two consequences used everywhere below:
 *
 *   rotateX POSITIVE brings the BOTTOM edge toward camera (the bottom edge gets wider).
 *   rotateY POSITIVE pushes the RIGHT edge away from camera (the right edge gets shorter).
 *
 * So the measured arrival, right edge away, is rotateY POSITIVE; the measured mid-beat gesture,
 * bottom edge wider and right edge taller, is rotateX POSITIVE with rotateY NEGATIVE. The two
 * moments therefore lift opposite corners, which is why they do not read as the same move twice.
 */
import { Easing, interpolate } from "remotion";

export const EASE = {
  /** The arrival. Quintic out is the flattest standard curve, which is what "arrives already at
   * speed and stops without a bump" looks like. */
  quintOut: Easing.out(Easing.poly(5)),
  quartOut: Easing.out(Easing.poly(4)),
  cubicIn: Easing.in(Easing.poly(3)),
  cubicOut: Easing.out(Easing.poly(3)),
  cubicInOut: Easing.inOut(Easing.poly(3)),
  sineInOut: Easing.inOut(Easing.sin),
  sineOut: Easing.out(Easing.sin),
  quadIn: Easing.in(Easing.poly(2)),
  linear: Easing.linear,
} as const;

/** interpolate with both ends clamped, which is what every curve here wants and none of them
 * wants to restate.
 *
 * A RAMP MAY RUN DOWN ITS INPUT AXIS, and direction C needs it to. `Scroller.tsx` drives its type
 * off `d`, a word's distance from being the current one, which DECREASES as the word arrives: the
 * snap from grey to ink is `ramp(d, 0.85, 0.3, 0, 1)`. Remotion's `interpolate` rejects that,
 * because it requires a strictly increasing inputRange.
 *
 * The descending case is served by NEGATING THE INPUT AXIS rather than by swapping the two ends,
 * and the difference matters. Negating is exact:
 *
 *     t = (-x - -from) / (-to - -from) = (from - x) / (from - to) = (x - from) / (to - from)
 *
 * which is the same t, so `easing` is applied over the same phase in the same direction. Swapping
 * the ends instead - `ramp(d, 0.3, 0.85, 1, 0)` - traverses the curve backwards and silently
 * turns every cubicOut into a cubicIn, which is a different curve and the wrong one: the snap
 * would ease in slowly and then jump, where the measurement says it arrives fast and settles.
 *
 * Clamping survives the negation. "Before the ramp has started" is `x > from` when the axis
 * descends, which negates to `-x < -from`, which is extrapolateLeft, which clamps to `a`. Same
 * end, same value.
 */
export const ramp = (
  frame: number,
  from: number,
  to: number,
  a: number,
  b: number,
  easing = EASE.linear,
): number => {
  const clamped = {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  // A zero-width window is a step, and interpolate rejects that too. It is the limit of the ramp
  // as `to` approaches `from`, so it answers with the limit rather than throwing.
  if (from === to) {
    return frame < from ? a : b;
  }
  return from > to
    ? interpolate(-frame, [-from, -to], [a, b], clamped)
    : interpolate(frame, [from, to], [a, b], clamped);
};

/**
 * =====================================================================================
 * THE ARRIVAL
 * =====================================================================================
 *
 * Eight frames, 0.267s. Uber does it in four under heavy blur, ClickUp in ten; eight is the
 * middle, and a 1080 frame needs more than four because the object is larger on screen so the
 * same angular change covers more pixels and reads as a jump.
 *
 * The scale is two curves and not one, because the measurement is two curves: the Uber card is
 * 538px wide at f108, the frame it lands sharp, and 452px by f142, so it ARRIVES 19% OVERSIZED
 * AND CONTRACTS OVER THE FOLLOWING 34 FRAMES. `settle` is that second, slow contraction, and it
 * is what stops an arrival from being a snap followed by a frozen picture.
 *
 * Opacity ignites at 25% of the travel rather than starting from zero at frame zero, so the
 * object is never a ghost fading up; by the time it is visible at all it is already most of the
 * way through its rotation.
 */
export const ARRIVAL = {
  frames: 8,
  rotY: 18,
  rotX: -12,
  rotZ: -3,
  scale: 1.18,
  /** Where the eight-frame arrival leaves the scale, and where the slow settle takes over. */
  landed: 1.05,
  /** Frames the slow post-arrival contraction runs for. Measured at 34. */
  settle: 34,
  blur: 24,
  ignite: 0.25,
} as const;

export interface Pose {
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  /** Directional smear, in stdDeviation, along the travel axis. */
  smearX: number;
  smearY: number;
  opacity: number;
}

export const REST: Pose = {
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  scale: 1,
  smearX: 0,
  smearY: 0,
  opacity: 1,
};

/**
 * An object's pose at `frame` frames into its own life.
 *
 * `lead` advances the arrival clock alone, so the film's opening object is already part way
 * through its arrival on frame one rather than fading up into an empty frame.
 */
export const arrive = (frame: number, lead = 0): Pose => {
  const f = frame + lead;
  const t = ramp(f, 0, ARRIVAL.frames, 0, 1, EASE.quintOut);
  const settle = ramp(f, ARRIVAL.frames, ARRIVAL.frames + ARRIVAL.settle, 0, 1, EASE.sineOut);
  return {
    rotX: ARRIVAL.rotX * (1 - t),
    rotY: ARRIVAL.rotY * (1 - t),
    rotZ: ARRIVAL.rotZ * (1 - t),
    scale:
      ARRIVAL.scale + (ARRIVAL.landed - ARRIVAL.scale) * t + (1 - ARRIVAL.landed) * settle,
    // The smear is along the travel axis, which for an arrival is the axis the rotation is
    // unwinding on: mostly horizontal, with a fifth of it vertical so the object does not read
    // as sliding sideways behind a venetian blind.
    smearX: ARRIVAL.blur * (1 - t),
    smearY: ARRIVAL.blur * 0.22 * (1 - t),
    opacity: ramp(f, 0, ARRIVAL.frames * ARRIVAL.ignite, 0, 1),
  };
};

/**
 * =====================================================================================
 * THE MID-BEAT GESTURE, spent once or twice in a whole film
 * =====================================================================================
 *
 * Solving the measured trapezoid at perspective 1400 on a card of this size gives a peak of
 * about 20 degrees of rotateY and 14 of rotateX. Nine frames out on a sine inOut, one frame held
 * at the peak, five frames back on a quartic out: deliberately asymmetric, which is what makes it
 * read as a hand turning something rather than as a loop.
 *
 * It is PUNCTUATION. Two per film at the very most, on the beat that matters. Used as texture it
 * becomes the constant tilt this file exists to replace.
 */
export const GESTURE = { out: 9, hold: 1, back: 5, rotY: -20, rotX: 14 } as const;
export const GESTURE_FRAMES = GESTURE.out + GESTURE.hold + GESTURE.back;

/** How far through the gesture the object is at `frame`, 0 at rest, 1 at the peak. */
export const gestureAmount = (frame: number, at: number): number => {
  const f = frame - at;
  if (f <= 0 || f >= GESTURE_FRAMES) {
    return 0;
  }
  if (f <= GESTURE.out) {
    return ramp(f, 0, GESTURE.out, 0, 1, EASE.sineInOut);
  }
  if (f <= GESTURE.out + GESTURE.hold) {
    return 1;
  }
  return ramp(f, GESTURE.out + GESTURE.hold, GESTURE_FRAMES, 1, 0, EASE.quartOut);
};

/**
 * =====================================================================================
 * THE IN-PLACE CONTENT MORPH, and it is the device that removes the stutter
 * =====================================================================================
 *
 * Uber f131-f138, seven frames. The UberX card becomes the XL card WITHOUT LEAVING: the title
 * crossfades, the badge crossfades blue "Fastest" to yellow "Extra seat", the subtitle
 * crossfades, the 3D car morphs sedan to van, and the price changes last. At the same time the
 * card scales 538 -> 474 -> 465 wide and executes a clean rotateZ wobble, the top corners
 * separating vertically by 24px and returning, which is +/-2.9 degrees in plane. The frame
 * flashes yellow on the same frame.
 *
 * WHY IT MATTERS HERE. Seven of this film's dozen visual events want to say "and here is another
 * one of these". The reference never cuts to a second card; it keeps one object and changes what
 * is written on it. The rejected direction was six fragments, six entries and six exits, which is
 * six stutters, which is exactly the note.
 */
export const MORPH = { frames: 7, stagger: 2, rotZ: 3, dip: 0.965 } as const;

export interface Morph {
  /** 0 while the old content is whole, 1 when the new content is. */
  t: number;
  rotZ: number;
  scale: number;
}

export const morphAt = (frame: number, at: number): Morph => {
  const f = frame - at;
  const t = ramp(f, 0, MORPH.frames, 0, 1, EASE.cubicInOut);
  // The wobble peaks at frame three of seven and returns, which is where the measurement put it.
  const wob = f <= 0 || f >= MORPH.frames ? 0 : Math.sin((f / MORPH.frames) * Math.PI);
  return { t, rotZ: MORPH.rotZ * wob, scale: 1 - (1 - MORPH.dip) * wob };
};

/**
 * =====================================================================================
 * TYPE: THE BUILD
 * =====================================================================================
 *
 * Uber, "You have got options", f182-f199. Word start frames 182, 187, 191, 196: gaps of 5, 4
 * and 5 frames, 0.133-0.167s. Speech at 150-170 wpm is 0.36-0.40s per word, so THE TYPE BUILDS
 * ABOUT 2.5 TIMES FASTER THAN THE VOICE AND THEN WAITS. It is a flourish, not karaoke.
 *
 * Per word, measured on "You" as glyph height in pixels:
 *
 *   frame   182  183  184  185  186  187
 *   height   13   18   27   35   37   38
 *   scale  0.35 0.47 0.71 0.92 0.97 1.00
 *
 * Deltas .12 / .24 / .21 / .05 / .03: accelerates, then decelerates. An ease in-out over five or
 * six frames, from 0.35 to 1.00, with no overshoot. The ink at f183 is already at full opacity
 * for its size, so the read is SCALE AND BLUR, not a fade; opacity is done in two frames.
 *
 * NO REFLOW. "You" occupies x 111-198 at f189 and x 114-198 at f200. Every word arrives at its
 * final position: the line is laid out centred as a finished string and the words are revealed in
 * place. The rejected direction's words LIFTED 74px vertically with no scale change at a 0.066s
 * interval, which is half the reference's cadence with a decay on top, so the last words machine
 * gunned. That is the visual half of "the script is so choppy".
 *
 * The 51px is the measured 34px of centre travel in the reference's 720 space. It is spent on Z
 * rather than on Y: the word comes FORWARD out of the page, which is what a scale from 0.35
 * under a blur reads as, where a vertical lift reads as a slide-up preset.
 */
export const BUILD = {
  /** Frames between one word starting and the next. Measured 4-5. */
  cadence: 4.5,
  /** One word's own entry. Measured 5-6. */
  frames: 6,
  scale: 0.35,
  /** Per-word perspective, so a word's rotation and Z travel happen about its OWN centre and the
   * line cannot converge on the frame's vanishing point. A shared stage perspective would drag
   * every word toward the middle as it grew, which is the reflow the measurement rules out. */
  perspective: 900,
  /** How far back in Z the word starts, in that perspective. */
  z: 220,
  /** The measured centre travel, spent as a lift that resolves as the word comes forward. */
  lift: 18,
  rotX: 14,
  blur: 14,
  /** Frames the completed line holds before it may leave. Measured 8. */
  hold: 8,
} as const;

export interface WordPose {
  scale: number;
  z: number;
  y: number;
  rotX: number;
  blur: number;
  opacity: number;
}

export const buildWord = (
  frame: number,
  index: number,
  lead = 0,
  /** The gap between one word starting and the next. Defaults to the measured 4.5; a beat whose
   * sentence is too long to tell at that rate inside its own window passes its own, and
   * `statementPlan` in ./film.ts will not let it fall below 3. */
  cadence: number = BUILD.cadence,
): WordPose => {
  const at = index * cadence;
  const t = ramp(frame + lead, at, at + BUILD.frames, 0, 1, EASE.cubicInOut);
  return {
    scale: BUILD.scale + (1 - BUILD.scale) * t,
    z: -BUILD.z * (1 - t),
    y: BUILD.lift * (1 - t),
    rotX: BUILD.rotX * (1 - t),
    blur: BUILD.blur * (1 - t),
    // Two frames of opacity, then the read is carried entirely by scale and blur.
    opacity: ramp(frame + lead, at, at + 2, 0, 1),
  };
};

/** When the last word of a group has finished building, which is what a hold is measured from. */
export const buildFrames = (count: number, cadence: number = BUILD.cadence): number =>
  Math.ceil((count - 1) * cadence + BUILD.frames);

/**
 * =====================================================================================
 * TYPE: THE EXIT
 * =====================================================================================
 *
 * Uber, f207-f219. Per-word left edge for "You":
 *
 *   frame  207  208  209  210  211  212  213
 *   x      111  104   93   76   52   22    0
 *   delta   -    -7  -11  -17  -24  -30    -
 *
 * MONOTONICALLY ACCELERATING WITH NO EASE-OUT AT ALL. The word is at maximum speed on the frame
 * it leaves. Peak 30px per frame at 720 wide is 45px per frame here, 1350px per second.
 *
 * In the same six frames "options" moved only 39px, so each word has its own exit clock staggered
 * about a frame and a half in reading order and THE LINE VISIBLY STRETCHES AS IT LEAVES: the word
 * gaps measured 21/18/14px at f200 and 27/24/18px at f209. The rejected direction moved the whole
 * group on one shared translate, so nothing ever stretched, and it travelled 130px and died,
 * which is a nudge rather than an exit.
 *
 * The blur is directional and ramps with the velocity, which is the difference between a fast
 * move and an abrupt one.
 */
export const EXIT = {
  frames: 11,
  /**
   * Total displacement, and it is solved BACKWARDS FROM THE VELOCITY AT THE LAST VISIBLE FRAME
   * rather than picked as a distance.
   *
   * The measurement: the reference's word is at maximum speed when it leaves, 30px/frame in the
   * 720 space, which is 45px/frame here, and there is no ease-out anywhere in it. Under cubicIn
   * over 11 frames the word is gone at 70% of travel (see fadeAtTravel), which is f=9.8, and the
   * speed there is 3*(9.8/11)^2/11 * travel. Setting that to 45 gives travel = 210. At the 165
   * this held first, the last visible frame was moving 35px and the exit read soft.
   *
   * The distance itself is not the point and never was: 210px is 19% of the frame, where the
   * reference's word clears 40%+, but the reference word stays OPAQUE while it does it. Ours is
   * transparent from 147px on, so what has to match is the speed and the acceleration at the
   * moment it disappears, not the distance it would have covered had anyone still been able to
   * see it.
   */
  travel: 210,
  stagger: 1.5,
  /** blur = |dx per frame| * 1.2, so about 54 at peak. Halved into stdDeviation, which is what
   * feGaussianBlur takes. */
  blurPerPx: 1.2,
  /** Opacity reaches zero at 70% of the TRAVEL, not of the duration. Under a cubic that is
   * 0.888 of the duration, which is why this is written as a distance and converted. */
  fadeAtTravel: 0.7,
} as const;

export interface ExitPose {
  x: number;
  smear: number;
  opacity: number;
}

/** `frame` is measured from the moment the FIRST word starts leaving. */
export const exitWord = (frame: number, index: number): ExitPose => {
  const f = frame - index * EXIT.stagger;
  const t = ramp(f, 0, EXIT.frames, 0, 1, EASE.cubicIn);
  const next = ramp(f + 1, 0, EXIT.frames, 0, 1, EASE.cubicIn);
  const dx = (next - t) * EXIT.travel;
  return {
    x: -t * EXIT.travel,
    smear: (dx * EXIT.blurPerPx) / 2,
    opacity: f <= 0 ? 1 : Math.max(0, 1 - t / EXIT.fadeAtTravel),
  };
};

/** How long a whole line takes to clear, so a beat can be laid out around it. */
export const exitFrames = (count: number): number =>
  Math.ceil(EXIT.frames + (count - 1) * EXIT.stagger);

/**
 * =====================================================================================
 * THE FIELD: FLASHES, FLIPS AND WIPES
 * =====================================================================================
 *
 * Measured colour floods in the Uber reel. The background is not one colour; a full-frame flood
 * arrives on a beat and decays, and the PEAK IS HELD FOR ONE FRAME:
 *
 *   blue    ramp in f102-f108, 6f | peak f108, 1f | out f108-f115, 7f | 13f total | #C7E2FB
 *   yellow  ramp in f130-f134, 4f | peak f134, 1f | out f134-f140, 6f | 10f total | #FAF79D
 *
 * The SHAPE is the measurement and has never moved: four frames in, ONE frame held, six out.
 *
 * `peak` is the one number in this file that the ground decides, and it moved when the ground
 * did. The dark cut held it to 0.12, because a lift toward chartreuse on off-black is a strong
 * event at a tenth of an alpha. On paper the flood is a MULTIPLY toward a pale (see FLOOD in
 * ./ground and the header of ./Field), and the reference's own floods take the whole frame TO
 * #C7E2FB and #FAF79D rather than veiling it. At 0.8 the ground lands around (227,240,167)
 * against (246,243,234), a blue channel drop of 67 against the reference's 98, and because it
 * multiplies it can be spent this hard without erasing the near-black object the beat is about.
 * Nothing about the timing changed.
 *
 * The luminance flip bookends the film. Measured black to white at f16-f25: mean luma 24, 48, 73,
 * 98, 122, 147, 173, 198, 224, 249 - TEN FRAMES, PERFECTLY LINEAR, no easing at either end. On a
 * light ground that is the measurement rather than an inversion of it.
 */
export const FLASH = { in: 4, hold: 1, out: 6, peak: 0.8 } as const;

export const flashAt = (frame: number, at: number): number => {
  const f = frame - at;
  if (f <= 0) {
    return 0;
  }
  if (f <= FLASH.in) {
    return ramp(f, 0, FLASH.in, 0, FLASH.peak);
  }
  if (f <= FLASH.in + FLASH.hold) {
    return FLASH.peak;
  }
  return ramp(f, FLASH.in + FLASH.hold, FLASH.in + FLASH.hold + FLASH.out, FLASH.peak, 0);
};

/** The bookend. Ten frames, linear, no easing at either end. */
export const FLIP_FRAMES = 10;

/**
 * The velocity-matched wipe. Uber f214-f220: the panel edge crosses 698, 655, 596, 516, 405, 203,
 * 0 - deltas of 43, 59, 80, 111, 202, accelerating - in SEVEN FRAMES across 720px, with an 80px
 * feather. Critically the type is exiting leftward at the same time and the panel CHASES IT OFF:
 * same direction, matched velocity. Converted, that is seven frames across 1080 with a 120px
 * feather, on a quadratic in.
 */
export const WIPE = { frames: 7, feather: 120 } as const;
