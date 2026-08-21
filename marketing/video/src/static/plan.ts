/**
 * WHAT THE SHEET SAYS AND WHAT IT SHOWS. One copy deck, both sizes, both themes.
 *
 * =====================================================================================
 * THE STATEMENT, AND WHY IT IS NOT THE FILM'S LINE
 * =====================================================================================
 *
 * "your best games were the ones you played with someone else" is the best sentence in this
 * campaign and it is the wrong sentence for a still. It is a SETUP: it earns its payoff six
 * seconds later when the app arrives, and on a frame with no second beat it is a nice thought
 * from a brand the reader cannot identify. A reader who has never heard of DuoQueue has to finish
 * this sheet knowing what the product does, so the statement STATES.
 *
 *   find a duo for the games you play
 *
 * Four things a stranger gets out of it with no prior knowledge: there is a thing here that finds
 * people (find), it pairs you with exactly one of them (a duo), the pairing is about games, and
 * the games are the ones already on your disk (you play). That is DuoQueue, in seven words.
 *
 * IT IS SET AS TWO LINES AND THE BREAK IS THE SIZE. `groupSize` fits the LONGEST line to the
 * 745px measure and every other line inherits that size, so the break decides the type size and
 * the type size decides the whole composition. All three settings were rendered on the feed sheet
 * and measured off the frame rather than estimated, because the estimate was wrong by 20%:
 *
 *   1 line   "find a duo for the games you play"           49px set,  47px of ink,   47px block
 *   2 lines  "find a duo for" / "the games you play"       81px set,  61px of ink,  172px block
 *   3 lines  "find a duo" / "for the games" / "you play"  113px set,  81px of ink,  360px block
 *
 * The three line set is the biggest type and it loses on arithmetic: 360px of block bottomed on
 * FEED.base puts its first ascender at y = -4, off the top of a 1350 frame, and pushing the base
 * down far enough to fit it takes the object under 400 wide, at which point the games chip falls
 * under 7pt on a real phone and the second job on this sheet stops being done. The one line set
 * fits anywhere and is weightless: 47px of ink on a 1350 frame is a caption.
 *
 * 81px over two lines is the setting where the statement is still 2.5x the app's own largest word
 * (61px of ink against Kofi's 24px, measured on the rendered file) and the object is still large
 * enough to read as the product.
 *
 * THE BREAK LANDS ON A PREPOSITION and that is deliberate rather than tolerated: "find a duo for"
 * is a hook that has to resolve, so the eye is pulled to the second line instead of being allowed
 * to stop at the end of the first. The campaign already does this in the carousel, where card two
 * breaks "you match on / the games you play".
 *
 * `duo` CARRIES THE ACCENT, and on this ground the accent is `lightColors.volt`, the olive ink
 * the app itself resolves chartreuse to when it is printed rather than lit. Raw #CDFF3D measures
 * 1.05:1 on #F6F3EA. It is never type on paper, at any size, on any sheet.
 *
 * =====================================================================================
 * THE STAMP
 * =====================================================================================
 *
 * DuoQueue was rejected once under App Store guideline 2.3.6, so "this is not a dating app" is a
 * thing every piece of this campaign has to establish and none of them may establish by SAYING
 * "this is not a dating app": naming the category is what files you under it, and the campaign
 * spent an entire script learning that. So the sheet does it three ways at once and never
 * negates. The statement is about games rather than people. The object leads with a chip that
 * says the two of you own three of the same games. And the stamp declares the two facts a store
 * listing declares, in the same mono voice the carousel sets its running heads in.
 *
 * "PLATONIC" is the App Store's own word for what this is, and it is stated positively.
 */
import type { FragName } from "@/pro/media";

/** The statement, one line per row, longest row deciding the size. */
export const STATEMENT = ["find a duo for", "the games you play"] as const;

/** The one word in the statement that takes the accent ink. */
export const KEY_WORD = "duo";

/**
 * The stamp. Category first, because it is the word a stranger is missing; then the two
 * boundaries, in the order a listing states them.
 */
export const STAMP = "A GAMING APP  ·  18+  ·  PLATONIC";

export interface Piece {
  piece: FragName;
  /** How the corner is rounded, as a fraction of the drawn width, so the two sizes round the
   * same shape rather than sharing a pixel count. Both are the carousel's own radii divided by
   * its 745px measure: 24/745 for a card and 18/745 for a chip. */
  round: number;
}

/**
 * THE OBJECT: two crops of the app, drawn at one width, sharing one pose, reading as one thing.
 *
 * =====================================================================================
 * WHY THESE TWO AND NOT THE OTHER EIGHT
 * =====================================================================================
 *
 * The fragment table holds ten. The still has room for one object, so the question is which
 * single object best answers "show the product" on a frame that also has to survive being seen
 * for a second and a half by somebody who has never heard of this app.
 *
 *   `card` IS THE PRODUCT. It is a real person's real profile with a real photograph, the app's
 *   own rounded corners, its own overflow control, its chartreuse serial number and its playstyle
 *   chip. Nothing else in the set says "this is an app with people in it" without a caption. It
 *   is also the crop that stops ABOVE the prompt sentence, which matters here more than anywhere:
 *   every wider crop of this card carries the words "SOLO QUEUE" in Kofi's answer, and a sheet
 *   whose statement is "find a duo" cannot have "solo queue" legible inside its own picture. See
 *   the note on `frag-dark-card-top` in src/data/clips.ts.
 *
 *   `games` IS THE PROOF, and it is the piece that does the 2.3.6 job. ">> 3 GAMES IN COMMON" is
 *   the app's own UI saying, in its own type, that the reason this person is on your screen is a
 *   library overlap. A profile card with a face, a name, an age and a region, alone on a sheet,
 *   is a shape the eye has seen a thousand times and files instantly under the wrong category.
 *   The same card with that chip over it is a matchmaker. It costs 120px of height and it is the
 *   single highest-value 120px on the sheet.
 *
 * THE CHIP IS ON TOP, so the reason arrives before the person does. The eye still goes to the
 * photograph first because a photograph always wins, but every reader who tracks the column from
 * the statement downward hits "3 GAMES IN COMMON" on the way in.
 *
 * THEY ARE THE SAME WIDTH, which is the carousel's rule and the reason two crops of very
 * different shapes read as one object turning in one camera rather than as two clippings that
 * happen to be near each other. Sharing a left edge is not enough; a right edge as well is.
 *
 * WHAT IS NOT USED, AND WHY. `send` would have been the cheap way to widen the gap between the
 * dark and light files, because the Send a message button is the largest area of raw #CDFF3D in
 * the campaign on dark and a forest green on light. It is not here: a "Send a message" button
 * directly under a photograph of a person is the exact composition the platonic read cannot
 * afford, and buying a tenth of a percent of brand colour with it would be the worst trade in
 * this campaign.
 */
export const OBJECT: readonly Piece[] = [
  { piece: "games", round: 18 / 745 },
  { piece: "card", round: 24 / 745 },
];

/**
 * The pose, as a fraction of the film's own mid-beat gesture.
 *
 * IT IS THE GESTURE AND NOT THE ARRIVAL, and the difference is not taste. `ARRIVAL` carries a
 * rotZ of -3 degrees, and rotZ rotates each plane about its OWN centre: on a stack of two planes
 * it opens the gap between them into a wedge, 5px narrower at one end than at the other on a
 * 587px object, which is precisely the "two clippings" read the shared width exists to prevent.
 * `GESTURE` is rotX and rotY only, so both planes turn in the same camera and the gap between
 * them stays parallel. It is what src/carousel/plan.ts spends on both of its two-piece cards.
 *
 * 0.34 of it is 6.8 degrees of rotateY and 4.8 of rotateX, which is between the carousel's own
 * 0.35 and 0.45. A still cannot spend a gesture; it can only be caught in the middle of one.
 */
export const POSE_AMOUNT = 0.34;
