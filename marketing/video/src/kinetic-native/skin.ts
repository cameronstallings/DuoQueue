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
 * not the fix. So a centred type block centres on the true frame centre, y = 960, and the rail
 * rides over the bottom of the frame on its own layer.
 *
 * What the layout does respect is the doctrine's one soft courtesy rule, that critical
 * readable text should not be parked exactly where the caption line sits. STACK is the height
 * budget the fitted type is shrunk into, and it is sized so a centred stack ends above the
 * rail's tallest line rather than under it. That is a size decision, not a shifted centre.
 *
 * BAND, TOP and BOTTOM are the anchored beats, and they are not a shifted centre either. They
 * are the two APP beats getting out of the product's way in opposite directions, which is a
 * composition decision about a specific screenshot. See `Anchor` in ./script.ts.
 */
export const BOX = {
  /**
   * Frame edge to the safe box, and NOT the margin a viewer sees any more.
   *
   * The visible margin is now this plus whatever the type scale leaves unfitted, because the
   * hero is fitted to a FRACTION of this box rather than to all of it. At TYPE_SCALE.a the
   * block measures 655px inside a 1080px frame, so the real air is 212px a side, a fifth of
   * the frame. At TYPE_SCALE.b it is 283px, a quarter. The old cut had 72px, and that is most
   * of what made it read as a poster rather than as a film.
   */
  side: 72,
  /**
   * Height budget for a centred block, centred on 960.
   *
   * A guard rather than a lever now. Under the old wall-to-wall fitting this number decided
   * the type size, because every pixel of height the stack kept was a pixel of width it kept
   * too; under a hero and its support the tallest centred block in the film comes out around
   * 630px, so this never binds. It stays because it is what keeps a block clear of the caption
   * rail, whose tallest line tops out at 1488, if the copy ever grows a line.
   */
  stack: 1040,
  /**
   * Height budget for a `top` anchored block, and the number that decides how much of the
   * phone screen behind it stays visible.
   *
   * 445 spans 130 to 575. The deck card's top edge starts at 640 and rises to 591 as the app
   * plate's push runs, so the block clears the card at its highest by 16px at every frame of
   * the beat. Quoted at TYPE_SCALE.a and scaled by `budgetAt`, so the smaller cut clears it by
   * more rather than by the same.
   */
  bandTop: 445,
  /**
   * Height budget for a `bottom` anchored block, and it is smaller than the top one because
   * the DUO LOCKED screen leaves less room than the deck does.
   *
   * The measurements that fix it: the app's Send a message button ends at 1104, its Keep
   * swiping link sits at 1210, and the rail's tallest line tops out at 1488. So the block gets
   * 1135 to 1455, which is everything between the button and the rail.
   *
   * This is the one budget in the film that actually binds. The payoff's block wants 479px at
   * TYPE_SCALE.a and gets 320, so DUO comes out at about 243px rather than 364. That is the
   * trade this beat has always made and it is still the right one: the whole product reads.
   */
  bandBottom: 320,
  /** Frame top to the top of a `top` anchored block. It clears the app's own status row and
   * lands the block over the deck header, which is the part of that screen worth covering. */
  top: 130,
  /** Frame bottom to the bottom of a `bottom` anchored block. 465 puts it at 1455, which is
   * 33px clear of the rail. */
  bottom: 465,
  /**
   * Ceiling on the HERO, quoted at TYPE_SCALE.a and scaled with it.
   *
   * It used to be 520 and was a guard against a one letter line that nothing ever reached. It
   * is load bearing now, and it is the last place the old cut's problem could still get in.
   *
   * A fitted size is inversely proportional to the length of the string, so a SHORT hero comes
   * out larger for no reason a viewer could name. Rendered and measured off the delivered file:
   * uncapped, the flood beat's NO landed at 449px against the opening beat's NOT at 319px, a
   * 41% jump between two words doing the same job in the same film, decided by one letter.
   * That is exactly the accidental hierarchy this rewrite exists to remove, just between beats
   * instead of inside one.
   *
   * 340 catches it. The six heroes then run 340 / 319 / 304 / 269 / 243 / 188 at scale a, which
   * is a family: the two denials at the top, the payoff and the sign-off under them, and the
   * longest hero smallest. Nothing in it is decided by spelling any more.
   *
   * Scaled by the type scale like the height budgets and for the same reason: a ceiling that
   * did not move would make the two delivered cuts identical on exactly the beats where the
   * type is largest.
   */
  cap: 340,
} as const;

/**
 * THE FACE, MEASURED OFF THE FILE. Manrope ExtraBold, public/fonts/Manrope_800ExtraBold.ttf:
 * unitsPerEm 2000, hhea ascent 2132, descent -600, OS/2 capHeight 1440. As fractions of an em
 * that is ascent 1.066, descent 0.300, cap 0.720. The lowercase descender is measured rather
 * than taken from the metric, by rendering H and Hgp at 200px and reading the ink: the cap is
 * 144px, the g and the p reach 51px below the baseline, so the real descender is 0.255em where
 * the font's own descent field says 0.300.
 *
 * These four numbers exist because of one bug that shipped twice. A line box is only
 * one lineHeight tall, the glyphs are centred inside it by half leading, and both of
 * this direction's leadings are TIGHTER than the face's own 1.366em content box. So the
 * capitals hang out of the box at the top, the baseline sits ABOVE the box bottom, and
 * anything painting a filled field behind a word by insetting from the box edges cuts the
 * letterforms. That is what put a red bar with holes in it under the last word of the film,
 * and what turned the rail word wrong into wronq. A field is positioned from the BASELINE,
 * never from the box, and every such field in this direction computes its edges from here.
 */
export const FACE = { ascent: 1.066, descent: 0.3, cap: 0.72, tail: 0.255 } as const;

/**
 * Distance from the top of a line box to the baseline, in em, at a given leading.
 *
 * halfLeading = (leading - ascent - descent) / 2, and the baseline is one ascent below that.
 * At the display leading of 0.82 it comes out at 0.793em, which is 0.027em ABOVE the bottom of
 * the box: an inset measured from the bottom has to be NEGATIVE to reach the baseline at all.
 */
export const baselineIn = (leading: number): number => (leading + FACE.ascent - FACE.descent) / 2;

/** Tracking for the HERO line. Negative, because at 300px the default spacing of a grotesque
 * reads as gappy, and tight tracking is most of what separates kinetic type from a slide. */
export const TRACKING = "-0.035em";

/**
 * Tracking for the SUPPORT lines, and it is positive on purpose.
 *
 * This is the second of the three axes that separate the two registers, and the one that does
 * the most work for the least ink. Tight negative tracking reads as MASS: the letters lock up
 * into a single shape and the eye takes the line as an object. Wide positive tracking reads as
 * a LABEL: the letters separate, the line thins out, and the eye takes it as an annotation on
 * whatever it sits next to. Setting both registers at the same tracking and only changing the
 * size would leave the support reading as a small headline, which is exactly the thing that
 * makes a frame look like a template.
 *
 * 0.08em, which at the support sizes this film reaches is 6 to 9px between letters. Enough to
 * be unmistakable next to -0.035em, not so much that a four word line comes apart.
 */
export const SUPPORT_TRACKING = "0.08em";

/**
 * How big a support line is, as a fraction of its beat's hero.
 *
 * 0.32, so the hero is a little over three times its support. The number is the whole
 * argument of this rewrite and the range around it is narrow: at 1.2x nothing is dominant and
 * the frame reads as an accident, and much past 4x the support stops being readable at feed
 * size and becomes decoration. Three times is the ratio a reader recognises as a decision.
 *
 * It is a RATIO and not a size, which is the point. Every other way of setting the support
 * makes its size depend on its own spelling, and this film already shipped one cut where the
 * biggest word on the opening frame was the least important one for exactly that reason.
 */
export const SUPPORT_RATIO = 0.32;

/**
 * How much wider than the hero's measure a SUPPORT line may be fitted, when its own length
 * forces it below the ratio above.
 *
 * It exists for exactly one line in the film and it is worth naming which: "A DATING APP", on
 * the opening frame, twelve characters long. Held to the hero's own measure it comes out at
 * 87px, which is under the caption rail's size, and a support line quieter than the caption
 * inverts the two registers on the most important frame in the cut.
 *
 * A quiet line is allowed to run wider than a loud one because it does not press on the frame
 * edge the way a heavy line does: at a third of the size in Medium it carries perhaps a fifth
 * of the ink. 1.15 still leaves 153px of margin at TYPE_SCALE.a, 14% of the frame width a
 * side, against the 72px the old wall-to-wall cut left on every line of every beat.
 *
 * It is a CEILING and not a target. Every other support line in the film is governed by
 * SUPPORT_RATIO and never reaches this at all.
 */
export const SUPPORT_MEASURE = 1.15;

/**
 * Air between the two registers, as a fraction of the hero size.
 *
 * It only ever appears where the register CHANGES, never between two support lines. That is
 * what makes a three line beat read as two things (a quiet block, then the hero) rather than
 * as three evenly spaced things, and it is the difference between a stack and a composition.
 *
 * A fraction of the hero rather than a fixed pixel value, so a beat whose hero is squeezed by
 * its height budget keeps its proportions instead of ending up as small type in a big gap.
 */
export const REGISTER_GAP = 0.15;

/**
 * Leading for the HERO line, as a multiple of font size.
 *
 * Under 1 on purpose: an all caps line has no descenders to clear. A hero is one line in every
 * beat of this film, so this only governs the height its own box claims in the stack.
 */
export const HERO_LEADING = 0.86;

/**
 * Leading for the SUPPORT lines.
 *
 * Looser than the hero, because two support lines can sit adjacent and at 0.86 with positive
 * tracking they would set as a grey block rather than as two readable lines. Still under 1,
 * because they are all caps too.
 */
export const SUPPORT_LEADING = 0.96;

/**
 * The two delivered type scales, as the fraction of the safe box width the HERO is fitted to.
 *
 * The previous cut fitted every line to 1.0 of the safe box, so these are literally "70% and
 * 55% of the last one" measured on the thing a viewer sees, rather than an adjective. At 0.70
 * the frame keeps 212px of margin on each side, 20% of its width; at 0.55 it keeps 283px, 26%.
 *
 * Nothing else differs between the two cuts. Same script, same mix, same beat table, same
 * camera, same seams: one number.
 */
export const TYPE_SCALE = { a: 0.7, b: 0.55 } as const;

/**
 * A height budget at a given type scale.
 *
 * The budgets in BOX are quoted at TYPE_SCALE.a, because that is the scale they were measured
 * against the product screenshots at. They have to move with the scale for a reason that is
 * easy to miss: a budget is a CEILING, and a ceiling that does not move would let the smaller
 * cut's block grow back into the larger cut's size wherever the budget binds, and the two
 * deliverables would be identical on exactly the beats where the type is largest.
 */
export const budgetAt = (budget: number, scale: number): number =>
  Math.round((budget * scale) / TYPE_SCALE.a);

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
  /**
   * Field around the glyph on the highlighted word, in em, above the cap and below the tail.
   *
   * The highlighter's edges are computed from the BASELINE using FACE above, never inset from
   * the line box: at this leading the box bottom is 0.127em above the descender, so the old
   * fixed 0.07em bottom inset cut the g of "wrong" and the p of "platonic" clean off and the
   * rail read "wronq" for the whole opening beat. Both of the film's two promoted words carry
   * a descender, so a highlighter that covers one is the correct shape here as well as the
   * correct arithmetic.
   */
  boxPad: 0.045,
  /** Manrope ExtraBold is the heaviest face in this repo and it is still not a black. A
   * stroke in the fill colour fattens it into one. */
  weightBoost: 0.045,
} as const;

/** Tighter than the face's own default, looser than the display tracking: at 92px the same
 * -0.035em would close the counters up. */
export const RAIL_TRACKING = "-0.015em";
