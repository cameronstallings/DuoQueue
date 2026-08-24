/**
 * THREE MORE SHEETS, ONE PER ANGLE, ON THE SHEET DESIGN THAT ALREADY EXISTS.
 *
 * =====================================================================================
 * WHAT A SECOND SHEET IS ALLOWED TO CHANGE, WHICH IS THE WORDS AND NOTHING ELSE
 * =====================================================================================
 *
 * ./plan.ts solved the feed sheet against its own frame: 1350 minus the air, the statement, the
 * gaps, the pill, the address, the stamp and the margin leaves 536px, and 536px of `games` over
 * `card` at their own aspects is 600px of width. Nothing in that arithmetic is a preference, so
 * nothing in it may move to make room for a different sentence. A sheet whose object shrank to fit
 * a longer line would take the games chip under 10.5pt on a real phone and stop doing the job the
 * chip is on the sheet for.
 *
 * So every row below carries a STATEMENT and an accent word, and that is the whole variable. The
 * object, the pose, the pool, the pill, the address, the stamp, the inks, the grain and the two
 * frame sizes are ./plan.ts's and ./ground.ts's, untouched.
 *
 * THE THREE-LINE SETTINGS ARE NOT THE THREE-LINE SETTING ./plan.ts REJECTED. That one was three
 * SHORT lines - "find a duo" / "for the games" / "you play", 13 characters at the longest - and
 * `groupSize` fits the longest line to the 745px measure, so 13 characters bought 113px of type
 * and a 360px block that ran off the top of the frame. A three-line setting whose longest line is
 * 19 characters fits at about 75px and stands 240px tall, which bottoms on FEED.base at y=116 with
 * room over it. The rule is not "never three lines", it is "the longest line decides everything",
 * and every setting below was measured on the rendered file rather than trusted.
 *
 * =====================================================================================
 * WHY THESE THREE ANGLES AND NOT THE FOURTH
 * =====================================================================================
 *
 * A still has no second beat. The eye picks its own order, everything arrives at once, and there
 * is no six seconds later in which a setup gets paid off. That is ./ground.ts's opening paragraph
 * and it is also a filter on which of the four angles can be a sheet at all.
 *
 *   PAIN survives because its promise is one imperative. The reel spends its first line on the
 *   problem and its second on the turn; a sheet cannot afford the first line, so it prints the
 *   turn and lets the picture carry the problem. "pick one of your four" is the reel's beat two
 *   with the setup deleted, and at eleven characters on its longest line it sets at about 130px,
 *   which is the largest type in this campaign and the reason this is the sheet to post first.
 *
 *   MECHANIC survives because a mechanism is a STATEMENT by nature, and this is the inversion
 *   worth noticing: the argument in src/pro/angles.ts is that mechanic is the WEAKEST of the four
 *   reels, because its hook is about a system rather than about the viewer and a cold scroll
 *   decides in 1.5 seconds on a feeling. A sheet is not scrolled past in 1.5 seconds by a viewer
 *   who has already stopped to read it, and a sheet has to state rather than tease. The property
 *   that makes it the worst film makes it the best still, and it is the only one of the three that
 *   answers "how is this different from an LFG channel" - which is that a channel has an order
 *   nobody chose and this has one that is computed.
 *
 *   HOURS survives because "awake when you are" is a complete claim in four words and needs no
 *   prior knowledge of anything, including of this app.
 *
 *   OBJECTION IS THE ONE THAT IS CUT, and it is cut for the reason it is the strongest reel. Its
 *   whole method is a resemblance named and then corrected - "it looks like a dating app UNTIL you
 *   read a card" - and the correction is a second beat. On a single frame the naming is permanent
 *   and the correction has nowhere to happen; the sheet would be a poster of the sentence this
 *   campaign has spent two scripts learning not to print. The film gets to say it because the film
 *   gets to finish the sentence. See the risk note in src/pro/angles.ts, which is about one frame
 *   of that reel; a sheet would be that frame and only that frame, forever.
 *
 * =====================================================================================
 * THE ACCENTS
 * =====================================================================================
 *
 * One word a sheet, in `lightColors.volt`, the olive the app resolves chartreuse to when it is
 * printed rather than lit. Each one is the payload rather than the last word:
 *
 *   pick      the verb that is the entire product claim on that sheet
 *   sorted    the thing an LFG channel does not do, and the only word on that sheet a reader
 *             could otherwise skim past
 *   awake     the whole angle, in one word, and the only one of the three that is not jargon in
 *             any community
 */
import { KEY_WORD, OBJECT, STATEMENT, type Piece } from "./plan";

export interface Sheet {
  /** The statement, one line per row, longest row deciding the size for the whole block. */
  statement: readonly string[];
  /** The one word in it that takes the accent ink. */
  key: string;
  /** The object, which is ./plan.ts's for every sheet in this campaign. See the header. */
  object: readonly Piece[];
}

export type SheetName = "core" | "pain" | "mechanic" | "hours";

export const SHEETS: Record<SheetName, Sheet> = {
  /**
   * THE SHIPPED SHEET, restated so the four PNGs already in out/_static/ are a row in this table
   * rather than the absence of one. `render-static.ts` names no sheet and gets this by default, so
   * feed-light.png and its three siblings re-render byte for byte.
   */
  core: { statement: STATEMENT, key: KEY_WORD, object: OBJECT },

  /**
   * PAIN. Two lines, eleven characters at the longest, which is the largest type this measure will
   * give anything: about 130px against the core sheet's 81, under TYPE.max's 138 ceiling.
   *
   * "your four" is the four strangers a solo queue hands you, and it is addressed to somebody who
   * has lost a game to one of them this week. The claim is not that the app picks your team - it
   * cannot, and the reel is careful to say so - it is that one of the five is now yours to choose.
   *
   * WHAT THE PICTURE HAS TO DO HERE, and it is more than on the other two. An imperative to pick,
   * over a photograph of a person, is a shape a reader could file wrongly, and the thing that stops
   * them is the chip directly under the words: ">> 3 GAMES IN COMMON", the app's own type, saying
   * that the reason this person is on the frame is a library overlap. That chip is why the object
   * leads with it and why it is never dropped for a wider card. The stamp says PLATONIC under it.
   */
  pain: { statement: ["pick one of", "your four"], key: "pick", object: OBJECT },

  /**
   * MECHANIC. Three lines, nineteen characters at the longest, about 75px.
   *
   * Every word is literally true of `get_deck`: the query scores shared games, the play-window
   * overlap in hours, skill, shows, languages and region, and then orders by that score. "your
   * deck is sorted" is the ORDER BY and "by shared games and shared hours" is two of its terms.
   *
   * "deck" is the only piece of jargon on any of the three sheets and it is the one word the
   * picture explains: the object under it is a card, so a reader who has never used the app still
   * knows what a deck of them is. That is the trade - a word a stranger has to infer, in exchange
   * for the only sentence in the campaign that says the ordering carries information.
   *
   * SHARED HOURS HAS NO PICTURE, on this sheet or in any of the four films, because the play
   * window is drawn on the app's profile detail sheet and none of the four source recordings ever
   * opened one. It is a real column, a real function and a real term in the score; it is the one
   * claim in this batch with nothing behind it, and thirty seconds of new recording fixes it.
   */
  mechanic: {
    statement: ["your deck is sorted", "by shared games", "and shared hours"],
    key: "sorted",
    object: OBJECT,
  },

  /**
   * HOURS. Two lines, eighteen characters at the longest, about 79px, which is within two pixels
   * of the core sheet's 81 and is why these two read as a pair on a profile grid.
   *
   * IT OPENS ON THE SAME THREE WORDS AS THE CORE SHEET ON PURPOSE. "find a duo for the games you
   * play" and "find a duo who is awake when you are" are the same sentence with a different second
   * half, so two posts a week apart are recognisably one account making one argument twice rather
   * than two ads. That is the cheapest brand consistency available to a cold account and it costs
   * nothing but the discipline of not rewriting the opener.
   *
   * It is also the only claim in the batch that needs no prior knowledge of anything: no deck, no
   * queue, no four, no rank. A person who has never played a game understands "awake when you are",
   * and the people it self-selects for are the ones who have closed an app at half past midnight.
   */
  hours: {
    statement: ["find a duo who is", "awake when you are"],
    key: "awake",
    object: OBJECT,
  },
};

/** Every angle sheet, in the order they should be posted, which is the reels' order minus the one
 * that is not a sheet. */
export const ANGLE_SHEETS = ["pain", "hours", "mechanic"] as const satisfies readonly SheetName[];

export const sheetFor = (name: SheetName): Sheet => SHEETS[name];
