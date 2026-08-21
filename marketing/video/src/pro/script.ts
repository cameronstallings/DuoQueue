/**
 * THE SEVENTH SCRIPT, and the first one that is SPEECH rather than a list.
 *
 * =====================================================================================
 * WHAT WAS WRONG WITH THE SIXTH, in Cameron's words and then in mechanism
 * =====================================================================================
 *
 * "the script is so choppy."
 *
 * He is right and the cause is measurable rather than a matter of taste. src/v6/script.ts is
 * six phrases of two to four words, every one of them a complete stop:
 *
 *     queue up with a duo / you match on the game / and how they play /
 *     duo locked / send a message / then go play
 *
 * That is a FEATURE LIST read aloud. Three things follow from it and all three are the note.
 *
 *   IT STUTTERS SIX TIMES. Every phrase ends on a falling intonation, `speakable` puts a full
 *   stop on each one, and the read then takes a 0.57s breath. Six landings in twelve seconds
 *   is a landing every two seconds, and the picture has to cut at each of them because the
 *   voice has stopped. The choppiness Cameron hears in the read and the choppiness he sees in
 *   the cut are one defect with one cause.
 *
 *   NO LINE LEADS ANYWHERE. "duo locked" does not follow from "and how they play"; it is the
 *   next item. A list can be reordered without damage, which is the test that proves it is not
 *   an argument. Reorder the four lines below and the film breaks.
 *
 *   IT IS TOO SHORT TO BE A FILM. Six fragments came to 12.6s. The three reference reels run
 *   18.5s, 25.5s and 56s, and none of them is trying to say more than this one. They are
 *   longer because a sentence takes longer than a label and because a film needs the room to
 *   go somewhere.
 *
 * =====================================================================================
 * THE FIX: FOUR SENTENCES WITH AN ARC
 * =====================================================================================
 *
 * Four lines, each a complete conversational sentence in the second person, each one leading
 * into the next, and the last one landing on the thing the viewer actually wanted.
 *
 *   1  THE REASON     Why a duo is worth finding, stated as a fact about the viewer's own
 *                     best nights rather than as a claim about the product. Nothing is being
 *                     sold yet.
 *   2  THE ANSWER     The product, by name, as the answer to the sentence before it. The word
 *                     "next" is what ties it to line one; without line one it means nothing,
 *                     which is the proof the two are connected rather than adjacent.
 *   3  THE MECHANISM  How it actually works, in one sentence with two halves, over the deck
 *                     and the card. "match" pays back "find" from line two.
 *   4  THE ACTION     Three verbs in one breath, ending outside the app.
 *
 * THE FOURTH LINE IS WHERE THE STUTTER IS ACTUALLY REMOVED, and it is worth saying how. The
 * old script's last three beats were "duo locked", "send a message" and "then go play": three
 * fragments, three full stops, three dead seams. The same three moments are now three CLAUSES
 * of one sentence, "lock the duo, send a message, and go play". The film still gets three
 * pictures out of them, because the authored break below puts each clause on its own line, but
 * the voice never stops, so the two seams between them carry momentum through instead of
 * hitting a wall. That is three of the six stutters deleted by punctuation.
 *
 * =====================================================================================
 * THE TWO CANDIDATES THAT LOST, and what each of them was better at
 * =====================================================================================
 *
 * Both are kept because the reason each lost is a rule about the next rewrite, and because a
 * script nobody can see the alternatives to gets rewritten from scratch every time.
 *
 * THE LOOP. Pure second person walkthrough, no hook and no brand name:
 *
 *     everyone in here is looking for someone to play with /
 *     you see the games you share and how they like to play /
 *     when somebody looks right, you lock the duo /
 *     send a message, and go get a game in
 *
 * The safest of the three, and the most evidenced: every clause has a shot behind it and line
 * one is a fact about the platform rather than a claim about the viewer. It lost on line one.
 * "everyone in here is looking for someone to play with" describes a directory, and a film that
 * opens by describing a directory has no reason for the viewer to still be there at line two.
 * It also never says the product's name, which nine directions in a row have now failed to do
 * while ending on a card asking for a waitlist signup.
 *
 * THE ASK. The most conversational, and the only one that stated the promise as a limit:
 *
 *     you want somebody good who plays what you play /
 *     that is the only thing this app does /
 *     every card shows the games you share and how that person plays /
 *     lock the duo, say hello, and go win something
 *
 * "that is the only thing this app does" is the best single line written for any of the three
 * and it is the reason this one lost. It is a claim about what the product does NOT do, dressed
 * as a claim about focus, and the whole reason this script exists is that claims of that shape
 * are the ones the picture eventually contradicts: the app has a paywall, a profile editor and
 * an appearance setting, all of them already recorded in public/footage. "go win something" is
 * also a promise about an outcome the product cannot deliver, where "go play" is a description
 * of what happens next.
 *
 * WHAT THE WINNER TOOK FROM EACH. The four line shape and the three clause landing come from
 * THE LOOP. The refusal to open on the product comes from THE ASK.
 *
 * =====================================================================================
 * WHAT IS TRUE HERE, and how each clause is evidenced on the frame
 * =====================================================================================
 *
 * The rule that survived from the sixth script is the one that has caught two of Cameron's
 * notes: a claim about what the product LACKS is very hard to keep true and the picture
 * eventually contradicts it, so this film only ever says what is on the screen.
 *
 *   "you played with someone else"      broll-quiet / frag-play, a real match.
 *   "duoqueue is where you find"        the deck, dealing real profile cards with photographs
 *                                       on them. The film never claims otherwise; the previous
 *                                       direction's "no faces" over a face is the reason that
 *                                       sentence is written this way.
 *   "the games you play"                frag-dark-games, the app's own games chip.
 *   "and how you play them"             frag-dark-role (ROCKET LEAGUE . Ranked Grinder) and
 *                                       frag-dark-prompt (two years of solo queue).
 *   "lock the duo"                      frag-dark-locked, the app's own DUO LOCKED banner.
 *   "send a message"                    frag-dark-send, the app's own button, then the bubble.
 *   "and go play"                       frag-play.
 *
 * NO NEGATION ANYWHERE. There is not a single "not", "no" or "never" in the read. The fifth
 * script was every beat a negation and spent the whole film talking about the category it did
 * not want to be filed under. This one never mentions it, which is a stronger way of not being
 * it.
 *
 * NO EM DASHES, read or heard. Nothing implies anything but playing games with somebody. The
 * film is eighteen plus and platonic by construction rather than by disclaimer.
 *
 * =====================================================================================
 * THE LINE BREAKS ARE PART OF THE COPY
 * =====================================================================================
 *
 * `lines` joined by a single space must equal `phrase` exactly, which `pnpm validate` asserts,
 * so the eye and the ear cannot drift. No line carries a single word alone, which is the
 * orphan Cameron caught in the fifth cut.
 *
 * The breaks are also the layout. The motion study measured every line in all three reference
 * reels sitting on a centred measure of 63 to 75 percent of frame width, which at 1080 is 680
 * to 810px, and a four word line set at about 81px to fill it. A twelve word sentence
 * therefore breaks to two or three lines of four to seven words, never to one long thin line
 * of small type, and each break falls at a grammatical joint so that a line is always a phrase
 * a person would pause at.
 */
import type { ClipName } from "@/types";

export interface ProBeat {
  /**
   * What is spoken, and the single source of the copy. The rendered lines are this string
   * broken by hand; see the header for why the break is authored rather than fitted.
   *
   * Internal commas are kept because they are the read: they are what stops Kokoro running
   * the three clauses of beat four together. Terminal punctuation is NOT written here, because
   * `speakable` adds the full stop the synthesiser needs and the frame should not show one.
   */
  phrase: string;
  /**
   * The authored break, in reading order. Joined with one space this is `phrase`, asserted by
   * `pnpm validate`. Never a single word on its own line.
   *
   * A LINE IS AT MOST ABOUT TWENTY-ONE CHARACTERS, and that is a measurement rather than a taste.
   * `groupSize` fits a group to the 745px measure and may only shrink it, so a long line does not
   * overflow, it goes SMALL, and Manrope ExtraBold at this tracking runs about 0.52em per
   * character: 745px over 21 characters is 68px, and every character past that costs size the
   * reference says the film cannot afford. The eleven and twelve word beats are therefore three
   * lines each, not two. Set as two they fitted at roughly 50px, and with the old floor raising
   * them back to 68 they rendered 1024px and 915px wide on a 1080 frame, the second of them
   * running off the right edge. Three lines of twenty characters is the same sentence at 72px,
   * inside the measure, centred.
   */
  lines: string[];
  /**
   * The one word that carries the beat, matched case insensitively.
   *
   * The reference reels put the brand colour on exactly one word per line and it is never
   * mechanically the last one: measured, Uber accents "options" at the end of one line and
   * "your" in the middle of the next. The accent follows the payload word wherever it falls,
   * so it is named here rather than derived by position.
   */
  key: string;
  /**
   * Kokoro's rate for THIS phrase, overriding the film's own rate.
   *
   * A correction applied to a measurement, never a guess made in advance. Every value below
   * was solved against a delivered read; see the note on the beats.
   */
  speed?: number;
}

export interface ProScript {
  id: string;
  /** The post caption, doing the same job as `Hook.caption` in src/data/hooks.ts. */
  caption: string;
  beats: ProBeat[];
}

export const PRO: ProScript = {
  id: "pro-001",
  caption:
    "you match on the games you play and how you play them. lock the duo, send a message, go play. 18+ and platonic.",
  beats: [
    // THE RATE OVERRIDES ARE A CORRECTION APPLIED TO A MEASUREMENT, and this script needs them
    // in the opposite direction from the last one.
    //
    // Kokoro reads a fragment deliberately and a sentence conversationally, so the sixth
    // script's two and three word beats came back at 106 to 169 words a minute while its one
    // full sentence came back at 210. Every line here IS a full sentence, so at the film's own
    // 0.9 the whole read arrives fast rather than one line of it.
    //
    // The overrides below are solved against words a minute directly, on Kokoro's measured
    // curve of duration going as roughly (1/speed)^1.78, from the first pass measured at 0.9.
    // See THE READ, MEASURED at the foot of this file for both tables.
    // 0.9 measured 3.029s, 218 wpm. Slowed most of the four, because it is the hook and
    // because it is the only line whose job is to be believed rather than understood.
    {
      phrase: "your best games were the ones you played with someone else",
      lines: ["your best games were", "the ones you played", "with someone else"],
      key: "someone",
      speed: 0.76,
    },
    // 0.9 measured 2.368s, 203 wpm. `speakable` says this one as "duo queue", so the read is
    // nine words where the frame shows eight, which is worth knowing before anybody solves a
    // rate against the written count.
    {
      phrase: "duoqueue is where you find the next one",
      lines: ["duoqueue is where you", "find the next one"],
      key: "duoqueue",
      speed: 0.76,
    },
    // 0.9 measured 2.837s, 254 wpm, the fastest thing in the film by 36 wpm and the line that
    // carries the whole differentiator. The parallel construction is why: "you play ... you
    // play them" is two short identical feet, and Kokoro takes a repeated foot at a run.
    {
      phrase: "you match on the games you play and how you play them",
      lines: ["you match on", "the games you play", "and how you play them"],
      key: "how",
      speed: 0.68,
    },
    // THE STUTTER REMOVAL, and the reason the three clauses each get their own line.
    //
    // These were three separate beats with three full stops in the sixth script. They are one
    // sentence now, so the voice carries through both seams, and the three line stack gives the
    // picture the three moments it still wants: the DUO LOCKED banner, the send button, the
    // match. One breath, three pictures, no dead boundary.
    // 0.9 measured 2.709s, 199 wpm.
    {
      phrase: "lock the duo, send a message, and go play",
      lines: ["lock the duo,", "send a message,", "and go play"],
      key: "play",
      speed: 0.77,
    },
  ],
};

/**
 * One beat's footage.
 *
 * The three directions share the script, the read, the mix, the beat table AND the shot plan,
 * which is what makes them comparable: a difference between two of the rendered files is a
 * difference of look and of nothing else.
 */
export interface Shot {
  clip: ClipName;
  /** Seconds into the trimmed clip this beat starts at, so two beats over one file are two
   * different moments rather than the same second twice. */
  from: number;
}

/**
 * =====================================================================================
 * THE READ, MEASURED
 * =====================================================================================
 *
 * Three passes, each one a correction applied to the pass before it. Nothing below was
 * predicted; `pnpm video:audio --only pro-001` measured every number with ffprobe and the
 * committed table in src/audio/timings.generated.ts is where they live.
 *
 * PASS ONE, everything at the film's own 0.9:
 *
 *   1  3.029s  218 wpm      3  2.837s  254 wpm
 *   2  2.368s  203 wpm      4  2.709s  199 wpm
 *
 * The whole read is fast, not one line of it, which is the difference between this script and
 * the sixth: a film of fragments has one sentence in it that runs away, and a film of sentences
 * runs away everywhere. 254 wpm on beat three is the fastest thing measured in any cut of this
 * project except the 270 wpm opening that started the "it feels rushed" note.
 *
 * PASS TWO, solved on Kokoro's published curve of duration going as (1/speed)^1.78, at 0.78 /
 * 0.81 / 0.71 / 0.82: 175 / 185 / 181 / 180 wpm. The curve UNDERSHOOTS. Fitting the exponent to
 * what each phrase actually traced between the two passes gives 1.54 / 0.89 / 1.44 / 1.12, so
 * there is no single exponent and there was never going to be one: a phrase's leading and
 * trailing silence does not scale with the rate, and the share of a phrase that is silence
 * differs per phrase.
 *
 * PASS THREE, solved per phrase on its own two point fit, at 0.76 / 0.76 / 0.68 / 0.77. This is
 * the delivered read:
 *
 *   beat  words  speed  duration  wpm
 *   1     11     0.76   3.861s    171
 *   2      8     0.76   2.965s    162     (Kokoro says nine: "duo queue")
 *   3     12     0.68   4.117s    175
 *   4      9     0.77   3.435s    157
 *
 * 40 words over 14.378s of speech, 167 wpm aggregate against broadcast narration's 150 to 170,
 * and a spread of 18 wpm across four phrases against the sixth cut's 148. The read is even as
 * well as correct, which is the property a per phrase correction buys and a plan level one
 * cannot.
 *
 * THE GAPS measured 0.567s, flat, three times, which is PRO_GAP_FRAMES exactly.
 *
 * THE MIX measured -14.7 LUFS integrated, -1.9 dBTP, LRA 2.4.
 *
 * =====================================================================================
 * THE DERIVED BEAT TABLE
 * =====================================================================================
 *
 * Computed by ./timing.ts from the table above. Not typed in, and it changes by itself the
 * next time the read does.
 *
 *   beat        start          length          phrase       lead   slack
 *   1           0f   0.000s    133f  4.433s      6-122f       6f     11f
 *   2         133f   4.433s    106f  3.533s    139-228f       6f     11f
 *   3         239f   7.967s    140f  4.667s    245-368f       6f     11f
 *   4         379f  12.633s    127f  4.233s    385-488f       6f     18f
 *   end card  506f  16.867s     45f  1.500s
 *   total     551f  18.367s, and the mix is 551 frames, which is the assertion in checkPro.
 *
 * The lead is 6 frames at all four cuts, so it is flat and cannot accumulate. Every phrase
 * finishes inside its own beat with at least 11 frames to spare, so no line is ever heard over
 * the next beat's picture.
 *
 * WHAT THE DIRECTIONS HAVE TO DO WITH THIS. Four beats of 3.5 to 4.7s is NOT four shots. The
 * motion study measured held states of 0.43 to 0.87s and transitions of 0.13 to 0.40s in the
 * best reference, roughly 60/40 hold to move, and put a 15 to 20 second film at 11 to 14 beats.
 * So each spoken beat here is a CONTAINER for two to four visual events, and the events inside
 * it are joined by in place content morphs and continuous transforms rather than by cuts. Beat
 * three is 140 frames and has three things to show, the games chip, the playstyle and the
 * prompt; the reference's answer to exactly that problem is to hold one object and change what
 * is written on it. Beat four is already broken into its three clauses by `lines` above.
 */
