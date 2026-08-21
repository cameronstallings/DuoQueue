/**
 * THE SIX CARDS: what each one says, what it shows, and what it leaves open.
 *
 * =====================================================================================
 * THE ARC, AND WHY IT IS THE FILM'S ARC
 * =====================================================================================
 *
 * A carousel's whole economy is dwell time, and dwell time on a carousel is swipes. The
 * cheapest and most reliable engine for a swipe is a SEQUENCE, because a person who has been
 * shown step two of something wants step three; a set of unordered claims gives them nothing
 * to want. The film already is that sequence, in the order a person lives the product, so
 * the carousel does not need a second structure. It needs the same one, cut into panels.
 *
 *   01  the deck      queue up with a duo          Kofi's card, whole, at the measure
 *   02  the match     match on the game            the overlap chip over the playstyle chip
 *                     and how they play
 *   03  the duo       duo locked                   the app's own lock screen, settled
 *   04  the thread    send a message               the button, and the message it produced
 *   05  the game      then go play                 daylight, and not the app
 *   06  the waitlist                               the lockup, and duoqueue.io
 *
 * WHY SOMEBODY SWIPES, per card, which is the only question this format asks that the film
 * does not:
 *
 *   01 -> 02  The card shows a person, a game and a playstyle tag but does not say how any
 *             of that got in front of you. The next card is labelled THE MATCH.
 *   02 -> 03  It states the rule and shows the app rendering it. What the rule is FOR is
 *             still open, and the next card is labelled THE DUO.
 *   03 -> 04  A duo is locked. Nobody has spoken yet.
 *   04 -> 05  A message is sent. The thing both people actually wanted has not happened.
 *   05 -> 06  It happens, in daylight, and the only thing left to want is how to get it.
 *
 * =====================================================================================
 * THE COPY IS THE FILM'S COPY
 * =====================================================================================
 *
 * Five of the six lines are the approved v6 script verbatim, with the script's own authored
 * breaks: "queue up / with a duo", "duo locked", "send a message", "then go play". Nothing
 * is a negation, nothing implies dating, and no line breaks to an orphan word.
 *
 * ONE LINE DIFFERS AND HERE IS THE WHOLE OF WHY. The film spends two beats on the matching
 * rule, "you match on the game" and "and how they play", because it has 4.1 seconds to spend
 * and because a spoken sentence can be cut across a picture change. A carousel cannot: two
 * cards for one sentence would put a reader on a card whose headline is a dependent clause,
 * and it would spend a sixth of the set on half a claim. So the two beats are one card, and
 * the sentence is broken as "match on the game / and how they play".
 *
 * That drops the pronoun, and it is dropped for a measurement rather than for taste. The
 * whole set is set at ONE size, the largest that fits every line inside the 844px measure,
 * capped at the film's 76. "you match on the game" measures past the measure at 76 and would
 * have pulled all six cards down to about 72; without the pronoun both lines fit and the cap
 * binds, which is the property src/v6/type.ts exists to protect: no card is a different size
 * because of how it happens to be spelled. It also reads better. A carousel headline sits
 * under a label and is read in silence, which is a caption register rather than a narration
 * register, and "match on the game / and how they play" is a balanced two line rag where
 * "you match on the game / and how they play" is a long line over a short one.
 *
 * =====================================================================================
 * NOTHING ON A CARD MAY CONTRADICT THE LINE ABOVE IT
 * =====================================================================================
 *
 * This is the constraint that has bitten the campaign twice, and both times the offender was
 * a chip nobody had read. So, per card, the legible pixels, checked on frames extracted from
 * the clips themselves:
 *
 *   01  the photograph, NO. 001 in chartreuse, the avatar ring, "Kofi", "26 . Africa . EN",
 *       and "ROCKET LEAGUE . Ranked Grinder". A person you could queue with, and no sentence
 *       on the card. The crop stops 14px above the "MY PROUDEST GAMING ACHIEVEMENT IS"
 *       label, so the words "solo queue" are not on a card whose headline is "queue up with
 *       a duo".
 *   02  ">> 3 GAMES IN COMMON" in amber, and "ROCKET LEAGUE . Ranked Grinder". A count of
 *       shared titles and a playstyle tag: the two clauses of the headline, each rendered by
 *       the app in the affirmative, one above the other in the order the headline says them.
 *   03  "DUO LOCKED" in the app's own two words, in chartreuse, over the photograph.
 *   04  the app's own "Send a message" button, and the message that resulted, "Hey you on
 *       tn?", marked SENT.
 *   05  a doorway, the sea and a first person weapon. The only card that is not the app.
 *
 * =====================================================================================
 * ONE CLIP DIFFERS FROM THE FILM'S, AND IT IS BECAUSE A STILL CANNOT WAIT
 * =====================================================================================
 *
 * The film draws its lock beat from `frag-dark-locked`, which is the reticle CLOSING and
 * then the settled banner, run continuously, because the film wants the motion. Frame zero
 * of that file is the reticle part way shut: four corner brackets around a photograph, which
 * as a still is a card that looks like it failed to load. `frag-dark-duo` is the same crop
 * rectangle of the same event AFTER it settles, so the carousel uses that instead. Same
 * pixels, one second later.
 */
import type { ClipName } from "@/types";

import { MEASURE, part } from "./ground";

/**
 * THE PIECE TABLE. One row per region of the phone screen the carousel uses, with the clip
 * that carries it and the crop's own pixel size, which is what the object is drawn at so
 * nothing is ever stretched or letterboxed.
 *
 * DARK, in every row, and that is the campaign's central decision rather than a preference.
 * Chartreuse is about 1.4:1 on a near-white ground and about 13:1 on the app's off-black, so
 * a light-theme fragment on this ground deletes the one colour that makes DuoQueue
 * recognisable. The ground is light and the product is dark; the product is the object and
 * the ground is what it sits on.
 *
 * `satisfies` keeps the clip names checked against src/data/clips.ts, so renaming a clip
 * there breaks this file rather than silently rendering the missing-footage panel.
 */
export const PIECES = {
  "card-top": { clip: "frag-dark-card-top", source: [1032, 660] },
  games: { clip: "frag-dark-games", source: [490, 100] },
  role: { clip: "frag-dark-role", source: [670, 90] },
  duo: { clip: "frag-dark-duo", source: [520, 640] },
  send: { clip: "frag-dark-send", source: [1070, 206] },
  bubble: { clip: "frag-dark-bubble", source: [460, 200] },
  play: { clip: "frag-play", source: [1660, 934] },
} as const satisfies Record<string, { clip: ClipName; source: readonly [number, number] }>;

export type PieceName = keyof typeof PIECES;

/**
 * One object, placed.
 *
 * `radius` rounds the crop's own corners, which is what turns a rectangular region of a
 * screen recording into an object; it is smaller on the two chips because their crops sit
 * closer to the content inside them.
 *
 * `align` exists for exactly one piece and it is not a taste call. Everything here hangs off
 * X0, one left edge, which is the grid and which is what stops six differently shaped
 * objects from reading as six unrelated slides. The chat bubble is the one object whose own
 * screen position argues otherwise: it is an OUTGOING message, and the app draws an outgoing
 * message hard against the right margin of the thread. Drawn on the left under a full
 * measure button it would be the one thing in the set that is not where the app puts it.
 */
/**
 * A rectangle INSIDE a piece's own source pixels, drawn instead of the whole thing.
 *
 * It exists for one measured defect and it is not a general crop tool. `frag-play` is a
 * redaction: src/data/clips.ts records it as "1660x934 at 450,300 of the 2560x1440 capture"
 * and says "every number in that rectangle is a redaction", because the spectator capture it
 * came from carries a minimap, a killfeed and real gamertags outside it. The redaction is 44px
 * short. A rounded grey chip with a white stroke, part of the game's own chrome, survives at
 * source x 0 to 37, y 32 to 77, and is cut in half by the crop's left edge.
 *
 * In the film that chip is inside a 1.7 second beat under a moving object and nobody sees it.
 * A carousel card is held for as long as a reader wants to hold it, and there it is a flat
 * 20 by 23 rectangle of exactly rgb(117,117,117) hard against the object's edge: the only
 * unambiguously broken pixels in the set. So the piece declares the rectangle it actually
 * wants and the renderer scales the clip up and offsets it, which costs no new footage and
 * leaves public/footage byte for byte as the cutter left it.
 *
 * Coordinates are the clip's own, so a number here can be read straight off a frame export.
 */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Placed {
  piece: PieceName;
  width: number;
  radius: number;
  align?: "left" | "center" | "right";
  /** The sub rectangle of the clip to draw. Default is the whole clip. */
  crop?: Crop;
}

export interface CarouselCard {
  /** The spine, top left. Lower case here and drawn upper case, because the string is copy
   * and the capitals are typography. */
  label: string;
  /** The headline, in its authored break. Never a single word on a line of its own. */
  lines: string[];
  /** The one word set in the light theme's volt. Matched case insensitively, whole word. */
  key?: string;
  /** Bottom to top order is the app's order: the objects are listed the way the eye reads
   * them, and the first one in the array is the top one on the card. */
  pieces: Placed[];
}

export const CARDS: CarouselCard[] = [
  // 01. THE THUMBNAIL, and it has to survive being 470px wide in a feed. It gets the strongest
  // object the app owns: the deck card from its true top edge down to just under the playstyle
  // chip, at the full measure, so its own type renders at 62px for the name and 29px for the
  // chip. A real face, a real game, a chartreuse serial number, and four words saying what the
  // whole thing is for.
  //
  // THE FILM'S OPENING PAIR WAS TRIED HERE AND RENDERED AND REJECTED, and the reason is worth
  // writing down because on paper it is the obvious thing to do. The film puts the pass / ping
  // / boost row under this same card, for three good reasons: the card alone is a 1.56:1
  // letterbox where the pair is portrait and reads as a screen, the boost button is a solid
  // #CDFF3D disc and the only brand colour in the opening seconds, and a card plus the three
  // things you can do to it is one screen rather than two claims.
  //
  // It does not fit a 4:5 frame. The pair is 745px tall at the measure and the object band on
  // this frame is 612, because 570px of the 1350 is already spent on a spine label, a headline
  // block, a counter and four equal insets. Rendered at the largest size that does fit, the
  // card comes down to 86% of the measure, which takes the playstyle chip from 29px to 25 and
  // the name from 62 to 54, and the action row lands 13px off the counter. That is a trade of
  // the exact thing this direction exists to protect, app legibility, for one splash of colour
  // on one card of six, and chartreuse arrives on card three anyway.
  //
  // The letterbox objection is also weaker here than it is in the film. It was made about a
  // 9:16 frame, where an 844x540 object is 28% of the height and floats. On 4:5 it is 40% of
  // the height and 78% of the width, and the card's own rounded top corners, its overflow
  // button and its playstyle chip make it read as an interface rather than as a photograph.
  {
    label: "the deck",
    lines: ["queue up", "with a duo"],
    key: "duo",
    pieces: [{ piece: "card-top", width: MEASURE, radius: 24 }],
  },
  // 02. THE ONLY CARD WITH TWO OBJECTS ON IT, and it is two because the headline is two
  // clauses and each clause has its own evidence. The overlap chip sits above the playstyle
  // chip in the same order the words are read in.
  //
  // Both are drawn at the full measure, which is a 1.72x enlargement of the overlap chip and
  // a 1.26x of the playstyle chip, so their own type lands at about 51px and 45px. Sharing a
  // right edge as well as a left one is what makes two crops of different shapes read as one
  // stacked object rather than as two clippings.
  //
  // The amber is the app and not a choice: tokens.ts buckets any overlap of three or more as
  // `many` and paints it #FFB627. Nothing here recolours app footage.
  {
    label: "the match",
    lines: ["match on the game", "and how they play"],
    key: "game",
    pieces: [
      { piece: "games", width: MEASURE, radius: 18 },
      { piece: "role", width: MEASURE, radius: 18 },
    ],
  },
  // 03. THE PAYOFF, and the only portrait object in the set, which is what makes it feel like a
  // different kind of frame without changing a single rule.
  //
  // IT IS ALSO THE ONE CARD WHOSE OBJECT CANNOT REACH THE MEASURE, AND THE FIRST VERSION OF
  // THIS ROW PRETENDED OTHERWISE. Drawn at 56% and hung off X0 like everything else, it was
  // 475px wide inside an 844px measure, so 489px of frame width, 45.4%, was one empty
  // rectangle 589px tall: 19.8% of the whole card was a single blank shape with nothing in it.
  // With 208px above the headline and 154 below, the card read as unfinished rather than as
  // spacious. That is not a taste call, it is the largest void in the set by a factor of two.
  //
  // The object cannot grow its way out of it. The crop is 520 by 640, an aspect of 0.81, and
  // the band this frame has for an object is bounded above by the type at 560 and below by the
  // long cast of SHADOW reaching the counter at about 1110, which is 550px. At that height the
  // widest this piece can be drawn is about 447, and every pixel it gains vertically it must
  // give back to the type or take from the counter.
  //
  // So it stops hanging off an edge it cannot balance and CENTRES in the measure. That halves
  // the void into two 300px margins either side of the object and turns the one thing on the
  // card into the middle of the frame instead of the left of it. The single left edge is still
  // the grid: the headline, the spine, the counter and the other four cards' objects all hang
  // off X0, and this is the second stated exception to it, on the same footing as the outgoing
  // bubble's right edge on card four. An exception that appears twice in six cards and is
  // argued each time is a system; an object left where it happens to land is not.
  //
  // 54% rather than 56%, and the 2% is what puts the object's top on TOP_MIN exactly and its
  // shadow clear of the counter. Its own DUO LOCKED still draws at about 29px cap, so nothing
  // legible was traded for the balance: centring, not shrinking, is what closed the void.
  {
    label: "the duo",
    lines: ["duo locked"],
    key: "locked",
    pieces: [{ piece: "duo", width: part(0.54), radius: 26, align: "center" }],
  },
  // 04. The button and the message it produced, which the film shows as two moments and a
  // still shows as one object with two parts, because a still has no second moment to spend.
  // The button is the largest area of raw chartreuse anywhere in the campaign.
  {
    label: "the thread",
    lines: ["send a message"],
    key: "message",
    pieces: [
      { piece: "send", width: MEASURE, radius: 22 },
      { piece: "bubble", width: part(0.56), radius: 22, align: "right" },
    ],
  },
  // 05. Daylight, at the measure, and the only landscape object in the set. A duo finder is
  // supposed to end outside itself, so the last card before the ask is not the app. It is
  // also the set's only tonal change: four quiet dark rectangles and then a lit exterior.
  //
  // The crop finishes the redaction the clip's own rectangle started; see `Crop` above for the
  // 20 by 23 block of flat grey it removes and why a still cannot carry it. 48 rather than the
  // 38 the chip actually needs, so the object's rounded corner and its antialiased edge both
  // land on scenery rather than on the last column of a game UI element.
  {
    label: "the game",
    lines: ["then go play"],
    key: "play",
    pieces: [
      { piece: "play", width: MEASURE, radius: 22, crop: { x: 48, y: 0, width: 1612, height: 934 } },
    ],
  },
];

/** The last card has no headline and no fragment: it is the lockup, and it is the one
 * element of this campaign Cameron has consistently said he likes, so it is reproduced at
 * the film's own numbers rather than redesigned for the aspect. It carries the spine label
 * and the counter like every other card and nothing else new. */
export const WAITLIST_LABEL = "the waitlist";

/** Six, and the counter says so on card one. A reader who can see that the set ends knows
 * that reaching the end is a finite thing to do. */
export const CARD_COUNT = CARDS.length + 1;
