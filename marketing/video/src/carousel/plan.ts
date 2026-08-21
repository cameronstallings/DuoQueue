/**
 * SIX CARDS, SIX IDEAS, ONE ARGUMENT, and the last one is the ask.
 *
 * =====================================================================================
 * THE COPY IS THE FILM'S COPY
 * =====================================================================================
 *
 * Every headline below except card one's is a clause of src/pro/script.ts, in the film's own
 * authored break, with the film's own accent word. That is not laziness, it is the whole point of
 * a campaign: a person who watches Pro-B and then swipes this set should hear the same four
 * sentences twice, not two adjacent pieces of writing about the same product.
 *
 * Card one is the exception and it is written for the job the film never has to do. A film has
 * eighteen seconds and a voice; a carousel has a THUMBNAIL, about 470 display pixels of a
 * stranger's feed with no caption read yet and no sound. The film's opening line, "your best games
 * were the ones you played with someone else", is the best sentence in the campaign and it is
 * eleven words: set at the measure it is three lines at 72px, which is thirteen display pixels in
 * a feed. It cannot stop a scroll. Three words can: "find your duo" fits the measure at the
 * clamp's own 138px, which is sixty display pixels, and it says what the product is with no
 * context at all. The eleven word version is in the caption, where a reader who has already
 * stopped can have it.
 *
 * =====================================================================================
 * EVERY WORD ON A CARD IS EVIDENCED BY THAT CARD'S OBJECT
 * =====================================================================================
 *
 * This is the rule that has caught two of Cameron's notes and it is stricter on a still than on a
 * film, because a still is held for as long as a reader wants to hold it. So:
 *
 *   1  "find your duo"                      a real person, a real game, the app's own NO. 001
 *   2  "you match on the games you play      ">> 3 GAMES IN COMMON", the app's own count, and
 *       and how you play them"               "ROCKET LEAGUE . Ranked Grinder", its own playstyle
 *                                            tag. Two clauses, two pieces of evidence, one card
 *   3  "lock the duo"                        the app's own DUO LOCKED banner
 *   4  "send a message"                      the app's own button and the message it produced
 *   5  "then go play"                        daylight on Breeze, and not the app
 *
 * Nothing on any of the six contradicts the voice. `prompt` and `card-lower` are absent from the
 * piece table for the reason src/pro/media.tsx gives: both crops contain "SOLO QUEUE" at a size
 * that would be among the most legible text in the post, and a set about finding a duo does not
 * print that. `card-top` is the crop that stops above it.
 *
 * =====================================================================================
 * WHY THE SET IS SHAPED THIS WAY RATHER THAN ONE BEAT PER CARD
 * =====================================================================================
 *
 * The film's beat three is one sentence with two halves and it spends 140 frames morphing one chip
 * into the other. A carousel cannot morph, and the two chips are 131 and 94 pixels tall at the
 * film's own widths: either of them alone on a 1350px frame is a thin bar on a field of nothing,
 * which is the largest void the old set had and the thing that made it read as unfinished. So they
 * are ONE card, stacked, both drawn at the full measure, sharing a left edge and a right edge and
 * one perspective pose, which is what makes two crops of different shapes read as one object
 * rather than as two clippings.
 *
 * The set is also paced tonally, which a film gets from time and a still set has to get from
 * order: a face on card one, the quietest two cards in the middle, the campaign's largest area of
 * raw chartreuse on card four, daylight on card five, and the lockup on six. Five dark rectangles
 * in a row on warm paper is a texture, not a sequence.
 *
 * =====================================================================================
 * THE POSE IS THE FILM'S OWN, AND IT ALTERNATES
 * =====================================================================================
 *
 * An object here is not tilted, it is CAUGHT: each card holds its object at a fraction of one of
 * the two poses the film actually spends, so every angle in the set is a frame Pro-B contains
 * rather than an angle somebody liked. `arrival` is ARRIVAL from src/pro/motion.ts, the measured
 * eight frame unwind that every object in the film enters on; `gesture` is GESTURE, the mid-beat
 * perspective punctuation the film spends exactly twice.
 *
 * They alternate in sign across the swipe, and the amounts fall as the set goes on: 0.38 of an
 * arrival, 0.35 of a gesture, 0.30, 0.45, 0.22, then flat on the lockup. Swiped in order the
 * object rocks and then settles, which is a thing a carousel can do that a single still cannot,
 * and it costs nothing but a number.
 */
import { FRAGMENTS, type FragName } from "@/pro/media";

import { MEASURE, part } from "./ground";

/**
 * THE PIECE TABLE. One row per region of the phone screen the set uses, with the clip that carries
 * it and the crop's own pixel size, which is what the object is drawn at so nothing is ever
 * stretched or letterboxed.
 *
 * DARK, and that is the campaign's central decision rather than a preference.
 * Chartreuse is about 1.4:1 on a near-white ground and about 13:1 on the app's own off-black, so a
 * light-theme fragment on this ground deletes the one colour that makes DuoQueue recognisable. The
 * ground is light, the product is dark, the product is the object and the ground is what it sits
 * on. It is also what Pro-B is, and Pro-B is the film this set has to be recognisably part of.
 *
 * IT IS A VIEW ONTO src/pro/media.tsx'S TABLE RATHER THAN A SECOND TABLE. The old file restated
 * every clip name and every crop size beside the film's own copy of them, so a re-cut of a
 * fragment had to be applied twice and the two could disagree without anything failing. These are
 * the film's own keys; the crop sizes come off `FRAGMENTS`; and a name that is not a fragment the
 * film has does not compile. `duo`, the settled DUO LOCKED banner, was added to that table for
 * this set, because the film wants the reticle closing and a still wants it closed.
 */
export const PIECES = [
  "card",
  "games",
  "role",
  "duo",
  "send",
  "bubble",
  "play",
] as const satisfies readonly FragName[];

export type PieceName = (typeof PIECES)[number];

/** The crop's own pixels, which is what a piece is drawn at so nothing is ever stretched. Read off
 * the film's table rather than restated, so a re-cut of any of these moves both deliverables. */
export const sourceOf = (piece: PieceName): readonly [number, number] =>
  FRAGMENTS[piece].source;

/** The dark half of the film's table, which is the half this set uses. `FragName` is imported so
 * that a piece named here has to be a piece the film actually has. */
export type { FragName };

/**
 * A rectangle INSIDE a piece's own source pixels, drawn instead of the whole thing.
 *
 * =====================================================================================
 * IT IS NOT A GENERAL CROP TOOL. IT IS THE ANSWER TO "A STILL IS HELD"
 * =====================================================================================
 *
 * Every fragment in src/pro/media.tsx was cut for a film, where a piece is on screen for one to
 * two seconds, under a moving object, at a size the eye is still catching up with. A carousel card
 * is held for as long as a reader wants to hold it. Three of the film's crops carry something that
 * survives that and none of them can be re-cut, because re-cutting the file would move pro-a,
 * pro-b and pro-c, which are approved and must not change. So the piece declares the rectangle it
 * actually wants, the renderer scales the clip up and offsets it, and public/footage stays byte
 * for byte as the cutter left it.
 *
 * 1. `frag-play` IS A REDACTION THAT IS 44px SHORT. src/data/clips.ts records it as 1660x934 at
 *    450,300 of a 2560x1440 spectator capture and says every number in that rectangle is a
 *    redaction, because the full frame carries a minimap, a killfeed and real gamertags. A rounded
 *    grey chip belonging to the game's own chrome survives at source x 0 to 37, y 32 to 77, cut in
 *    half by the crop's left edge. In the film it is inside a 1.7 second beat under a moving
 *    object and nobody sees it. Held, it is a flat 20 by 23 rectangle of exactly rgb(117,117,117)
 *    hard against the object's edge: the only unambiguously broken pixels in the set. `x: 48`.
 *
 * 2. `frag-play` IS ALSO TOO DARK TO BE A STILL, and that is arithmetic rather than taste. It is
 *    the reason card five is the one object in the set whose SIZE is set by its area. It is not a
 *    second reason to crop: measured, the rectangle is uniformly dark and cropping it buys area
 *    rather than luminance. See the note on card five.
 *
 * 3. `frag-dark-role` IS A CHIP WITH ITS OWN BORDER, AND THE CROP DOES NOT AGREE WITH IT.
 *    public/footage/README.md cuts it at 670:90:120:1490. Measured off the frame at 6x, the app's
 *    chip inside that rectangle runs x 17 to 651 and y 0 to 82: the crop carries 17px of Kofi's
 *    photograph to the left of the chip, 19px to the right and 8px below it, and it clips the
 *    chip's TOP border off entirely.
 *
 *    Drawn whole at the measure, what that produces is a rounded rectangle containing a second,
 *    smaller, differently rounded rectangle whose outline is present on three sides and absent on
 *    the fourth, with a hairline running diagonally out of the top right corner where the border
 *    leaves the crop. On a moving morph nobody reads it. Held on paper it is the one object in the
 *    set that looks mis-cropped rather than lifted. `{18, 0, 630, 80}` is the chip's own interior,
 *    so the object's edge IS the chip's edge and there is no box inside the box.
 */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Placed {
  piece: PieceName;
  /** In frame pixels. Every content object in this set is the MEASURE or a stated fraction of it;
   * see the note on card five for the one width that used to be neither. */
  width: number;
  /** Rounds the crop's own corners, which is what turns a rectangular region of a screen recording
   * into an object. Smaller on the chips, whose crops sit closer to the content inside them. */
  radius: number;
  /** The sub rectangle of the clip to draw. The whole clip by default. */
  crop?: Crop;
}

/** A fraction of one of the two poses the film actually spends. See the header. */
export interface CardPose {
  kind: "arrival" | "gesture";
  amount: number;
}

export interface CarouselCard {
  /** The spine, foot left. Lower case here and drawn upper case, because the string is copy and
   * the capitals are typography. */
  label: string;
  /** The headline, in its authored break. Never a single word on a line of its own. */
  lines: string[];
  /** The one word set in the light theme's volt. Matched whole-word and case insensitively. */
  key?: string;
  /** Top to bottom, which is the order the eye reads them and the order the app puts them in. */
  pieces: Placed[];
  pose: CardPose;
}

/** The gap between two pieces stacked as one object. 30px at this scale is under a third of the
 * shorter piece's height on both cards that use it: close enough that the two read as one thing,
 * open enough that they are plainly two crops rather than one bad one. */
export const PIECE_GAP = 30;

export const CARDS: CarouselCard[] = [
  // 01. THE THUMBNAIL. Three words at the clamp's own ceiling over the strongest object the app
  // owns: the deck card from its true top edge down to just under the playstyle chip, at the full
  // measure, so its own type renders at about 62px for the name and 29px for the chip. A real
  // face, a real game, a chartreuse serial number, and three words that need no context.
  {
    label: "the deck",
    lines: ["find your duo"],
    key: "duo",
    pieces: [{ piece: "card", width: MEASURE, radius: 24 }],
    pose: { kind: "arrival", amount: 0.38 },
  },
  // 02. The film's beat three entire, with both halves of its evidence, as one stacked object.
  // Both chips are drawn at the full measure, which is a 1.52x enlargement of the overlap chip and
  // a 1.18x of the playstyle chip, so their own type lands at about 45px and 41px. Sharing a right
  // edge as well as a left one is what makes two crops of different shapes read as one object.
  //
  // THE PLAYSTYLE CHIP IS CROPPED TO ITSELF, which is the correction. See `Crop` above: the film's
  // rectangle carries 17px of Kofi's photograph on one side of the chip and 19px on the other,
  // clips the chip's top border and keeps its bottom one, and the result held on paper is a
  // hairline leaving the top right corner at an angle. This is the only object in the set whose
  // defect was visible at 1:1 and invisible in the thumbnail.
  //
  // The two are NOT drawn at a common source scale, and that is a decision rather than an
  // oversight: a common scale that keeps the playstyle chip at the measure puts the overlap chip
  // at 545, and the pair then reads as two clippings that happen to be near each other. A shared
  // left edge and a shared right edge is what reads as one object, and the price is that the app's
  // own type is 45px on one and 41px on the other. 4px is a price. 200px of ragged right edge is
  // not.
  //
  // The amber is the app and not a choice: tokens.ts buckets any overlap of three or more as
  // `many` and paints it #FFB627. Nothing here recolours app footage.
  {
    label: "the match",
    lines: ["you match on", "the games you play", "and how you play them"],
    key: "how",
    pieces: [
      { piece: "games", width: MEASURE, radius: 18 },
      { piece: "role", width: MEASURE, radius: 16, crop: { x: 18, y: 0, width: 630, height: 80 } },
    ],
    pose: { kind: "gesture", amount: 0.35 },
  },
  // 03. The payoff, and the only portrait object in the set, which is what makes it feel like a
  // different kind of frame without changing a single rule. 56% of the measure is the largest it
  // can be drawn and still keep its shadow's long cast clear of the foot row; see STAGE_CY in
  // ./ground. Its own DUO LOCKED still draws at about 29px cap, so nothing legible was traded.
  {
    label: "the duo",
    lines: ["lock the duo"],
    key: "lock",
    pieces: [{ piece: "duo", width: part(0.56), radius: 26 }],
    pose: { kind: "arrival", amount: 0.3 },
  },
  // 04. The button and the message it produced, which the film shows as two moments and a still
  // shows as one object with two parts, because a still has no second moment to spend. The button
  // is the largest area of raw chartreuse anywhere in the campaign, and this is where the set
  // spends its colour.
  {
    label: "the thread",
    lines: ["send a message"],
    key: "message",
    pieces: [
      { piece: "send", width: MEASURE, radius: 22 },
      { piece: "bubble", width: part(0.56), radius: 22 },
    ],
    pose: { kind: "gesture", amount: 0.45 },
  },
  // 05. Daylight, and the only landscape object in the set. A duo finder is supposed to end
  // outside itself, so the last card before the ask is not the app; it is also the set's only
  // tonal change, four quiet dark rectangles and then a lit exterior.
  //
  // =====================================================================================
  // THIS CARD WAS THE ONE THAT FAILED THE LUMA GATE, AND IT FAILED IT BY ARITHMETIC
  // =====================================================================================
  //
  // Drawn at 880 with the whole 1612x934 rectangle it measured YAVG 181.7 against a stated band of
  // 194 to 223. Measured off that render: the plate's interior is 101.6 and every other pixel on
  // the frame averages 217.3, and the plate was 448,800 of 1,458,000 pixels, which is 30.8% of the
  // card. 0.308 x 101.6 + 0.692 x 217.3 = 181.7. There is no lighting problem to fix; the frame
  // was simply almost a third dark.
  //
  // 880 CAME FROM A FRAME THAT IS 570px TALLER. src/pro/ground.ts grants the gameplay plate an
  // exemption past OBJECT_MAX_W by name, and Pro-B draws exactly 880. On 1080x1920 that plate is
  // 21.6% of the frame. The same pixels on 1080x1350 are 30.8%, because the only thing that
  // changed is how much paper is left over. Copying the number rather than the intent is what
  // carried the defect across, which is the same mistake ./ground documents against POOL.
  //
  // AND THE FILM GETS TO AVERAGE, WHICH A STILL DOES NOT. Those frames of pro-b measure about 194
  // on their own; the beat is 1.7s of an 18.4s file, so the plate touches under a tenth of the
  // frames and pro-b lands at 215.3. A still has one frame and nothing to average it with. This is
  // the one place where "identical to the film" and "in band" are not the same instruction.
  //
  // CUTTING THE PICTURE WAS TRIED FIRST AND IT IS THE WRONG LEVER. It looks like the elegant fix:
  // keep the object big, throw away its darkest part. Measured at six heights, the top n rows of
  // the rectangle average 101.7 / 101.9 / 101.9 / 101.7 / 101.0 / 100.2 for n = 700 / 740 / 780 /
  // 820 / 860 / 934. The plate is uniformly dark. There is no bright band to keep, so a crop buys
  // AREA and not luminance, and the area it buys is paid for out of the bottom of the frame, which
  // is where the first person weapon is. Rendered at 806x320 on the top 640 rows it measured 198.3
  // and it read as a landscape strip: the weapon a sliver on the bottom edge, the sea and the
  // stonework doing all the work, and nothing left saying this is somebody PLAYING. The card that
  // closes the loop outside the product cannot be the one that stops looking like a game.
  //
  // SO THE AREA IS THE LEVER AND THE WHOLE PICTURE STAYS. `part(0.9)` is 671 wide and 389 tall,
  // 17.9% of the card, and it measures 197.9: four above the floor and twenty five under the
  // ceiling, which is where a number that has to survive a re-encode belongs. It is the one object
  // in the set sized by its AREA rather than by the measure, and it is the only one that has to be,
  // because it is the only one dark enough for its area to decide the frame.
  //
  // AND THE EXEMPTION IS SIMPLY NOT USED. 671 is 62% of the frame width, inside the references'
  // own measured 56-78% for a hero object, so this plate no longer needs src/pro/ground.ts to name
  // it. The redaction offset stays: `x: 48` is not negotiable, see `Crop` above.
  {
    label: "the game",
    lines: ["then go play"],
    key: "play",
    pieces: [
      {
        piece: "play",
        width: part(0.9),
        radius: 22,
        crop: { x: 48, y: 0, width: 1612, height: 934 },
      },
    ],
    pose: { kind: "arrival", amount: 0.22 },
  },
];

/** The last card has no headline and no fragment: it is the film's end card, at 4:5, at the film's
 * own numbers rather than redesigned for the aspect. It is the one element of this campaign
 * Cameron has consistently said he likes. */
export const WAITLIST_LABEL = "the waitlist";

/** Six, and the counter says so on card one. A reader who can see that the set ends knows that
 * reaching the end is a finite thing to do. */
export const CARD_COUNT = CARDS.length + 1;
