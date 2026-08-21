/**
 * The read for the seventh script.
 *
 * THE PACE IS THE ONE THING NOT UNDER REVIEW. Rate 0.9 and about three quarters of a second of
 * breath between statements are carried over unchanged, because they are the two numbers that
 * answered the "it feels rushed" note and Cameron stopped raising it. The opening line of an
 * earlier cut was read at 270 words per minute before those levers existed. Broadcast
 * narration is 150 to 170. Nothing here speeds back up.
 *
 * What did change is where the correction has to go. The two levers do different jobs and this
 * script needs the per phrase one much more than the last script did:
 *
 *   THE PLAN RATE fixes a film that is uniformly too quick. It cannot fix an uneven read.
 *   THE PHRASE RATE fixes one line, and it is part of the cache key, so correcting one line
 *   re-synthesises one file and leaves the others as cache hits.
 *
 * The sixth script was six fragments, and Kokoro reads a fragment deliberately: five of its
 * six phrases landed inside the band on the plan rate alone and only the one full sentence in
 * it ran away. Every phrase here is a full sentence of nine to twelve words, so the whole read
 * is on the fast side of the band at 0.9 rather than one line of it, and the corrections live
 * on the beats in ./script.ts where the measurement put them.
 *
 * Both levers live on this film's own VoPlan rather than on the pipeline, so every other post
 * in the queue hits its phrase cache untouched when this one is rebuilt.
 */
import { VOICE_BY_FORMAT, speakable, type VoPlan } from "@/audio/vo";

// From ./script and ./timing rather than from any component, for the same reason the previous
// direction's vo module did it: `scripts/build-audio.ts` imports this under node to work out
// how long a bed has to be, and reaching a composition would pull `@/lib/fonts` in behind it,
// which opens a `delayRender` handle at module scope with no render to hold back.
import type { ProScript } from "./script";
import { proDuration } from "./timing";

/** Kokoro's rate for this film, before any per phrase correction. See the header. */
export const PRO_SPEED = 0.9;

/**
 * Frames of silence between statements. The parameter is not the quantity: each phrase carries
 * its own head and tail silence, so what a listener hears is this plus both.
 *
 * 17 frames, 0.567s, which measured about 0.78s of real silence in the delivered sixth cut and
 * is the number Cameron stopped raising. It is kept rather than widened even though this film
 * has fewer gaps than that one: a gap between two complete sentences that lead into each other
 * is doing a different job from a gap between two labels, and lengthening it here would put a
 * full stop back into the exact place this script exists to remove one.
 */
export const PRO_GAP_FRAMES = 17;

export const voPlanForPro = (script: ProScript): VoPlan => ({
  id: script.id,
  // The light voice, the same one the reviewed cuts used. The low read is doing a specific job
  // on the pain format that a film describing a product does not need.
  voice: VOICE_BY_FORMAT.reframe,
  lines: script.beats.map((beat) => ({
    written: beat.phrase,
    spoken: speakable(beat.phrase),
    speed: beat.speed,
  })),
  durationInFrames: proDuration(script),
  speed: PRO_SPEED,
  gapFrames: PRO_GAP_FRAMES,
});
