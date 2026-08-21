/**
 * THE CARD: 1080x1350, and the same stage the film is played on.
 *
 * =====================================================================================
 * WHAT THIS FILE USED TO BE, AND WHY THAT WAS THE WHOLE PROBLEM
 * =====================================================================================
 *
 * It imported its ground, its inks, its grid, its tilt, its shadow and its type cap from
 * `@/frag/ground`, and it said so proudly: the carousel could not drift away from the finished
 * ads because it was made of them. That was true, and it is exactly why the carousel had to be
 * rebuilt. src/frag/ is the direction Cameron called "so cheap looking". Wearing the campaign's
 * colours while obeying a rejected direction's grid does not make a still part of the campaign;
 * it makes it the rejected direction in a different aspect ratio.
 *
 * So this is built on src/pro/ now, and specifically on the half of it that Pro-B is: a dark app
 * fragment as an isolated object, in a real camera, on warm paper, under a centred statement.
 * Everything below is imported from there or derived from it, and where a number could not come
 * across unchanged the reason is written beside it.
 *
 * =====================================================================================
 * THE THREE THINGS THAT ACTUALLY CHANGED, and all three are corrections rather than taste
 * =====================================================================================
 *
 * 1. IT IS CENTRED. The old cards hung everything off X0 = 118, one left edge, because
 *    src/frag/ground.ts claimed the Uber reel is left-aligned. src/pro/ground.ts carries the
 *    frame-by-frame measurement that says it is not: every line and every object in that reel is
 *    horizontally centred within 11px of 360 on a 720 frame, for 25.6 seconds, without a single
 *    exception. The film took that correction. The carousel had not.
 *
 * 2. THE OBJECT IS IN A CAMERA. The old cards drew a fixed tilt with a fixed shadow behind it,
 *    which is a mockup preset and is the specific thing the measurement calls cheap. Here an
 *    object is a Plane inside the film's own Stage: one 1400px perspective, four corners that move
 *    independently, a shadow whose offset and spread are computed from the live rotation, the
 *    studio's specular travelling across the face as a function of rotateY, and the app's own
 *    field painted behind the rounded corners. The same code and the same constants as Pro-B.
 *
 * 3. THE SIZE COMES OUT OF THE MEASURE. The old cards had a cap on point size, which makes a three
 *    word headline the same size as a seven word one. src/pro/type.ts holds the measurement that
 *    says a reference line's WIDTH is what is held and its size is what falls out of it: a four
 *    word line at 81px and a three word line at 129px are the same number of pixels wide.
 *    `groupSize` is imported rather than reimplemented.
 *
 * =====================================================================================
 * THE VERTICAL GRID, WHICH IS THE ONE THING THE FILM COULD NOT SUPPLY
 * =====================================================================================
 *
 * The film's vertical law is that a statement and an object NEVER share a frame: RECEDE takes the
 * object to zero before a word is written on the paper. See the header of src/pro/film.ts, and
 * the note from Cameron that produced it. A still has no second moment, so it has to hold both at
 * once, and it needs a law of its own rather than an average of the film's two anchors.
 *
 * The law is: THE TYPE HANGS FROM A FIXED BASELINE AND THE OBJECT HANGS UNDER IT. Anchoring the
 * type at its BOTTOM rather than its top is what stops the headline jumping across a swipe, since
 * the six cards carry one, two and three line blocks; anchored at the top, a one line card's words
 * would sit 150px above a three line card's last line and the set would read as restless.
 *
 * The object then centres on one stage line with its top clamped, and the clamp is what stops the
 * shortest object from being marooned in the middle of an empty band. It never bites on this plan,
 * because the plan was written so that no object is under 275px tall: the two chips, which are 131
 * and 94 pixels tall at the film's own widths, are drawn as a PAIR on one card rather than as two
 * cards each carrying a thin bar on a field of nothing.
 */
import {
  CAMERA,
  CENTRE_X,
  FLOOD,
  GROUND,
  INK,
  MEASURE,
  OBJECT_MAX_W,
  TYPE,
} from "@/pro/ground";

export { CAMERA, CENTRE_X, FLOOD, GROUND, INK, MEASURE, OBJECT_MAX_W, TYPE };

/** 4:5. The tallest a feed post may be, and therefore the most of a scroll one can occupy. */
export const CARD_W = 1080;
export const CARD_H = 1350;

/**
 * ONE INSET, ON ALL FOUR SIDES.
 *
 * The film needs no margin at all, because nothing in it ever goes near an edge: a 745px measure
 * on a 1080 frame leaves 167px of air either side and the film spends none of it. A still has
 * corners, and it has furniture to put in them, and four corners inset by four different numbers
 * is what makes a layout look assembled rather than set. 100 is 9.3% of the width and it sits
 * comfortably inside the measure's own 167.
 */
export const INSET = 100;

/**
 * THE MONO FURNITURE: the spine label, the counter, and the swipe cue's ink.
 *
 * 26px is 2.4% of the frame width, and the wide positive tracking is what makes a small line read
 * as a label rather than as a shrunken sentence. It is the same relationship the film's end card
 * has between its 62px call to action and its 40px URL: the small thing is not a small version of
 * the big thing, it is a different voice.
 */
export const LABEL = { size: 26, leading: 32, tracking: "0.18em" } as const;

/**
 * THE SWIPE CUE'S SLAB. Off-black, fully rounded, carrying raw chartreuse.
 *
 * It is the film's end card button at furniture scale, and that is deliberate: the button is the
 * one element of this campaign Cameron has consistently said he likes, and a carousel's "there is
 * more this way" is the only other place in the set where something asks to be acted on. Same
 * fill, same ink, same rounding, a quarter of the size.
 *
 * 52 tall against the label's own 32px line leaves 10px of air above and below the ink, so the
 * shape reads as a button rather than as a highlight behind a word.
 */
export const CUE = { height: 52, pad: 26, radius: 999 } as const;

/**
 * The brand mark, top left, on the five cards that are not the lockup.
 *
 * A card gets screenshotted and sent on its own, so each one has to say whose it is without the
 * account name above the post. 64px is 5.9% of the width: a masthead, not a logo placement.
 */
export const MARK_W = 64;

/**
 * THE TYPE BASELINE: the BOTTOM of the block, not its top. See the header for why.
 *
 * 520 of 1350 is 38.5%. The film sets a statement's optical centre at exactly 50% of its frame,
 * which it can afford because nothing else is on it; here the type has to clear an object, so it
 * sits high and the object takes the middle. The band between this line and the top of the object
 * runs 84 to 180px across the six cards, against the film's own measured 10.4% to 18.8% of frame
 * height between its type and its objects. The same interval, on a shorter frame.
 */
export const TYPE_BASE = 520;

/**
 * THE STAGE, and the clamp, WHICH ON THIS PLAN NEVER BITES.
 *
 * The five objects are 476, 277, 513, 354 and 389px tall. Centred on 860 their tops land at 622,
 * 722, 604, 683 and 666 and their bottoms at 1098, 999, 1117, 1037 and 1055, so the shadow's long
 * cast, measured at about 74px under a flat object at these alphas, stops at 1191 in the worst
 * case: clear of the foot row's ink at 1198.
 *
 * THE FIRST VERSION OF THIS CLAMPED AT 700 AND THAT WAS THE WRONG FIX, which is worth writing down
 * because on paper a ceiling looks like exactly the tool for a short object. The pair on card two
 * is the shortest thing in the set at 277px, and clamped up to 700 it left 197px of paper under it
 * and 180 above: the void moved rather than closing, and it moved to the bottom of the frame where
 * it reads as the card having run out. Centred it leaves 201 above and 199 below, which is the same
 * quantity of paper reading as air on both sides of the object instead of as a hole under it.
 *
 * So the clamp is a guard rail rather than a layout device, and both ends of it are slack on this
 * plan on purpose. What actually solved the short object was the PLAN: the two chips are one card
 * rather than two, which is the note in ./plan. A clamp cannot make a thin bar into a composition.
 */
export const STAGE_CY = 860;
export const TOP_MIN = 600;
export const TOP_MAX = 740;

/** The foot row: the spine label on the left, the swipe cue on the right, the cue's bottom edge on
 * the frame's own bottom inset, so the row is solved from the taller of the two things on it. */
export const FOOT_BOTTOM = CARD_H - INSET;
export const FOOT_TOP = FOOT_BOTTOM - CUE.height;

/**
 * THE LIGHT POOL, which is the one value that could not be imported verbatim.
 *
 * src/pro/ground.ts positions its pool at 50% 46% of a 1920 frame, which is 883px, directly under
 * a stage anchored at 845. Both numbers are fractions of the frame HEIGHT, so importing the string
 * onto a 1350 frame would put the brightest pixel at 621px, which is 100px above the top of the
 * shortest object and squarely in the empty band between the words and the picture. That is the
 * exact defect the film's own pool was repositioned to fix, and importing the number rather than
 * the intent would have reproduced it.
 *
 * So the stops are the film's, verbatim, and the position and the vertical radius follow this
 * frame: 872 of 1350 is 64.6%, and 32% of the film's 1920 is 614px, which is 45% of 1350. The same
 * physical pool, in the same place relative to the object, on a shorter sheet.
 */
export const POOL =
  "radial-gradient(56% 45% at 50% 65%, rgba(255,255,251,0.5) 0%, rgba(255,255,251,0) 74%)";

/** A fraction of the measure, rounded, so a width in the plan reads as a decision rather than as
 * an unrelated pixel count. */
export const part = (fraction: number): number => Math.round(MEASURE * fraction);
