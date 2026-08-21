/**
 * THE CLOCK, DERIVED RATHER THAN TRANSCRIBED.
 *
 * Carried over intact from src/v6/timing.ts, because it is the part of the last direction that
 * was right and it was expensive to get right. Every beat boundary comes from the measured
 * position of that beat's own phrase in its own WAV; the picture leads the voice by a fixed
 * amount at every cut so the error cannot accumulate; nothing here is typed in by hand and
 * nothing here is estimated once the read exists.
 *
 * It is a copy rather than an import for one reason: src/v6/ is history now and history should
 * not be edited to serve a film that came after it. The numbers below are the same law with
 * two of its four constants moved, and the two that moved are commented where they moved.
 *
 * =====================================================================================
 * THE TWO PASS BUILD
 * =====================================================================================
 *
 * `scripts/build-audio.ts` needs the composition's length before it can build the mix, because
 * the bed is laid under the whole film including the end card, and the composition's length is
 * derived from the read. So on a film whose audio has never been built, this file has nothing
 * to derive from and answers with `estimateFrames`.
 *
 * That estimate is used for exactly one thing: how long a bed to render. Running
 * `pnpm video:audio --only pro-001` a second time rebuilds the mix against the now derived
 * length, hits the phrase cache for every word, and costs a few seconds. `pnpm validate` fails
 * until that second pass has happened, because it asserts the mix and the film are the same
 * number of frames.
 */
import { audioFor } from "@/audio/timings";
import { FPS } from "@/lib/scale";

import type { ProScript } from "./script";

/**
 * How far the picture runs ahead of the voice at every cut, in frames.
 *
 * 6 frames, 0.20s, unchanged across three directions now. A cut that lands ON the word reads
 * as late, because the eye needs the frame before the ear needs the word; much more than this
 * and the picture is visibly running its own race.
 */
export const BEAT_LEAD_FRAMES = 6;

/**
 * Frames the last beat holds after the read has finished, before the end card takes over.
 *
 * 18 frames, 0.60s, against the sixth direction's 14. It moved because the last line changed
 * shape. "then go play" was a two second fragment that had already said everything it had to
 * say, so leaving on the frame its file ended was correct. "lock the duo, send a message, and
 * go play" ends on the film's only image that is outside the app, and the measured reference
 * reels all hold their final image before the logo: Uber holds 0.53s, ClickUp 0.67s. This is
 * the stillness the doctrine reserves for immediately before a landing, spent once.
 */
export const TAIL_FRAMES = 18;

/**
 * The end card.
 *
 * 45 frames, 1.5s, against the sixth direction's 30. The card itself is the thing Cameron
 * likes and its content does not change; what changed is that it now has to carry a redesigned
 * lockup, a waitlist line and a URL, and one second is under the time it takes to read a URL
 * and decide to type it. The measured end cards in the reference reels run 1.4s (Uber) and
 * 1.9s (ClickUp), and both set their tagline SMALLER than the body lines, which is the note
 * this card's redesign has to take: the film whispers at the end, it does not shout.
 */
export const END_FRAMES = Math.round(1.5 * FPS);

/**
 * A beat's length before the read exists, used only to size the bed on the first audio pass.
 *
 * Refitted for this script, because the sixth direction's fit was measured on two to four word
 * fragments and every phrase here is a nine to twelve word sentence. Kokoro reads a sentence
 * closer to conversational speed than a fragment, so the per word slope falls and the fixed
 * cost rises. It is never seen by a viewer and never reaches a rendered frame: the second
 * audio pass replaces every number here with a measured one.
 */
const estimateFrames = (phrase: string, isLast: boolean): number => {
  const words = phrase.trim().split(/\s+/).length;
  const spoken = 0.45 + 0.34 * words;
  return Math.round((spoken + (isLast ? TAIL_FRAMES / FPS : 0.78)) * FPS);
};

/**
 * Every beat's length in frames, derived from the measured read.
 *
 * A beat begins BEAT_LEAD_FRAMES before its own phrase's file does and ends where the next
 * beat begins, so the lead is flat by construction and no beat's length depends on any other
 * beat's length. The last one ends TAIL_FRAMES after the read stops.
 */
export const beatFrames = (script: ProScript): number[] => {
  const audio = audioFor(script.id);
  if (audio === null || audio.lines.length !== script.beats.length) {
    return script.beats.map((beat, index) =>
      estimateFrames(beat.phrase, index === script.beats.length - 1),
    );
  }
  const starts = audio.lines.map((line) => Math.max(0, line.startFrame - BEAT_LEAD_FRAMES));
  const end = audio.voEndFrame + TAIL_FRAMES;
  return script.beats.map((_, index) => (starts[index + 1] ?? end) - (starts[index] ?? 0));
};

/** Local frame each beat starts at, which is what a Sequence takes. */
export const beatStarts = (script: ProScript): number[] => {
  let at = 0;
  return beatFrames(script).map((frames) => {
    const from = at;
    at += frames;
    return from;
  });
};

export const bodyFrames = (script: ProScript): number =>
  beatFrames(script).reduce((total, frames) => total + frames, 0);

export const proDuration = (script: ProScript): number => bodyFrames(script) + END_FRAMES;
