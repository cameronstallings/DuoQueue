/**
 * THE CAROUSEL'S GRID, and it is the film's grid re-solved for a 4:5 frame.
 *
 * =====================================================================================
 * WHAT IS INHERITED, LITERALLY
 * =====================================================================================
 *
 * Everything below that is not a vertical position is IMPORTED from src/frag/ground.ts
 * rather than restated: the ground colour and its sweep, the three inks, the tilt, the
 * shadow, the left edge, the measure, the type cap and its leading. Not "the same values",
 * the same constants. A carousel that reads as a different campaign than the film is worse
 * than no carousel, and the only way to guarantee it does not is to have one file own the
 * numbers and this one own nothing but the arithmetic that changes with the aspect.
 *
 * The frame is 1080x1350 because that is the tallest an Instagram feed post is allowed to
 * be, so it takes the most vertical space in a scroll. The WIDTH is unchanged from the
 * film's 1080, which is why X0, MEASURE and TYPE_CAP transfer without conversion: every
 * horizontal decision the film made is a decision about a 1080px field and this is the same
 * field. Only the height moved, from 1920 to 1350, and only the vertical constants below
 * had to be re-solved.
 *
 * =====================================================================================
 * WHAT THIS FORMAT HAS THAT THE FILM DOES NOT
 * =====================================================================================
 *
 * No timing, no sync, no read rate. A viewer holds a card for as long as they want and
 * leaves whenever they want, so the entire budget goes into composition and into one
 * question the film never has to answer: WHY DOES ANYBODY SWIPE. Two pieces of furniture
 * exist for that and nothing else.
 *
 *   THE SPINE. Every card carries a mono label at its top left naming the stage of the
 *   product loop it is: the deck, the match, the duo, the thread, the game, the waitlist.
 *   Six named stages tell a reader on card one that there IS an end and roughly what it is,
 *   which is the difference between swiping and scrolling past. It is set in the app's own
 *   IBM Plex Mono, at the same weight and tracking the end card sets duoqueue.io in, and it
 *   is the same register the app itself uses for HIGHLIGHTS and for ROCKET LEAGUE, so it is
 *   inherited furniture rather than invented furniture.
 *
 *   THE COUNTER AND THE CHEVRON. Bottom left says which card of how many. Bottom right is
 *   the double angle, which is not a stock arrow: it is the glyph the app draws in front of
 *   its own overlap chip, the one reading 3 GAMES IN COMMON that card two is built on. The
 *   swipe cue is a piece of the product's own typography.
 *
 * Both are at 26px on a 1080 field, about 2.4% of the width. They are the smallest type in
 * the set by a factor of three and they are supposed to be: furniture that competes with the
 * headline is furniture that has been drawn wrong.
 */
import {
  GROUND,
  INK,
  MEASURE,
  PIECE_GAP,
  SHADOW,
  TILT,
  TYPE_CAP,
  TYPE_LEADING,
  X0,
} from "@/frag/ground";

export { GROUND, INK, MEASURE, PIECE_GAP, SHADOW, TILT, TYPE_CAP, TYPE_LEADING, X0 };

/** 4:5. The tallest a feed post may be, and therefore the most of a scroll one can occupy. */
export const CARD_W = 1080;
export const CARD_H = 1350;

/**
 * ONE INSET, USED ON ALL FOUR SIDES, and it is the film's X0.
 *
 * The film only ever needed a left edge, because its type and its objects were the only
 * things on the frame and both hung off one column. A still has corners, and four corners
 * inset by four different numbers is what makes a layout look assembled rather than set. So
 * the eyebrow's top, the counter's bottom and both side margins are all 118, and the eye
 * reads one frame rather than one column with decoration around it.
 */
export const INSET = X0;

/** The mono furniture. 26px is about 2.4% of the frame width, and the wide positive tracking
 * is what makes a small line read as a label rather than as a shrunken sentence. */
export const LABEL = {
  size: 26,
  leading: 32,
  tracking: "0.18em",
} as const;

/**
 * THE SWIPE CUE'S SLAB. Off-black, square cornered, carrying raw chartreuse: ./Lockup.tsx's
 * call to action at furniture scale, for the reason ./Card.tsx's `Cue` states at length.
 *
 * 52 tall against the label's own 32px line, so the ink has 10px of air above and below it and
 * the shape reads as a button rather than as a highlight behind a word. 22 across, which is
 * ./Lockup.tsx's 42 halved to the nearest even number, because that file's padding is set for
 * a 68px face and this one carries a 26px one.
 */
export const CUE = { height: 52, pad: 22 } as const;

/** The brand mark, top right, on every card but the last one, which carries the full lockup
 * and does not need a second mark on the same frame. 64px wide is 5.9% of the frame: a
 * masthead, not a logo placement. A card gets screenshotted and sent on its own, so each one
 * has to say whose it is without the account name above the post. */
export const MARK_W = 64;

/**
 * THE TYPE BASELINE, and like the film's it is the BOTTOM of the block rather than its top.
 *
 * Four of the six cards are one line and two are two lines, and anchoring at the bottom is
 * what makes a reader's eye land in the same place on all six. Anchoring at the top would
 * put the one line cards' words 102px higher than the two line cards' last line, which
 * across a swipe reads as the type jumping.
 *
 * 440 is 32.6% down a 1350 frame against the film's 640 at 33.3% of 1920, so the words sit
 * at the same height in the frame as they do in the finished ad.
 */
export const TYPE_BASE = 440;

/**
 * THE FOOTER LINE. The cue slab's BOTTOM lands on the frame's bottom inset, 1232, matching the
 * eyebrow's inset at the top, and the counter is centred on the slab rather than sharing a top
 * edge with it, because a filled shape and a line of type never do.
 *
 * This is 10px above where the counter used to sit, which is the whole of what changed: the
 * furniture is one horizontal line and the slab is the taller thing on it, so the line is now
 * solved from the slab.
 */
export const FOOTER_TOP = CARD_H - INSET - CUE.height + (CUE.height - LABEL.leading) / 2;

/**
 * THE OBJECT BAND, re-solved, and the second version of it is a shadow measurement.
 *
 * The film clamps an object's top into [800, 1000] on a 1920 frame and centres it on 1130.
 * Those are 41.7% to 52.1% and 58.9%. The clamp exists for the same reason it does there: the
 * objects on these six cards run from a 331px pair of chips to a 519px lock screen, and
 * centring all of them on one line would leave the shortest marooned 260px below the type with
 * nothing in between.
 *
 * WHAT MOVED, AND WHY IT IS A MEASUREMENT RATHER THAN A PREFERENCE. The first version of this
 * band centred on 866 and clamped to [560, 720], reasoning that a 4:5 frame has no platform
 * chrome over its bottom edge so the stage is free to sit lower than the film's. It has
 * something else instead, which the film does not: a counter and a swipe cue INSIDE the frame,
 * at 1208 to 1225. Measured on the delivered PNGs, SHADOW's long cast is still 93px below an
 * object's bottom edge at a plainly visible 6 luma under the ground, and 100 to 126px at 3.
 * Card one's object bottomed at 1138 and its shadow therefore reached 1231: it ran BEHIND the
 * counter, and card three's reached 1248 and ran past it. Neither is a collision a reader would
 * name and both are the sort of thing that makes a set look assembled rather than set.
 *
 * 840 with a ceiling of 700 puts the lowest object bottom at 1110 and its shadow at 1203, clear
 * of the counter's ink on every card. The gap between the type's baseline and the top of the
 * object now runs 130 to 235px, 9.6% to 17.4% of this frame's height, against the film's
 * measured 10.4% to 18.8%. The same interval, on a shorter frame, with the bottom paid for.
 */
export const STAGE_Y = 840;
export const TOP_MIN = 560;
export const TOP_MAX = 700;

/**
 * THE LIGHT POOL, and it is the one thing in this file that could not be imported.
 *
 * src/frag/ground.ts positions its pool at 58% of a 1920 frame, which is 1114px, directly
 * under a stage centred on 1130. Imported unchanged onto a 1350 frame that stop lands at
 * 783px, which is 83px ABOVE the type's baseline and 133px above the top of the shortest
 * object: the brightest pixel on the card would be the empty gap between the words and the
 * picture. That is the exact defect the film's pool was moved to fix, and importing the
 * number rather than the intent would have reproduced it.
 *
 * So the stops are the film's, verbatim, and only the position follows the stage: 64% of
 * 1350 is 866, which is STAGE_Y. The light falls where the object is.
 */
export const POOL =
  "radial-gradient(58% 30% at 42% 64%, rgba(255,255,251,0.5) 0%, rgba(255,255,251,0) 74%)";

/** A fraction of the measure, rounded, so the sizes in the plan read as decisions rather
 * than as unrelated pixel counts. Same helper, same intent, as src/frag/plan.ts. */
export const part = (fraction: number): number => Math.round(MEASURE * fraction);
