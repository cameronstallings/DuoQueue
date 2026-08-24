/**
 * WHICH APP FRAGMENTS EACH SCRIPT NEEDS, and nothing else.
 *
 * =====================================================================================
 * WHY THIS FILE EXISTS AND WHAT IT IS FORBIDDEN FROM DOING
 * =====================================================================================
 *
 * `out/_directions/pro-a-light.mp4` is the approved direction and the batch of four new angles is
 * the same film with different words. So the ground, the camera, the type law, the recede, the
 * arrival, the gesture, the flight off the glass, the end card and the audio chain are all
 * src/pro/a/DirectionA.tsx's, unchanged and unforked.
 *
 * What genuinely cannot be shared is WHICH FRAGMENT IS ON THE FRAME WHEN, because that is the one
 * thing the words decide. The rule this campaign has broken twice is that nothing on the frame may
 * contradict the voice, and a fixed shot plan run against four different scripts breaks it on the
 * second one: `mechanic` opens on "every card you see was scored before it was dealt" and the
 * approved plan would put a firefight on that frame.
 *
 * So this file is DATA, and it is deliberately the smallest data that answers the question:
 *
 *   - which beat the device arrives on, and whether the film opens on the gameplay plate instead
 *   - which beat carries the two-chip lift pair, and which two chips
 *   - which two chips lift in the last beat's first two clauses
 *
 * It carries no frames, no easing, no size and no position. Every number of that kind is still in
 * DirectionA and in ../film.ts, which is what makes these four films the same film.
 *
 * THE `pro-001` ROW IS A FIXED POINT. It restates what DirectionA did before the plan existed,
 * value for value, so the approved file re-renders identically and the lookup's default is the
 * approved film rather than a fallback nobody checked. `pnpm validate` asserts the row against the
 * beat count of the script it belongs to; a frame-level diff against the shipped mp4 is what
 * proved it the first time.
 *
 * =====================================================================================
 * THE FOUR PLANS, AND THE SENTENCE EACH SHOT IS UNDER
 * =====================================================================================
 *
 * PAIN is the approved plan unchanged, and that is not laziness, it is what the words happen to
 * want. "solo queue hands you four strangers and a coin flip" is the film's one line about playing
 * rather than about the app, so it takes the gameplay plate; "duoqueue is where you pick one of the
 * four" is the product arriving, so the device arrives on it; "every card shows the games you share
 * and how they play" names the two chips in order, so the two chips lift in order.
 *
 * MECHANIC AND OBJECTION BOTH OPEN ON THE DEVICE, because both of their hooks are about a CARD.
 *   "every card you see was scored before it was dealt"
 *   "it looks like a dating app until you read a card"
 * A gameplay plate under either of those is a picture arguing with its own sentence. The device
 * arrives on frame zero instead, which is a shape the approved film already cuts to at f133; it is
 * the same eight-frame arrival with the same colour flood, spent at the top of the film where a
 * cold scroll needs motion in the first frame anyway. `arrive`'s own `lead` is what stops that
 * from being a fade up out of an empty frame, and it is the parameter's stated purpose.
 *
 * Their evidence pair therefore moves from beat three to beat two, which is where the sentence
 * naming the chips moved to. Both of those beats are long enough to carry it: the pair needs about
 * 104 frames and `mechanic` beat two is 115, `objection` beat two is 143.
 *
 * HOURS HAS NO EVIDENCE PAIR AT ALL, and that is the honest answer rather than a gap. Its middle
 * beat is "the top of your deck is awake when you are", whose subject is the card the device is
 * already showing; lifting a chip off it would be an event with no sentence under it. The device
 * holds the deck and the statement takes the frame, which is exactly the shape of beat two in the
 * approved film.
 *
 * Its last beat is the one place in the batch where a NEW fragment is needed. "lock the duo, ask if
 * they are on, and go play" replaces "send a message" with the message itself: `bubble` is the app's
 * own sent thread reading "Hey you on tn?", so the second clause and the pixels under it are the
 * same sentence said twice. Its crop rectangle was already in public/footage/README.md and is added
 * to GLASS in DirectionA beside the other four.
 *
 * =====================================================================================
 * WHAT IS NOT IN HERE, AND WHY IT IS NOT A GAP
 * =====================================================================================
 *
 * THERE IS NO `hours` CHIP ANYWHERE IN THE FOOTAGE. The play window is a real column, a real
 * function and a real term in `get_deck`'s score, and the app draws it through `MetaLine` on the
 * PROFILE DETAIL SHEET, which none of the four source recordings ever opened. So `mechanic` beat
 * two and `hours` beat two say "hours" over clean paper. That contradicts nothing - the object has
 * receded to opacity 0 by the time a statement is up, which is the reference's own type beat - but
 * it is the one claim in the batch with no picture behind it, and thirty seconds of new recording
 * would fix it for the two strongest mechanism reels at once.
 *
 * `pain` OPENS ON QUIET RATHER THAN ON A LOSS. `frag-play` is 1.9s of daylight on Breeze and every
 * edge of that rectangle is a redaction, because the source is a spectator capture whose full frame
 * prints real gamertags in the killfeed. `broll-loss` is cut and present but FULL FRAME, so it is
 * not publishable as it stands. A film whose first line is about a coin flip would rather open on a
 * defeat screen; a redacted crop of `broll-loss` on `frag-play`'s terms is one ffmpeg line and is
 * the second-highest-value thing this campaign could shoot next.
 */
import type { FragName } from "./media";

/** The chips that have a crop rectangle on the glass. See GLASS in ./a/DirectionA.tsx. */
export type LiftName = Extract<FragName, "games" | "role" | "locked" | "send" | "bubble">;

export interface ShotPlan {
  /**
   * Whether the film opens on the gameplay plate. When it does, `deviceFrom` is the beat the plate
   * hands over on; when it does not, the device is the film's first object and arrives on frame
   * zero already part way through its own arrival.
   */
  openPlate: boolean;
  /** The beat index the device arrives on. */
  deviceFrom: number;
  /**
   * The beat index carrying the two-chip lift pair, or -1 for a film that has no sentence naming
   * two chips. `../film.ts` reads this too: the beat that has two things to show is the beat that
   * gets `SOLO.evidence` rather than `SOLO.normal`, and giving the long solo to a beat with nothing
   * lifting off it would be a hold with no event in it.
   */
  evidence: number;
  /** The pair, in the order the sentence names them. Null exactly when `evidence` is -1. */
  pair: readonly [LiftName, LiftName] | null;
  /** The two chips lifted in the last beat's first two clauses, before the plate returns. */
  close: readonly [LiftName, LiftName];
  /**
   * The beat the cover still is taken from. ../cover.ts turns it into a frame: the midpoint of
   * the window where that beat's whole statement is up and nothing is moving.
   *
   * It is a beat rather than a frame because the choice is editorial and the frame is arithmetic.
   * Beat zero is the default and the right answer for three of the four, because the cover is the
   * still a stranger decides on and the hook is what the film spent its first sentence on.
   *
   * `objection` is the exception and it is the whole reason this field is per script. Its hook is
   * "it looks like a dating app until you read a card", and a cover is not a beat in a film, it is
   * a permanent picture on a profile grid with no second half arriving to correct it. So the cover
   * comes off beat two, "it exists so you have someone to queue with", which is the sentence the
   * caption already opens on and the one that says what the app IS.
   */
  cover: number;
}

const APPROVED: ShotPlan = {
  openPlate: true,
  deviceFrom: 1,
  evidence: 2,
  pair: ["games", "role"],
  close: ["locked", "send"],
  cover: 0,
};

export const SHOTS: Record<string, ShotPlan> = {
  // The fixed point. Do not edit this row to serve a new film; add a row.
  "pro-001": APPROVED,

  // 1 the game / 2 the device arrives / 3 the two chips / 4 locked, send, the game again.
  "pro-pain": APPROVED,

  // 1 the device arrives on "every card you see" / 2 the two chips on "shared games ... how you
  // both play" / 3 the card itself on "the card on top" / 4 locked, send, the game.
  "pro-mechanic": {
    openPlate: false,
    deviceFrom: 0,
    evidence: 1,
    pair: ["games", "role"],
    close: ["locked", "send"],
    cover: 0,
  },

  // 1 the device arrives on "until you read a card" / 2 the two chips on "three games in common
  // and how they play" / 3 the card, a person, on "someone to queue with" / 4 locked, send, the
  // game.
  "pro-objection": {
    openPlate: false,
    deviceFrom: 0,
    evidence: 1,
    pair: ["games", "role"],
    close: ["locked", "send"],
    // Not beat zero. See `cover` on ShotPlan.
    cover: 2,
  },

  // 1 the game, at midnight / 2 the device arrives on "counts the hours you overlap" / 3 the deck
  // itself on "the top of your deck" / 4 locked, the sent message, the game.
  "pro-hours": {
    openPlate: true,
    deviceFrom: 1,
    evidence: -1,
    pair: null,
    close: ["locked", "bubble"],
    cover: 0,
  },
};

/** The plan for a script. An unregistered id gets the approved film's plan, which is the only
 * default that cannot surprise anybody. */
export const shotsFor = (id: string): ShotPlan => SHOTS[id] ?? APPROVED;

/** The beat that owns `SOLO.evidence`, which is the beat with two things to show. -1 when the
 * film has none, and then every beat holds for `SOLO.normal`. */
export const evidenceBeat = (id: string): number => shotsFor(id).evidence;

/** The beat the cover still comes off. ../cover.ts derives the frame inside it. */
export const coverBeat = (id: string): number => shotsFor(id).cover;
