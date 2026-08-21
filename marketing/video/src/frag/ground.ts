/**
 * THE LAYOUT SYSTEM, in one file, stated before it is used.
 *
 * =====================================================================================
 * WHAT THIS DIRECTION IS, and what it is a reaction to
 * =====================================================================================
 *
 * Cameron rejected five versions of the kinetic direction and three alternates, then sent
 * three reels he does want to look like: a ClickUp promo, a food delivery promo, an Uber promo.
 * Watched rather than summarised, the five things they share are these, and this file is those
 * five things turned into numbers.
 *
 *   1  ONE LIGHT GROUND, held for the whole film. Near white or one flat colour, never black,
 *      and it never changes. Uber's does not cut to a dark card at the end and neither does
 *      this one; see END CARD below, which is the one place that decision cost something.
 *   2  UI AS ISOLATED FRAGMENTS. Not one of the three shows a whole phone. They pull ONE
 *      element out and let it own the frame: a single ride list, one task chip, one price card.
 *      This is the important one and it is the answer to Cameron's "you cannot see the app".
 *      The last cut answered that note by shrinking a whole phone until everything fit, which
 *      made every element small. A card cropped to its lower half and drawn 844px wide renders
 *      its own prompt text at 38px on a 1080 frame; the same card inside a whole phone screen
 *      at the same frame width renders it at 12.
 *   3  SMALL TYPE, ENORMOUS NEGATIVE SPACE. Measured off the references: Uber's "move your way"
 *      is about 37% of frame width at about 3% of frame height, which on a 1080x1920 frame is
 *      roughly a 58px face. TYPE_CAP is 58. Every previous cut of this film ran 300 to 450px.
 *   4  DIMENSIONAL. Tilted objects with soft shadows on a lit ground, not flat rectangles
 *      pasted on a swatch. See TILT and SHADOW.
 *   5  A CLEAN WORDMARK CLOSE.
 *
 * =====================================================================================
 * THE BRAND TENSION AND HOW IT IS RESOLVED
 * =====================================================================================
 *
 * DuoQueue is off black #0A0B09 with chartreuse #CDFF3D, and the chartreuse is the only colour
 * that makes it recognisable. On a near white ground chartreuse is about 1.4:1, effectively
 * invisible; on the off black it is about 13:1. So nothing here recolours the app to sit on a
 * light ground. The DARK app UI is the object and the LIGHT ground is what it sits on: a near
 * black chartreuse-accented fragment floating on warm off-white is high contrast, keeps the
 * brand, and gets the bright feed presence the references have.
 *
 * Every colour below except the ground itself is an app token, imported rather than retyped, so
 * a brand change moves the film with it. The ground is the one authored colour in the file, and
 * the honest thing to say about it is that no near-white ground can rescue the light theme.
 * The app's own paper is #F2F4EB; a light-theme fragment on any ground in that neighbourhood
 * has an edge contrast of about 1.03:1 and therefore no silhouette at all, only its shadow.
 * An earlier version of this file warmed and darkened the ground to buy the light cut an edge,
 * and what that bought instead was a beige film that did not look like the references. The
 * ground is now set by the references and the light theme is left to be judged on it, which is
 * the comparison Cameron shot two recordings to get. Note that white-on-white with a shadow is
 * exactly what the Uber reel does, so this is not automatically fatal; see the finding on
 * where the light cut actually loses, which is brand colour and interior contrast.
 */
import { darkColors, lightColors } from "@app/theme/tokens";

/**
 * The ground. A vertical sweep rather than a flat fill, plus a soft pool of light behind the
 * object, because a flat swatch reads as a slide and a lit sweep reads as a surface. It is also
 * the cheapest insurance against H.264 banding, which a 1080x1920 field of one near-white
 * value will show every time.
 *
 * The sweep is 178 degrees and not 180 on purpose: a gradient exactly on the axis bands in
 * horizontal stripes, and two degrees of tilt breaks the stripe into a diagonal the encoder
 * dithers away.
 *
 * THESE NUMBERS WERE MEASURED AGAINST THE REFERENCES AND THEN CORRECTED. The first version of
 * this ground ran #F7F4EC to #E8E2D1: 222 to 249 in luminance, 27 steps of falloff, and warm
 * enough to be beige. Sampled beside them, Uber is a flat #FFFFFF at 243 to 255 with 12 steps
 * and ClickUp is a flat #FCF9FD, so ours was about 20 luma darker with 2.2x the vignette. Side
 * by side theirs read as lit white paper and ours read as cream card stock under a lamp, and
 * the bright feed presence the references have comes partly from that flat near-white.
 *
 * So, measured on the render: 239 to 248, nine steps of falloff, still warm and no longer beige.
 * It is not pure white, because a film whose objects are near-black rectangles wants a ground
 * with some body to it, and the grain in Frag.tsx needs somewhere to sit.
 *
 * It is still about 6 luma under Uber and it stops there deliberately. The only stop that was
 * lifted between the two versions of this file is the BOTTOM one, the vignette floor; the mid
 * stop, which is the value directly behind every object, did not move. Going the last 6 luma
 * would have to move that mid stop, and the thing it is behind in one of the two deliverables
 * is a #F1F2E8 card. Reference fidelity is worth buying up to the point where it starts
 * deciding the experiment's answer, and no further.
 *
 * The pool moved too, and for a specific defect. At 50% height and 0.9 alpha the brightest
 * pixel on the frame was at 44%/48%, which was the empty gap between the type and the object:
 * the brightest thing on screen was the ground. It now sits under the STAGE and is half as
 * strong, so the light falls where the object is.
 */
export const GROUND = {
  base: "#F6F3EA",
  sweep: "linear-gradient(178deg, #FAF8F2 0%, #F6F3EA 52%, #F3EFE5 100%)",
  pool: "radial-gradient(56% 32% at 42% 58%, rgba(255,255,251,0.5) 0%, rgba(255,255,251,0) 74%)",
} as const;

/**
 * The inks. Three, and each one is the app's own answer to a question this film asks.
 *
 *   `type`   is the app's light-theme text. The film's words are set in the same near black the
 *            app sets its own words in when it is on paper.
 *   `accent` is the app's light-theme `volt`. This is the important one: the app already knows
 *            that chartreuse is illegal at type scale on paper and resolves it to an olive ink,
 *            so the film's key word is the brand's accent rendered the way the brand renders it
 *            on this ground rather than a fourth colour somebody chose.
 *   `brand`  is raw chartreuse, and it appears exactly twice: burning inside the dark app
 *            fragments, where it belongs, and on the end card's call to action, which is set on
 *            an off-black slab so it has 13:1 to work with.
 */
export const INK = {
  type: lightColors.text,
  muted: lightColors.textMuted,
  accent: lightColors.volt,
  brand: darkColors.voltRaw,
  slab: darkColors.background,
} as const;

/**
 * THE GRID. One measure, one left edge, one stage centre, for every beat of the film.
 *
 * X0 is the left edge of the type AND of every object. That is the whole grid: a single
 * left-aligned column, which is what the Uber reel does and what stops six differently shaped
 * fragments from reading as six unrelated slides. MEASURE is 1080 - 2 * X0, so the widest
 * objects are symmetrically inset and the narrow ones hang off the same edge with the air
 * falling on the right.
 *
 * STAGE_Y is where an object WOULD be centred, and it is still what the end card's lockup uses,
 * because the brand arriving in the place the product just vacated is the point of that seam.
 * For a body object it is now only the input to the clamp in TOP_MIN / TOP_MAX below: centring
 * is the right rule when every object is about the same size and these differ by a factor of
 * six, so the centre is computed and then pulled into a band. See TOP_MIN.
 *
 * 1130 rather than the solved centre, and the difference is bought deliberately. Instagram and
 * TikTok both stack their own chrome over roughly the bottom 290px of a 1920 frame, so the
 * stage sits above the true centre and the tallest object in the film clears that line.
 *
 * The first render of this direction had this at 1035 with the band at 400, which put 380px of
 * air above every object and 570 below it. That is what a composition looks like when the centre
 * was picked instead of solved: nothing is wrong with any single element and the frame is
 * visibly top heavy.
 */
export const X0 = 118;
export const MEASURE = 1080 - X0 * 2;
export const STAGE_Y = 1130;

/**
 * THE HANG BAND, and it is what replaced centring every object on STAGE_Y.
 *
 * Centring is the right rule when every object is roughly the same size. These are not: the
 * playstyle chip is 113px tall on the frame and the DUO LOCKED card is 644, a factor of six.
 * Centred, that put the top of a chip 500 to 590px below the bottom of the type, which is 26
 * to 31% of the frame height of nothing between the two things the frame is made of. Measured
 * on the first render, the brightest pixel on those frames was in that gap.
 *
 * So an object's top is the stage centre minus half its height, CLAMPED into this band. A tall
 * object rises to TOP_MIN and a short one falls no lower than TOP_MAX, and the gap between the
 * type's baseline and the top of the object is 200 to 360px instead of 200 to 590. The air the
 * references have is still there; it has moved to below the object, where Uber puts it, rather
 * than sitting between the words and the picture.
 *
 * TOP_MIN is 160px under TYPE_BASE, which is the film's tightest vertical interval. TOP_MAX is
 * 200 further down, and it binds only on the four fragments under 210px tall. The tallest stack
 * in the film is the opening card with its action row at 745, so the lowest anything reaches is
 * 1545, which is 85px clear of the ~1630 line where Instagram and TikTok start stacking their
 * own chrome over the frame.
 */
export const TOP_MIN = 800;
export const TOP_MAX = 1000;

/**
 * The type band. `TYPE_BASE` is the bottom of the block, not its top, so a one line beat and a
 * two line beat share a baseline instead of a top edge and the eye has one line to return to
 * across six cuts.
 *
 * TYPE_CAP is the reference measurement from the header: 58px is about 3% of the frame height,
 * which is where all three reels set their display type. It is a cap and it binds, which is the
 * intended outcome: the longest line in the script measures 471px inside an 844px measure, so
 * spelling decides nothing and the size is a decision stated in one number.
 */
/**
 * 640, and it moved down from 470 for the same reason the hang band exists. The type block is
 * anchored at its BOTTOM so a one line beat and a two line beat share a baseline rather than a
 * top edge, and the eye has one line to come back to across six cuts. Where that baseline sits
 * decides how far the words are from the picture, and 470 put them a third of a frame apart.
 */
export const TYPE_BASE = 640;

/**
 * 76, and this one was measured wrong the first time in the direction nobody expected.
 *
 * The reference measurement is real: Uber and ClickUp set their display type at about 3 to 4.5%
 * of frame height, and every previous cut of this film ran 300 to 450px, so the cap exists to
 * stop that. But 58 overshot. Measured on the delivered file, the hero line's ink was 43px, or
 * 2.24% of frame height, against ClickUp's 3.44% and Uber's 4.53%: 35% smaller than one
 * reference and 49% smaller than the other, at or below the bottom of their range on every
 * reading.
 *
 * The consequence was a hierarchy inversion. The app's own interface copy inside the fragments
 * lands at 33 to 45px by design, so the film's voice was set at exactly the same size as the
 * app's, and on the prompt beat the app's text was LARGER and three and a half times wider.
 * Uber's overlay runs about 1.4x its card's interior type. Ours ran 1.0x.
 *
 * 76 puts the ink at about 56px, 2.9% of frame height. That is still smaller than both
 * references, and it is 1.25 to 1.7x the app type inside the fragments, so the film's own words
 * are the largest thing on the frame again without going back to the type that was rejected.
 * The cap still binds: the longest line, "send a message", measures about 592px inside an 844px
 * measure, so spelling decides nothing.
 */
export const TYPE_CAP = 76;

/**
 * Leading for the display type, and it is looser than the other directions on purpose.
 *
 * Stack masks each line with `overflow: hidden` at exactly `size * leading`, which is what makes
 * the waterfall read as words rising out of a slot. The other directions pass 1.02, and at 1.02
 * the box is 59px for a 58px face whose own content box is 1.366em: the baseline sits 51.8px
 * down and the lowercase tail reaches 14.8px below it, so the q of "queue", the p of "up" and
 * the y of "play" are cut off 7.6px short. At 1.34 the box is 77.7px, the tail lands at 75.3px,
 * and nothing clips.
 *
 * It does not read as loose, which is the thing worth checking rather than assuming: the gap
 * between one line's descender and the next line's cap comes out at 19px, about a third of an
 * em, because the box is sized to hold the face rather than to hold the caps.
 *
 * The ratio is what matters, so it survived the cap going from 58 to 76: the box is 101.8px for
 * a 76px face and the lowercase tail reaches 98.7px, still inside it. No sampled frame in
 * either delivered cut has a clipped descender.
 */
export const TYPE_LEADING = 1.34;

/**
 * THE TILT, and it belongs to the STAGE rather than to each object.
 *
 * One perspective container and one rotation applied to every fragment, so six different
 * objects across six beats read as six views from one camera position instead of six separately
 * art-directed cards. Positive rotateY pushes the right edge away and brings the left edge
 * forward, which puts the near edge under the type and throws the shadow down and to the right,
 * away from the reading direction.
 *
 * 7 degrees at a 2400px perspective is a 3.7% width difference across an 844px card. That is
 * enough to be unmistakably dimensional and small enough that the app's own mono type, which is
 * the thing Cameron cannot currently see, loses nothing to the foreshortening.
 */
export const TILT = {
  perspective: 2400,
  origin: "44% 54%",
  transform: "rotateY(7deg) rotateX(2deg)",
} as const;

/**
 * The shadow, and it is the only shadow in the film. The type does not cast one, the ground
 * does not have one, the end card does not have one. One light source, upper left, agreeing
 * with the tilt.
 *
 * Two layers because one never works: a tight contact shadow that says the object is a
 * millimetre off the surface, and a long soft cast that says the surface is lit. A single
 * medium blur reads as a drop shadow filter, which is the thing that makes a mockup look cheap.
 */
export const SHADOW =
  "16px 10px 26px rgba(41,34,18,0.10), 38px 44px 92px -20px rgba(41,34,18,0.28)";

/** Vertical air between two fragments shown together. Only beat two has two. */
export const PIECE_GAP = 46;

/**
 * THE CURRENT, as pixels per frame.
 *
 * Every object and the type block drift LEFT at this constant rate for the whole of their beat,
 * re-centred so each beat is symmetric about the grid and the drift never accumulates. The
 * entry decelerates into it and the exit accelerates out of it, so an object is moving left on
 * every frame it exists and never once parks.
 *
 * This is the doctrine's sustained-motion route and it is doing real work here rather than
 * satisfying a rule. Four of the six fragments are STILL HOLDS: the cutter chose windows where
 * the app is not animating, because a fragment that is being drawn is a fragment you cannot
 * read. Without a carrier this film would have four beats of frozen pixels. 1.25px a frame is
 * 61px across the shortest beat and 88px across the longest, which is visible on a hard-edged
 * near-black object against a pale ground in a way that 1.8px a frame was not visible on the
 * blurred grey plate the number in motion.ts was tuned against.
 */
export const CRUISE = 1.25;
