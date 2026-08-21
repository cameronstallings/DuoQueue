/**
 * WHICH LINE IS THE HERO, BEAT BY BEAT, AND WHY THAT ONE.
 *
 * =====================================================================================
 * THE RULE, STATED ONCE
 * =====================================================================================
 *
 * Every beat is set as ONE support line in the label register and ONE hero line in the display
 * register, in that order, because the copy reads in that order and nothing is re-ordered.
 *
 *   THE HERO IS THE BEAT'S KEY WORD, which src/v6/script.ts already names as `key`, on five of
 *   the six beats. Not "a word chosen for this direction": the same word the fragment ad marks
 *   in volt and the carousel bolds, so the three ads agree about which word each beat turns on
 *   and only disagree about how loudly to say it.
 *
 *   THE SUPPORT IS EVERYTHING ELSE, contiguous, in the order it is spoken.
 *
 * Beat three is the exception and it is the only one. Its key word is "how", which is a
 * connective: isolating it would leave "and" alone on a line above it, and a one word line in a
 * three line stack is precisely the orphan Cameron caught in the fifth cut, where "SAME GAME /
 * SAME / HOURS" left a stray SAME reading as a rendering mistake. So beat three's hero is the
 * phrase the key word modifies, "they play", and "how" stays in the support where it takes the
 * volt ink anyway.
 *
 * =====================================================================================
 * THE COPY IS THE SCRIPT'S. THE BREAK IS THIS FILE'S.
 * =====================================================================================
 *
 * Every `support` joined to its `hero` by one space is exactly the beat's `phrase` in
 * src/v6/script.ts, and `pnpm validate` asserts it, so the words a viewer reads and the words a
 * viewer hears cannot drift. Not one word is added, removed, re-ordered or replaced.
 *
 * What IS different from the script's own `lines` is where the break falls, and it has to be.
 * The script breaks each phrase into two BALANCED lines because the fragment ad sets both at
 * one size and balance is the only thing a break can be for there. This direction sets the two
 * lines three times apart, so the break has a job: it decides which words are the frame and
 * which word is the subject. "queue up / with a duo" balanced is two halves of a sentence;
 * "QUEUE UP WITH A / duo" is a label and a subject.
 *
 * =====================================================================================
 * WHY THE HEROES ARE ONE WORD, AND WHAT IT BUYS
 * =====================================================================================
 *
 * Arithmetic. A line fitted to a measure comes out at a size inversely proportional to its
 * length, so at this film's 844px measure the hero sizes would run, uncapped and unbounded:
 * "duo" about 505, "play" about 459, "game" about 343, "locked" about 293, "message" about 217,
 * "they play" about 210. That two and a half times spread, decided entirely by spelling, IS the
 * rejected cut's defect, and no cap alone removes it; a cap only clips the top of it.
 *
 * Keeping every hero to one or two words is what compresses the spread far enough that ONE
 * SIZE for the whole film is affordable. ./type.ts then takes the smallest fit, and every beat
 * is set at it. Beat four is exactly as large as beat one. Nothing on any frame of this film is
 * a different size because of how it is spelled.
 *
 * The cost is stated where it is paid: beat three's hero is two words rather than one, so it is
 * the line that decides the film's size for everybody else. That is the correct place for the
 * constraint to bind, because it means the size is set by the LONGEST thing that has to fit
 * rather than by the shortest thing that could grow.
 *
 * =====================================================================================
 * THE ONE SUPPORT LINE THAT IS A SINGLE WORD, AND WHY IT IS NOT THE ORPHAN
 * =====================================================================================
 *
 * Beat four sets "DUO" as its support over "locked" as its hero, and that is a one word line.
 * It is worth being precise about the rule it looks like it breaks.
 *
 * The orphan Cameron rejected was "SAME GAME / SAME / HOURS": three lines in the SAME register,
 * at the same size, in the same weight, one of which happened to hold one word. Nothing on that
 * frame told a reader the short line was intended, so it read as a layout that had broken. The
 * rule that actually catches it is not "no line may hold one word", which would forbid the
 * single word hero this direction is built on. It is that NO LINE MAY BE ALONE IN ITS REGISTER
 * AND SHORT, and `pnpm validate` checks it in that form: a line may be one word only where the
 * line next to it is set in the other register.
 *
 * On beat four the two lines are three times apart in size, three weight steps apart, tracked
 * in opposite directions, in opposite case and in different ink. Nobody reads that as broken.
 *
 * It is also the film's best frame. "duo" was the hero of beat one and the word the whole
 * script plants in its first second; on the payoff it drops to the label register and LOCKED
 * takes the display register, so the promise becomes the given and the news gets the size.
 * Underneath it the app's own banner says DUO LOCKED in its own two words, which is the film
 * and the product saying the same thing at the same moment.
 *
 * =====================================================================================
 * WHAT IS UNDER EACH LINE
 * =====================================================================================
 *
 * The shot plan is src/frag/plan.ts, imported and used unchanged, including the sizes, the
 * pairing on beat one, the two shot split on beat five and the one reserved arrival gesture on
 * beat four. That is not laziness, it is the repo's rule about comparable renders: the first
 * cut of the v6 experiment gave each direction its own plan and the comparison stopped being a
 * comparison, because two of the three then disagreed about which claim had evidence under it.
 * A difference between this file's render and frag-dark.mp4 is a difference of TYPE and of
 * nothing else, which is exactly the question being asked.
 *
 * It also carries that file's checking with it. Every crop in it was chosen against a constraint
 * this film inherits verbatim: nothing on screen may contradict what the voice says. The prompt
 * fragment is cut without its "MY PROUDEST GAMING ACHIEVEMENT IS" label; the card stops above
 * the sentence whose most legible words are "solo queue" in a film that opens "queue up with a
 * duo"; the closing gameplay crop is a redaction on all four edges because the source is a
 * spectator capture carrying other people's gamertags.
 */
import { PLAN, type FragBeat, type FragName } from "@/frag/plan";

import { V6, type V6Script } from "../v6/script";

/**
 * A rectangle inside a fragment's own source pixels, drawn instead of the whole thing.
 *
 * There is exactly one entry and it is a defect fix, not a re-cut. src/data/clips.ts records
 * `frag-play` as "1660x934 at 450,300 of the 2560x1440 capture" and states that "every number
 * in that rectangle is a redaction", because the spectator capture it was taken from carries a
 * minimap, a killfeed and real gamertags outside it. The redaction is 44px short: a rounded
 * grey chip with a white stroke, part of the game's own chrome, survives at source x 0 to 37,
 * y 32 to 77, and the crop's left edge cuts it in half. On the frame it lands as a flat block
 * of near enough exactly rgb(117,117,117), 20 by 23px, hard against the object's left edge.
 *
 * It is quiet here, under a moving object inside a 1.73 second beat. It is not quiet on a
 * carousel card, which is held for as long as a reader wants to hold it, and the same rectangle
 * is redacted the same way there; see `Crop` in src/carousel/plan.ts. This entry keeps the two
 * ads agreeing about what the last shot of the campaign contains.
 *
 * It costs no new footage: the clip is scaled up and offset behind its own clipping box, so
 * public/footage is byte for byte as the cutter left it. 48 rather than the 38 the chip needs,
 * so the object's rounded corner and its antialiased edge both land on scenery.
 *
 * The delivered frag-dark.mp4 and frag-light.mp4 still carry the chip. They are frozen, and a
 * fix that requires re-rendering them is not this task's to make.
 */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CROPS: Partial<Record<FragName, Crop>> = {
  play: { x: 48, y: 0, width: 1612, height: 934 },
};

/** One beat, typeset. `support` and `hero` joined by a space are the spoken phrase. */
export interface TypeBeat {
  /** The label register, upper cased at the point of measurement rather than here, because the
   * strings are copy and the capitals are typography. */
  support: string;
  /** The display register. One line, always last, always the same size. */
  hero: string;
}

export const BEATS: TypeBeat[] = [
  // "queue up with a duo". The hero is the product's own noun and the word the script plants in
  // the first second so that beat four can pay it back with the app's own DUO LOCKED. The
  // support ends on an article, which is a wart at editorial scale and is not one at label
  // scale: "QUEUE UP WITH A" tracked at +0.08em reads as one unit and hands off to the word it
  // is waiting for. The alternative break, "QUEUE UP / with a duo", puts two function words at
  // the head of the largest line in the film and drops the size by a third.
  { support: "queue up with a", hero: "duo" },
  // "you match on the game". Same shape, same reason, and the beat states the differentiator.
  // Under it: >> 3 GAMES IN COMMON, alone on the ground, which is the same claim rendered by
  // the app rather than asserted over it.
  { support: "you match on the", hero: "game" },
  // "and how they play". The exception, and the film's longest hero, so it is the line that
  // decides the size every other beat is set at. See the header for why "how" cannot carry the
  // frame on its own. The key word stays in the support and therefore takes the volt ink, so
  // the beat's distinguishing word is still the one marked, just in the quieter register.
  { support: "and how", hero: "they play" },
  // "duo locked". The payoff. The one single word support line in the film; see the header.
  { support: "duo", hero: "locked" },
  // "send a message". Under it the app's own Send a message button, then the message that
  // resulted, marked SENT.
  { support: "send a", hero: "message" },
  // "then go play". The point of all of it, over daylight. The only fragment in the film that
  // is not the app, and the last picture before the wordmark.
  { support: "then go", hero: "play" },
];

/** Every hero line in reading order, which is what ./type.ts fits the film's one size to. */
export const heroLines = (): string[] => BEATS.map((beat) => beat.hero);

/** Every support line, upper cased, because that is the string that gets measured AND rendered.
 * Measuring the lower case string and rendering capitals is the same class of bug as measuring
 * in the wrong font, and kinetic-native's type-fit.ts shipped it once. */
export const supportLines = (): string[] => BEATS.map((beat) => beat.support.toUpperCase());

/**
 * The shot under a given beat, from src/frag/plan.ts. Exported through this file rather than
 * imported directly by the film so that there is exactly one place to look for "what is on the
 * frame while this line is spoken", and so a reader of this file cannot miss that the answer
 * is somebody else's and deliberately so.
 */
export const shotFor = (index: number): FragBeat =>
  PLAN[index] ?? { shots: [], enter: "curve", exit: "curve" };

/** The script this direction is set from. One export so the register and the validator cannot
 * disagree about which script the break table is checked against. */
export const SCRIPT: V6Script = V6;
