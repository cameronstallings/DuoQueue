/**
 * THE SHEET: two sizes of one static ad, on the campaign's own stage.
 *
 * =====================================================================================
 * WHY A STATIC IS NOT A CAROUSEL CARD AT A DIFFERENT SIZE
 * =====================================================================================
 *
 * The film has eighteen seconds, so it can withhold: it opens on a line about playing alone and
 * does not say what the product is for another six seconds. The carousel has six cards, so card
 * one can tease: "find your duo" over a profile card means nothing on its own and a swipe pays it
 * off three cards later.
 *
 * A STATIC HAS NEITHER. Everything arrives at once, the eye picks its own order, and there is no
 * second beat to correct a wrong first one. So this file exists to enforce a READING ORDER out of
 * size and contrast, because the one thing a static cannot do is control where the eye starts.
 *
 * THE ORDER, AND THE PROPERTY THAT ENFORCES EACH ONE:
 *
 * Every number below is measured off the rendered file with a threshold scan rather than taken
 * off the stylesheet, because a font size is not what the eye reads: it reads INK.
 *
 *   FIRST   THE STATEMENT. It wins on SIZE and on ISOLATION. Set at 81px it puts 61px of ink
 *           between the ascender and the baseline, against 24px for the largest word the app
 *           itself draws on this sheet, which is 2.5x; the carousel's best card holds 1.87. And
 *           it is the only element standing on bare paper: #161A0F on #F6F3EA is 15.9:1, with
 *           84px of empty ground under it and 150px over it. Nothing else here is both that
 *           large and that alone.
 *
 *   SECOND  THE PRODUCT. It wins on AREA. At 600 wide on the feed it is 55.6% of the frame width
 *           and 536 tall, which is 322,000 square pixels of continuous photograph on an otherwise
 *           empty ground: four times the ink of the statement, and the only thing on the sheet
 *           casting a shadow. It cannot be read first, because it is a picture rather than a word
 *           and its own type is 40% of the statement's; it cannot be read third, because it is
 *           the largest object here by a factor of six.
 *
 *   LAST    THE ASK. It wins on COLOUR, and it is deliberately the SMALLEST of the three. The
 *           pill is 86px tall against a 536px object and a 172px statement, so size puts it last
 *           in the order; #CDFF3D on #0A0B09 is 16.9:1 and it is the ONLY saturated colour and
 *           the ONLY off-black on the whole sheet, so contrast makes it impossible to miss once
 *           the eye gets there. That is the trick of a call to action on a still: small enough to
 *           be third, loud enough to be inevitable.
 *
 * NOTHING IN THAT ORDER DEPENDS ON POSITION. Shuffle the three up the page and the order does not
 * change, because it is carried by 61px of ink against 322,000 square pixels against the one
 * saturated colour on the frame, and by 15.9:1 on empty paper against a photograph against
 * 16.9:1 on a slab a fifteenth of the object's size.
 *
 * =====================================================================================
 * THE STAGE IS THE FILM'S, UNCHANGED
 * =====================================================================================
 *
 * `GROUND`, `INK`, `MEASURE`, `TYPE`, `CAMERA` and `CENTRE_X` are re-exported from src/pro/ground
 * rather than restated, exactly as src/carousel/ground.ts does, so a change to the campaign's
 * ground is a change to these four files. The warm off-white sweep, the 745px measure, the five
 * inks and the 1400px camera are all the film's.
 *
 * WHAT IS NOT THE FILM'S IS THE POOL, and it moved for the same reason the carousel's did: a pool
 * is a light on the surface UNDER the object, so it has to follow wherever the object went. See
 * FEED and STORY below for where each one puts it.
 *
 * =====================================================================================
 * AND THE STORY IS NOT A TALLER CROP
 * =====================================================================================
 *
 * 1080x1920 is the only placement that reaches the waitlist in one tap, because it is the only
 * one that takes a link sticker. That single fact drives three differences from the feed sheet,
 * and they are differences of STRUCTURE rather than of scale:
 *
 *   1  A RESERVED BAND. STORY.sticker is 160px of deliberately empty paper at 1500-1660. Nothing
 *      is drawn there and nothing may be: it is where the sticker lands, and a sticker dropped on
 *      top of a headline is the normal failure of a story ad.
 *
 *   2  A SAFE BAND. Instagram's own chrome eats roughly the top 250px (the progress bar, the
 *      avatar, the handle, the close button) and the bottom 250px (the reply bar). So the story's
 *      first readable pixel is at 361 and its last is at 1463, and the 500px it loses to chrome
 *      plus the 207px it spends on the sticker band and its clearances is 707px: which is why a
 *      frame 570px taller than the feed ends up with a content column of 1102px against the
 *      feed's 1067, and 34px more object. That arithmetic is the answer to "make the story
 *      version bigger": there is no room to make it bigger in, because the extra 570px was spent
 *      on chrome and on the sticker before the design started.
 *
 *   3  A HEAVIER ASK. The pill is 48px here against the feed's 40px and 95px tall against 86,
 *      because this is the one sheet where the call to action is a thing a thumb can actually
 *      reach. It is upweighted where it is useful and held down where it is decoration.
 */
import { CAMERA, CENTRE_X, GROUND, INK, MEASURE, TYPE } from "@/pro/ground";

export { CAMERA, CENTRE_X, GROUND, INK, MEASURE, TYPE };

export type SizeName = "feed" | "story";

export const SIZES = ["feed", "story"] as const satisfies readonly SizeName[];

/**
 * The one side margin, both sizes. 100 of 1080 is 9.3%, which is src/carousel/ground.ts's INSET
 * unchanged, so the three still formats hang their furniture off the same edge.
 */
export const INSET = 100;

/** The gap between the two pieces of the object, in the campaign's own value. */
export const PIECE_GAP = 30;

/**
 * The mono voice, for the two lines of furniture at the foot. It is src/carousel/ground.ts's
 * LABEL, at the two sizes the two sheets need.
 */
export const MONO = { tracking: "0.18em" } as const;

export interface StaticLayout {
  w: number;
  h: number;
  /** The bottom of the statement block. It is set from here UPWARD, so a line that fits larger
   * than expected eats its own top air rather than moving the object. */
  base: number;
  /** The object: where its top edge sits and how wide it is drawn. */
  object: { top: number; width: number };
  /** The ask. `top` is the pill's top edge; the pill's height falls out of the label and pad. */
  cta: { top: number; label: number; padY: number; padX: number };
  /** The address line, with the mark beside it. */
  address: { top: number; size: number; mark: number; gap: number };
  /** The stamp: what this is, who it is for, and what it is not. */
  stamp: { top: number; size: number };
  /** Where the ground's own light pools, which is under the object and nowhere else. */
  pool: string;
  /** Instagram's chrome, on the one placement that has any. */
  safe?: { top: number; bottom: number };
  /** The band left clear for the link sticker. */
  sticker?: { top: number; height: number };
}

/**
 * 1080x1350, THE FEED SHEET.
 *
 * Read down the numbers and the composition is: 184px of air, the 172px statement, 84px, the
 * 536px object, 94px, the 86px pill, 18px, the address, 16px, the stamp, and 99px of margin,
 * which is 1350 exactly. Every gap inside the content stack is smaller than the two that bound
 * it, which is what makes four elements read as one column rather than four things on a page.
 *
 * THE OBJECT'S WIDTH IS WHAT EVERYTHING ELSE WAS SOLVED AGAINST, so it is worth stating how 600
 * was arrived at rather than presenting it as a choice.
 *
 *   WHAT FIXES IT IS THE HEIGHT LEFT OVER. 1350 - 184 - 172 - 84 - 94 - 181 - 99 = 536, and
 *   536px of this object at its two crops' own aspects is 600px of width. Nothing about 600 is a
 *   preference; it is what fits.
 *
 *   AND IT IS THEN CHECKED AGAINST TWO FLOORS, both measured off the rendered file rather than
 *   modelled. The statement's 61px of ink has to stay clear of the app's own largest word, and at
 *   600 that word renders 24px of ink, a ratio of 2.5 against the carousel's best of 1.87. The
 *   games chip has to survive being looked at on a phone, and at 600 its type renders 29px of cap
 *   height, which at the 0.361 an Instagram feed scales a 1080px file by is 10.5pt: above the
 *   point where uppercase mono stops resolving, and the reason the object was not cut further to
 *   buy air.
 *
 * The story sheet has 34px more height to spend and spends all of it here, taking the object to
 * 640 and the chip to 12.3pt. See STORY.
 */
export const FEED: StaticLayout = {
  w: 1080,
  h: 1350,
  base: 356,
  object: { top: 440, width: 600 },
  cta: { top: 1070, label: 40, padY: 20, padX: 44 },
  address: { top: 1174, size: 28, mark: 48, gap: 22 },
  stamp: { top: 1224, size: 22 },
  // Centred under the object, whose own centre lands at (440 + 976) / 2 = 708, which is 52% of
  // 1350. Its size and its alpha are src/pro/ground.ts's, unchanged.
  pool: "radial-gradient(56% 34% at 50% 52%, rgba(255,255,251,0.5) 0%, rgba(255,255,251,0) 74%)",
};

/**
 * 1080x1920, THE STORY SHEET.
 *
 * The stack is the feed's, re-spaced against Instagram's chrome and the sticker band: the 172px
 * statement bottoming at 519 with its first ink at 361, which is 111px clear of the top keep-out,
 * then 86px, the 570px object, 90px, the 95px pill, 20px, the address, 17px, the stamp, 37px, and
 * then 160px of paper that stays empty.
 *
 * THE OBJECT IS 640 HERE against the feed's 600, which is the only place the extra 570px of frame
 * shows up. Measured on the rendered file, that takes the games chip from 29px of cap height to
 * 34px, which at the 0.361 a full-bleed 1080px file scales by on a phone is 12.3pt against the
 * feed's 10.5pt, and the app's largest word from 24px to 27px, which still leaves the statement's
 * 61px of ink at 2.3x.
 *
 * THE STICKER BAND'S HEIGHT IS MEASURED RATHER THAN GUESSED. Instagram's link sticker renders at
 * roughly 95-110px tall on a 1080x1920 canvas at its default scale, and a poster drops it by
 * thumb rather than by coordinate. 160px is that plus a 25px margin on each side, which is the
 * slop a hand actually has. It sits 40px below the last line of the lockup so the sticker reads
 * as the tappable twin of the printed address rather than as a thing stuck on top of the ad, and
 * it ends 10px above the bottom keep-out.
 */
export const STORY: StaticLayout = {
  w: 1080,
  h: 1920,
  base: 519,
  object: { top: 605, width: 640 },
  cta: { top: 1265, label: 48, padY: 20, padX: 50 },
  address: { top: 1380, size: 30, mark: 52, gap: 24 },
  stamp: { top: 1434, size: 24 },
  // The object's centre is at (605 + 1175) / 2 = 890, which is 46% of 1920.
  pool: "radial-gradient(56% 26% at 50% 46%, rgba(255,255,251,0.5) 0%, rgba(255,255,251,0) 74%)",
  safe: { top: 250, bottom: 1670 },
  sticker: { top: 1500, height: 160 },
};

export const LAYOUT: Record<SizeName, StaticLayout> = { feed: FEED, story: STORY };
