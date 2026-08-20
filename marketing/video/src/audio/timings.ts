/**
 * THE CLOCK, MEASURED.
 *
 * The doctrine's rule for this build is that audio is the clock, and a clock that lives in
 * a WAV file on a gitignored disk cannot be read by a composition that has to be laid out
 * before a frame is drawn. So `scripts/build-audio.ts` writes what it measured into
 * `timings.generated.ts`, which is COMMITTED, and this file is how the rest of the project
 * reads it.
 *
 * Committed on purpose, and it is the same call `state/rendered.json` makes. The numbers are
 * small, they are the only thing standing between a retimed cut and a guess, and a diff that
 * shows a hook's read getting 0.4s longer is worth having in review. The WAVs themselves stay
 * gitignored: they are large, they are byte-for-byte reproducible from this text, and
 * regenerating one is a cache hit away.
 *
 * The mix files are gitignored, so on a fresh clone this module will list posts whose audio
 * is not on the disk yet. That is why `Soundtrack` checks `getStaticFiles()` before it
 * mounts anything, exactly as `Clip` does for footage: a missing mix renders silent, not
 * broken, and `pnpm video:audio` fills it in.
 */
import { AUDIO } from "./timings.generated";
import type { VoiceId } from "./vo";

/** One spoken line, with the place it actually lands. */
export interface AudioLine {
  /** What the frame renders. */
  written: string;
  /** What Kokoro was given. See `speakable` in ./vo.ts. */
  spoken: string;
  /** Measured with ffprobe, not estimated. */
  startSeconds: number;
  endSeconds: number;
  /** The same instants at 30fps, which is what a Sequence takes. */
  startFrame: number;
  endFrame: number;
}

/** What the loudness verification actually read back off the finished file. */
export interface MixLoudness {
  integratedLufs: number;
  truePeakDb: number;
  lra: number;
}

/** One post's finished audio. */
export interface PostAudio {
  id: string;
  voice: VoiceId;
  /** Path under public/, ready for staticFile(). */
  file: string;
  /** Where the read starts and stops. The end card plays under bed alone after `voEndFrame`. */
  voEndSeconds: number;
  voEndFrame: number;
  /** The whole file, bed tail included. */
  seconds: number;
  frames: number;
  lines: AudioLine[];
  loudness: MixLoudness;
}

/** The finished audio for a post, or null when it has not been built. */
export const audioFor = (id: string): PostAudio | null => AUDIO[id] ?? null;

/** Every post that has audio, which is what a report or a validator wants. */
export const builtAudioIds = (): string[] => Object.keys(AUDIO).sort();
