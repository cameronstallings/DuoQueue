/**
 * THE SIXTH SCRIPT, and the first one that describes the product instead of arguing with a
 * category.
 *
 * =====================================================================================
 * WHAT WAS WRONG WITH THE FIFTH, in Cameron's words and then in mechanism
 * =====================================================================================
 *
 * "the script sucks tbh" and "the no faces makes no sense because the profile picture has a
 * face on it in the video".
 *
 * Both notes have one cause. Every beat of the old script was a NEGATION: "this is not a
 * dating app", "no faces". Three things follow from that and all three are bad. It spends the
 * film talking about the category the brand least wants to be filed under. It never says what
 * the thing does. And a claim about what a product LACKS is much harder to keep true than a
 * fact about what it shows, so eventually the picture contradicts it, which is the note
 * Cameron actually caught.
 *
 * The replacement is the product loop, in the order a person lives it, with every clause
 * visible on the frame while it is spoken.
 *
 * =====================================================================================
 * THE SECOND PASS: THE FILM STOPPED CONTRADICTING ITSELF IN WORDS AND STARTED DOING IT IN
 * PIXELS
 * =====================================================================================
 *
 * The first cut of this script was verified twice and both reviews found the same defect in a
 * new place. `>> NO GAMES IN COMMON` is a bordered pill at the focal centre of every card in
 * `deck-cards.mp4`, and it was on screen for 51% of the film, legible, while the voice said
 * "you match on the game". That is the same defect class as "no faces" over a face, applied to
 * the film's central differentiator.
 *
 * It is not a grading problem and it cannot be cropped away. It is
 * apps/mobile/src/features/swipe/SwipeCard.tsx: `overlapLabel(0)` returns that string, and the
 * review account shares no games with any persona in `deck-cards`. Cropping it out is
 * forbidden by the uncropped constraint and would be a lie anyway.
 *
 * What fixed it was reading the footage again instead of the report. `deck-dark.mp4` is the
 * same deck a minute earlier in the same recording, and two of its cards, Wren and Kofi, carry
 * `>> 1 GAME IN COMMON` in the affirmative green. They are the only two cards in 128 seconds of
 * recording that do, because the review account's own profile lists Stardew Valley and Rocket
 * League and those are the two people who play them. So the deck beats now run over the two
 * cards where the app itself is rendering the claim the voice is making, and the film's
 * evidence is on the frame rather than asserted over it.
 *
 * Three more things came with that clip and each one closes a note from the reviews.
 *
 *   IT SWIPES YES. `deck-cards` contains two PASS stamps and no accepting gesture, so the old
 *   cut showed the deck rejecting twice and then matching with no visible cause. `deck-dark`
 *   stamps DUO on Wren at 2.85s and on Kofi at 5.05s. The film now shows the affirmative
 *   action, twice, under the two beats that describe it.
 *
 *   THE PERSON STOPS CHANGING. The old cut locked with Marcus and then opened a thread with
 *   Kofi. `deck-dark` duos with Kofi, `match-kofi.mp4` is DUO LOCKED with Kofi, and
 *   `chat-typing.mp4` is the Kofi thread. One person, three beats.
 *
 *   THE PROMPT STOPS ARGUING. The old beat three held for a second on "Roguelites are better
 *   solo. Co-op just means two people arguing over relics." under the line whose job is to sell
 *   playing together. Kofi's card reads "Hit Grand Champion in Rocket League solo queue. Took
 *   two years. Worth it.", which is the pain the product exists for rather than a case against
 *   it.
 *
 * =====================================================================================
 * WHY THE OPENING BEAT IS THE GAME
 * =====================================================================================
 *
 * Arithmetic, not taste. The green chip window in `deck-dark` runs 1.05s to 5.65s: four and a
 * half seconds, holding two settled cards and two DUO swipes. Two deck beats at this read cost
 * 4.4s of it. A third would have to come out of `deck-cards`, which is where the contradiction
 * lives. So the film gets exactly two deck beats and the hook goes to the one other thing it
 * can honestly be about, which is the game.
 *
 * That is the better film anyway. It opens on a match and closes on one, the app sits between
 * them, and "then go play" puts the viewer back where the first frame was. A duo finder is
 * supposed to end outside itself.
 *
 * =====================================================================================
 * WHAT THIS SCRIPT SAYS
 * =====================================================================================
 *
 *   1  QUEUE UP WITH A DUO    The promise, in the product's own verb, over a real match. It
 *                             plants DUO in the first second and beat 4 pays it back with the
 *                             app's own DUO LOCKED.
 *   2  YOU MATCH ON THE GAME  The differentiator, stated as a fact about what the card shows,
 *                             over a card reading STARDEW VALLEY, Casual, and >> 1 GAME IN
 *                             COMMON, which is the same claim rendered by the app. Ends on the
 *                             DUO stamp.
 *   3  AND HOW THEY PLAY      The second half of the same sentence and the half that stops the
 *                             film sounding like a filter list. On screen: ROCKET LEAGUE,
 *                             Ranked Grinder, and a prompt answer about two years of solo
 *                             queue. Ends on the second DUO stamp.
 *   4  DUO LOCKED             The payoff, in the app's own two words, on the frame that shows
 *                             them, with the photograph of the person just agreed to.
 *   5  SEND A MESSAGE         The app's own button, and the shot is the message being typed,
 *                             sent, and landing as a bubble marked SENT. Nothing is a metaphor.
 *   6  THEN GO PLAY           The point of all of it, over daylight. The film ends where a duo
 *                             finder is supposed to end, which is not in the app.
 *
 * =====================================================================================
 * THE LINE BREAKS ARE PART OF THE COPY
 * =====================================================================================
 *
 * Cameron's fifth note was that "SAME GAME / SAME / HOURS" leaves an orphan SAME on a line by
 * itself and reads as a mistake. It was: the old system broke a phrase to suit a fitting
 * algorithm and let the algorithm decide what a line was.
 *
 * Here the break is authored and it is checked. `lines` joined by a single space must equal
 * `phrase` exactly, which `pnpm validate` asserts, so the two registers cannot drift. And no
 * beat breaks to a line carrying a single word: the six stacks are two balanced lines or one
 * whole line, and nothing else.
 *
 * NO EM DASHES, anywhere a viewer reads or hears one. Nothing implies dating. The film is
 * eighteen plus and platonic by construction rather than by disclaimer, because it only ever
 * talks about playing games with somebody.
 */
import type { ClipName } from "@/types";

export interface V6Beat {
  /**
   * What is spoken, and the single source of the copy. The rendered lines are this string
   * broken by hand; see the header for why the break is authored rather than fitted.
   */
  phrase: string;
  /**
   * The authored break, in reading order. Joined with one space this is `phrase`, asserted by
   * `pnpm validate`. Never a single word on its own line.
   */
  lines: string[];
  /**
   * The one word that carries the beat, matched case insensitively. Directions may mark it or
   * ignore it, but they all agree on which word it is, so the emphasis is a property of the
   * script rather than of three separate layout files.
   */
  key?: string;
  /**
   * Kokoro's rate for THIS phrase, overriding the film's own rate.
   *
   * A correction applied to a measurement, never a guess made in advance. See the note on the
   * beats below for what was measured and what it was solved to.
   */
  speed?: number;
}

export interface V6Script {
  id: string;
  /** The post caption, doing the same job as `Hook.caption` in src/data/hooks.ts. */
  caption: string;
  beats: V6Beat[];
}

export const V6: V6Script = {
  id: "v6-001",
  caption:
    "you match on the game and how they play. lock a duo, send a message, go queue. 18+ and platonic.",
  beats: [
    // THE RATE OVERRIDES ARE A CORRECTION APPLIED TO A MEASUREMENT.
    //
    // Verification of the first cut of this script found beats 2 and 3 reading at 216 and 220
    // words a minute against a 150 to 200 target. Their overrides had been solved against
    // SYLLABLES a second and hit it exactly, 3.37 against the approved cut's 3.31, but words a
    // minute rose 17.5% anyway because the copy is more monosyllabic than the copy the band was
    // measured on: 1.125 syllables a word against 1.30. Same syllable rate, more words through
    // it.
    //
    // So these are solved against words a minute directly, on Kokoro's measured curve of
    // duration going as roughly (1/speed)^1.78. Beats 4 to 6 measured 115, 153 and 169 wpm at
    // the film's own 0.9 and are left alone, because a two word fragment read deliberately is
    // not the defect a sentence read fast is.
    //
    // What the three overrides below land, measured off the delivered mix rather than
    // predicted: 169, 176 and 184 wpm, against 210, 216 and 220 before. Every phrase in the
    // film is now inside 150 to 200 and the film's aggregate is 164 wpm against the first
    // cut's 180 and the approved cut's 153.
    //
    // 0.80 measured 1.429s (210 wpm) and 0.72 measured 1.579s (190 wpm); 0.68 lands 169.
    { phrase: "queue up with a duo", lines: ["queue up", "with a duo"], key: "duo", speed: 0.68 },
    { phrase: "you match on the game", lines: ["you match on", "the game"], key: "game", speed: 0.76 },
    // Four words rather than five, and 0.85 rather than the 0.77 the wpm curve asks for, and
    // both changes are bought with the same currency. The beat is 56 frames instead of 68, and
    // 12 frames is 0.4s of deck footage this film does not have: Chase's card, which carries
    // >> NO GAMES IN COMMON, is revealed behind Kofi's from 5.25s of `deck-dark`, and the two
    // deck beats now finish at 5.22 instead of 5.72. At 0.77 with four words the read measured
    // 154 wpm, at the very bottom of the band; 0.85 measures 184, near the top of it but inside,
    // and it is the only phrase in the film that was sped up rather than slowed down. That is a
    // real trade and it is made in the picture's favour: a legible negation on screen is a
    // defect Cameron has already caught twice, and 184 wpm is not.
    //
    // "how they play" is also the better phrase. It describes a person's style, which is what
    // Ranked Grinder and a prompt answer about two years of solo queue actually show, where
    // "how they play it" points back at a single title.
    { phrase: "and how they play", lines: ["and how", "they play"], key: "how", speed: 0.85 },
    { phrase: "duo locked", lines: ["duo locked"], key: "locked" },
    { phrase: "send a message", lines: ["send a message"], key: "message" },
    { phrase: "then go play", lines: ["then go play"], key: "play" },
  ],
};

/**
 * One beat's footage.
 *
 * The three directions share the script, the read, the mix, the beat table AND the shot plan,
 * which is what makes them comparable: a difference between two of the rendered files is a
 * difference of look and of nothing else. The first cut gave each direction its own plan and it
 * cost the comparison, because two of the three then disagreed about which claim had evidence
 * under it and one of them was reviewed as making a claim about a card with no card on screen.
 */
export interface Shot {
  clip: ClipName;
  /** Seconds into the trimmed clip this beat starts at, so two beats over one file are two
   * different moments rather than the same second twice. */
  from: number;
}
