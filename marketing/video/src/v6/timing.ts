/**
 * THE CLOCK, DERIVED RATHER THAN TRANSCRIBED.
 *
 * The rule this pipeline rests on is that audio is the clock: every beat boundary comes from
 * the measured position of that beat's own phrase in its own WAV, and the picture leads the
 * voice by a fixed amount at every cut so the error cannot accumulate.
 *
 * The previous direction obeyed that rule by having a person read the measured table and type
 * the frame counts into `script.ts`, with `pnpm validate` asserting afterwards that they had
 * copied it correctly. That works, and it took three attempts to get right, and the assertion
 * is the only reason it stayed right. This file removes the copying step: the frame counts are
 * COMPUTED from src/audio/timings.generated.ts, which is itself written by ffprobe measuring
 * the files. There is nothing to mistype, and re-timing the film to a new read is now a
 * consequence of rebuilding the audio rather than a task somebody has to remember.
 *
 * The assertion stays anyway (see checkV6 in scripts/validate-content.ts). A derivation can be
 * wrong in ways a transcription cannot, and the property being checked, that every phrase is
 * fully contained by its own beat and the lead is flat, is the property the cut rests on
 * whichever way the numbers got there.
 *
 * =====================================================================================
 * THE ONE AWKWARDNESS, and why it is a two pass build rather than a circular import
 * =====================================================================================
 *
 * `scripts/build-audio.ts` needs the composition's length before it can build the mix, because
 * the bed is laid under the whole film including the end card. The composition's length is
 * derived from the read. So on a film whose audio has never been built, this file has nothing
 * to derive from.
 *
 * It answers with `estimateFrames` in that case, and the estimate is used for exactly one
 * thing: how long a bed to render. Running `pnpm video:audio --only v6-001` a second time
 * rebuilds the mix against the now derived length, hits the phrase cache for every word, and
 * costs a few seconds. `pnpm validate` fails until that second pass has happened, because it
 * asserts the mix and the film are the same number of frames.
 *
 * The alternative was to have the script carry a hand written duration for the audio path to
 * use, which is the transcription this file exists to delete.
 */
import { audioFor } from "@/audio/timings";
import { FPS } from "@/lib/scale";

import type { V6Script } from "./script";

/**
 * How far the picture runs ahead of the voice at every cut, in frames.
 *
 * 6 frames, 0.20s, and it is carried over unchanged from the direction Cameron reviewed. The
 * measured lead there ran 0.211 to 0.248s across six beats, a spread of about a frame, and he
 * stopped commenting on the timing. A cut that lands ON the word reads as late, because the
 * eye needs the frame before the ear needs the word; much more than this and the picture is
 * visibly running its own race.
 */
export const BEAT_LEAD_FRAMES = 6;

/**
 * Frames the last beat holds after the read has finished, before the end card takes over.
 *
 * 14 frames, 0.47s. The previous cut's last beat began its exit on the frame its phrase's file
 * ended, which is the same rule stated from the other side: the film starts leaving exactly
 * when it stops talking, and the seam into the end card is a cut mid motion rather than a
 * pause followed by a card.
 */
export const TAIL_FRAMES = 14;

/** The end card, one second. Unchanged: it is the one thing Cameron likes. */
export const END_FRAMES = Math.round(1 * FPS);

/**
 * A beat's length before the read exists, used only to size the bed on the first audio pass.
 *
 * Fitted to the six phrases the last direction measured (2 words 1.09s, 3 words 1.07 to 1.13s,
 * 4 words 1.52s, 6 words 1.66s at this rate), plus the 18 frame gap that follows every phrase
 * but the last. It is never seen by a viewer and it never reaches a rendered frame: the second
 * audio pass replaces every number here with a measured one.
 */
const estimateFrames = (phrase: string, isLast: boolean): number => {
  const words = phrase.trim().split(/\s+/).length;
  const spoken = 0.62 + 0.22 * words;
  return Math.round((spoken + (isLast ? TAIL_FRAMES / FPS : 0.6)) * FPS);
};

/**
 * Every beat's length in frames, derived from the measured read.
 *
 * A beat begins BEAT_LEAD_FRAMES before its own phrase's file does and ends where the next
 * beat begins, so the lead is flat by construction and no beat's length depends on any other
 * beat's length. The last one ends TAIL_FRAMES after the read stops.
 */
export const beatFrames = (script: V6Script): number[] => {
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
export const beatStarts = (script: V6Script): number[] => {
  let at = 0;
  return beatFrames(script).map((frames) => {
    const from = at;
    at += frames;
    return from;
  });
};

export const bodyFrames = (script: V6Script): number =>
  beatFrames(script).reduce((total, frames) => total + frames, 0);

export const v6Duration = (script: V6Script): number => bodyFrames(script) + END_FRAMES;
