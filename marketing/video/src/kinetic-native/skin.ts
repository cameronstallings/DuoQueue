/**
 * The look, in one file: three inks, one accent, and the two geometries the film is built on.
 *
 * The Volt constraint is lifted here on purpose. Cameron's words were that he does not care
 * how far from Volt it looks, he wants high quality video that attracts the eye, so the brand
 * is spent in one place where it earns its keep, the end card, and everywhere else the palette
 * is picked for one job: surviving a thumb moving at speed past a 6cm phone at half
 * brightness.
 *
 * Vermillion over bone on near black, carried over from direction B because Cameron picked
 * it. What is new is that the caption rail shares the accent rather than introducing a
 * second one. Direction A used yellow, which was right for A because A had no other colour;
 * here a fifth colour would break the frame into two unrelated designs. One accent used at
 * two scales ties the display layer and the rail into one system, and the two layers are
 * already separated by an order of magnitude of size and by position.
 */

export const K = {
  /** The field. Warmer and darker than the app's off black, so vermillion sits on it without
   * the muddy edge a green black gives an orange. */
  ink: "#08070A",
  /** Display type. Bone, not #FFF: pure white on near black blooms under H.264 at 340px, and
   * the bloom is what makes big type look cheap. */
  bone: "#F6F2E9",
  /** The accent, on both layers. Hot enough to read as a signal at a twelfth of the screen. */
  hot: "#FF3B14",
  /** Type on the accent, when the frame floods or a slab wipes in behind a word. */
  onHot: "#12060A",
  /**
   * The field BEHIND a knockout, and the one colour in the set that exists for a compositing
   * reason rather than a design one.
   *
   * A knockout is bone type on a field with the plate multiplied over the lot, so whatever
   * that field is, the footage is multiplied into it. On pure black the multiply has nothing
   * to work on and the four fifths of the frame that is not a letter is dead black. On this
   * ember the same multiply paints a deep, moving wash of the same footage the letters are
   * cut from, which costs no second video decode and keeps the beat from being two words on
   * an empty field. Dark enough that a letter is still an order of magnitude brighter.
   */
  ember: "#25100C",
  /** The caption rail's ink. Pure white, and the deliberate exception to the bone rule: at
   * 92px inside a black keyline there is nothing to bloom, and the rail has to punch through
   * whatever it is sitting over. The rail is a different layer and reads as one. */
  rail: "#FFFFFF",
  /** The rail's keyline. */
  edge: "#000000",
} as const;

/**
 * The display safe box. Symmetrical, because the captions doctrine is explicit that a caption
 * line is an OVERLAY composited on top of the film and never a band the layout is shifted up
 * to avoid: a composition centred at 0.42 of the height with a dead lower strip is the bug,
 * not the fix. So the type block centres on the true frame centre, y = 960, and the rail
 * rides over the bottom of the frame on its own layer.
 *
 * What the layout does respect is the doctrine's one soft courtesy rule, that critical
 * readable text should not be parked exactly where the caption line sits. STACK is the height
 * budget the fitted type is shrunk into, and it is sized so a centred stack ends above the
 * rail's tallest line rather than under it. That is a size decision, not a shifted centre.
 */
export const BOX = {
  side: 72,
  /**
   * Height budget for the fitted display stack, centred on 960.
   *
   * 1040 spans 440 to 1480. The budget is what a four line beat is scaled down to fit, and
   * because every line is fitted to the same width, every pixel of height the stack keeps is
   * a pixel of WIDTH it keeps too, so it is worth spending right up to the limit. The limit
   * is the rail: its tallest line tops out at 1488, and a four line stack at 1080 put the
   * bottom of APP within about 20px of it, which reads as crowded even though it does not
   * actually collide. 1040 costs under 4% of the type size and buys a real gap.
   */
  stack: 1040,
  /**
   * Ceiling for any one fitted line, and it exists only as a guard against a one letter line.
   *
   * It used to be 380, and that was the bug behind the ragged right edge on the first render.
   * Every line is fitted to the SAME width and the stack is then shrunk by ONE factor, so
   * every line comes out flush on both edges, which is this direction's entire signature. A
   * per line ceiling breaks that: it clips the short lines only, so APP came out narrower
   * than NOT A and the block read as a ragged left aligned paragraph rather than as a slab.
   * At 520 nothing in this script hits it and fitText governs every line, which is correct.
   */
  cap: 520,
} as const;

/** Tracking for display type. Negative, because at 300px the default spacing of a grotesque
 * reads as gappy, and tight tracking is most of what separates kinetic type from a slide. */
export const TRACKING = "-0.035em";

/**
 * Leading for the stacked line block, as a multiple of font size. Under 1 on purpose: an all
 * caps stack has no descenders to clear and touching lines are the whole look.
 *
 * 0.82 rather than 0.9, and the reason is width rather than taste. Every line is fitted to
 * the same width and the whole stack is then scaled by one factor to fit the height budget,
 * so leading is the exchange rate between the two: tighter leading buys a bigger scale
 * factor, and a bigger scale factor is what keeps a four line beat flush with the frame
 * edges instead of shrinking into a column with a hand's width of margin either side.
 */
export const LEADING = 0.82;

/**
 * The caption rail, in composition pixels.
 *
 * `bottom` is the load bearing number and it is a platform fact rather than a taste. TikTok
 * stacks its own caption, a handle and a button rail over roughly the bottom fifth of a 1920
 * frame and Reels eats a similar band, so a rail much lower than this is covered. This sits
 * just above that, which is also where a viewer's eye already expects captions to be.
 *
 * One line per cue, never two. Two lines would climb into the display stack, and a two line
 * rail is not what a phone editor's caption track looks like anyway.
 */
export const RAIL = {
  /** Width the line is fitted inside. */
  box: 920,
  /** Frame bottom to the bottom of the line. */
  bottom: 340,
  /** Ceiling for the fitted size. Deliberately a fifth of the display cap: the rail is the
   * read, the display type is the claim, and the hierarchy has to be unmistakable at
   * thumbnail size. */
  maxSize: 92,
  leading: 1.02,
  /** Word gap as a fraction of the font size. */
  gap: 0.26,
  /** The black keyline, as a fraction of the font size, so it holds at any fitted size. The
   * stroke is centred on the glyph edge, so half of it sits outside the measured width. */
  outline: 0.15,
  /** Manrope ExtraBold is the heaviest face in this repo and it is still not a black. A
   * stroke in the fill colour fattens it into one. */
  weightBoost: 0.045,
} as const;

/** Tighter than the face's own default, looser than the display tracking: at 92px the same
 * -0.035em would close the counters up. */
export const RAIL_TRACKING = "-0.015em";
