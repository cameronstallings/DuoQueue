/**
 * WHICH SECOND OF WHICH CLIP SITS UNDER EACH BEAT. One plan, all three directions.
 *
 * The first cut of this film gave each direction its own plan, and both verification passes
 * punished it: the same claim had evidence under it in two directions and none in the third, so
 * "the only variable is the look" was not true and the comparison Cameron is being asked to
 * make was not the comparison he was given. The plan is a property of the SCRIPT, because it is
 * the answer to "what is on screen while this is said". It lives here.
 *
 * Every in point below was read off extracted frames of the source files, not guessed, and the
 * timings that matter are these, measured at 8 frames a second on the trimmed clips.
 *
 *   deck-dark.mp4    Devon settled to 1.05, a PASS swipe to 1.40, WREN settled 1.40 to 2.85, a
 *                    DUO stamp and swipe 2.85 to 3.50, KOFI settled 3.55 to 5.05, a second DUO
 *                    stamp and swipe 5.05 to 5.65, then Chase.
 *
 *                    Wren and Kofi are the only two cards in 128 seconds of recording carrying
 *                    >> 1 GAME IN COMMON, because the review account's own profile lists
 *                    Stardew Valley and Rocket League. Devon and Chase carry >> NO GAMES IN
 *                    COMMON: Devon's pill stays legible to 1.22 as his card rotates out under a
 *                    PASS stamp, and Chase's becomes legible at about 5.25 as his card is
 *                    revealed behind Kofi's. That leaves 4.03s of deck with nothing negative on
 *                    it, the two deck beats cost 4.13s, and they run 1.09 to 5.22. The tenth of
 *                    a second over budget is spent at the head rather than the tail, where the
 *                    card is in motion under an explicit PASS and no word has been spoken yet.
 *   match-kofi.mp4   the avatar lands at 0.35, DUO LOCKED and "You and Kofi both queued up."
 *                    hold to 5.0, and the "New match! You matched with Kofi." banner runs 1.5
 *                    to 4.5.
 *   chat-typing.mp4  the composer holds a finished "When are you gonna be on tn?" to 5.58, the
 *                    send lands at 5.58, and the bubble under it reads SENDING until 6.60 and
 *                    SENT after it.
 *   broll-teamfight  clean first person 0.40 to 4.15: a corridor, a doorway, an enemy stepping
 *                    into it at 3.25 and the shots that follow. SPIKE CARRIER KILLED lands at
 *                    4.22 in large red type and the camera swings onto a body, so nothing in
 *                    this film goes past 4.15.
 *   broll-quiet      bright daylight Breeze. Teammate nameplates carrying real gamertags are on
 *                    screen 1.05 to 1.60 and from 3.95 onwards, so the only publishable window
 *                    is 2.00 to 3.90 and the closing beat lives inside it.
 *
 * BOTH GAMEPLAY CLIPS ARE SPECTATOR CAPTURES and their full frames carry a minimap, a combat
 * report and two teammates' real gamertags. Every gameplay frame in every direction is a centre
 * crop, which is what keeps other people's names out of published marketing, and the two in
 * points above are the windows where the centre is also clean.
 *
 * THE TWO GAMEPLAY BEATS ARE DIFFERENT CLIPS ON PURPOSE. The film opens in a dark corridor
 * walking towards a fight and closes in daylight walking out of one, which is the only tonal
 * arc six beats has room for, and it means the last picture before a black end card is the
 * brightest frame in the film.
 */
import type { Shot } from "./script";

export const SHOTS: Shot[] = [
  // "queue up with a duo". The approach, the enemy stepping into the doorway at 3.25 and the
  // shots that follow, ending at 3.93, which is 0.29s before the kill banner.
  { clip: "broll-teamfight", from: 1.6 },
  // "you match on the game". Opens on Devon's card mid PASS, which is a hard cut landing on a
  // moving picture and is also the mechanic being demonstrated rather than claimed: the card
  // with no overlap is the one being thrown away. Then Wren settles for 1.45s, STARDEW VALLEY,
  // Casual, >> 1 GAME IN COMMON, and the beat ends on the DUO stamp.
  { clip: "deck-dark", from: 1.09 },
  // "and how they play". Continuous with the beat before it to the frame, so the picture runs
  // straight through the seam and only the type cuts: 1.09 + 68/30 = 3.357. Kofi settled for
  // 1.5s, ROCKET LEAGUE, Ranked Grinder, "Hit Grand Champion in Rocket League solo queue. Took
  // two years. Worth it.", and the beat ends on the two frames where the second DUO stamp is
  // igniting. Measured: the stamp is faint at frame 193 and the beat is over at 194. The film
  // shows one clear DUO stamp, on Wren at the end of the beat before this one, and this one
  // begins a second as it cuts away. Buying more of it costs Chase's card, and that trade was
  // made the other way.
  //
  // The out point is the number that matters and it is why this beat's line lost a word. At 68
  // frames the beat ended at 5.72 and left Chase's >> NO GAMES IN COMMON legible for a third of
  // a second as the film's last deck impression. At 56 it ends at 5.22 and that card never
  // arrives.
  { clip: "deck-dark", from: 3.357 },
  // "duo locked". The app's own two words, Kofi's photograph, and the new match banner arriving
  // at 1.5 with 0.68s of the beat still to run.
  { clip: "match-kofi", from: 0.55 },
  // "send a message". Half a second of the composed message and the empty state that reads "You
  // matched. Break the ice with a message about a game you both play.", the send at 5.58, and
  // the bubble holding SENDING and then SENT for the last seven frames. The first render of this
  // plan started at 4.7 and ended at 6.43, which is 0.17s before the app writes SENT.
  { clip: "chat-typing", from: 5.1 },
  // "then go play". Daylight, forward motion, and no gamertag on the frame.
  { clip: "broll-quiet", from: 2.05 },
];
