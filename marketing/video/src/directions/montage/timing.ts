/**
 * Speed ramping for OffthreadVideo, which has no time-remapping prop of its own.
 *
 * The trick is that OffthreadVideo does not integrate anything. It computes the source
 * timestamp from scratch on every frame (remotion/dist/cjs/video/get-current-time.js):
 *
 *   currentTime = (trimBefore + frameInsideTheShot * playbackRate) / fps
 *
 * `playbackRate` is therefore not a speed. It is a free multiplier this module is allowed to
 * change every frame, so any source-time curve at all can be dialled in by solving for it:
 *
 *   playbackRate(f) = consumedSeconds(f) * fps / f
 *
 * where consumedSeconds(f) is however much of the source the shot has eaten by frame f. That
 * is the integral of the rate curve, summed here a frame at a time. A constant rate gives
 * back a constant playbackRate and the identity holds, so ramped and unramped shots go down
 * the same path.
 *
 * Doing it this way, rather than by nudging a Sequence's `from` per frame, is what keeps slow
 * motion smooth: `from` is an integer, so it would quantise the source to 1/30s steps and a
 * 0.3x shot would advance in visible 2-frame jerks against 60fps footage. playbackRate is a
 * float, so a 0.3x shot lands on a different source frame every time and reads as slow
 * motion instead of as a stutter.
 */
import { FPS } from "@/lib/scale";

/** A constant speed, or a ramp between two speeds across the shot. */
export type Rate = number | { from: number; to: number };

/** Cubic ease out: most of the change happens in the first third of the shot, which is what
 * makes a ramp read as a SNAP into slow motion rather than as a gradual slide. */
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

export const rateAt = (rate: Rate, progress: number): number =>
  typeof rate === "number" ? rate : rate.from + (rate.to - rate.from) * easeOut(progress);

/** Seconds of source consumed before `upto` is displayed. */
export const consumedSeconds = (rate: Rate, frames: number, upto: number): number => {
  if (typeof rate === "number") {
    return (rate * upto) / FPS;
  }
  let seconds = 0;
  const span = Math.max(frames - 1, 1);
  for (let k = 0; k < upto; k++) {
    seconds += rateAt(rate, k / span) / FPS;
  }
  return seconds;
};

/** The multiplier to hand OffthreadVideo on this frame. */
export const playbackRateFor = (rate: Rate, frames: number, frame: number): number => {
  if (frame <= 0) {
    return 1;
  }
  return (consumedSeconds(rate, frames, frame) * FPS) / frame;
};
