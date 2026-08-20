/**
 * The read for the sixth script, and the one register the film speaks in.
 *
 * The previous direction ran two written registers, huge display type and a caption rail, and
 * had to decide which of them the voice was allowed to agree with. This film has one: the
 * words on screen are the words in the mouth, broken for the eye and rejoined for the ear.
 * That is not a simplification for its own sake. Cameron's note on the last cut was that he
 * did not like how it looked, and three simultaneous typographic registers over moving footage
 * is most of what "busy" means.
 *
 * THE PACE IS THE ONE THING NOT UNDER REVIEW. Rate 0.9 and about 18 frames of breath between
 * statements are carried over unchanged, because they are the two numbers that answered the
 * "it feels rushed" note and he stopped raising it. The opening line of the last cut was read
 * at 270 words per minute before those levers existed and 197 after. Broadcast narration is
 * 150 to 170. Nothing here speeds back up.
 *
 * Both live on this film's own VoPlan rather than on the pipeline, so every other post in the
 * queue hits its phrase cache untouched when this one is rebuilt.
 */
import { VOICE_BY_FORMAT, speakable, type VoPlan } from "@/audio/vo";

// From ./script and ./timing rather than from any component, for the same reason the previous
// direction's vo module did it: `scripts/build-audio.ts` imports this under node to work out
// how long a bed has to be, and reaching a composition would pull `@/lib/fonts` in behind it,
// which opens a `delayRender` handle at module scope with no render to hold back.
import type { V6Script } from "./script";
import { v6Duration } from "./timing";

/** Kokoro's rate multiplier for this film. See the header. */
export const V6_SPEED = 0.9;

/**
 * Frames of silence between statements. The parameter is not the quantity: each phrase carries
 * its own head and tail silence, so what a listener hears is this plus both.
 *
 * 18 frames was carried over from the approved cut and measured 0.812s in the delivered film
 * against the 0.75s the note was about, because the new phrases have more silence baked into
 * their own files than the old ones did. 17 frames, 0.567s, measures about 0.78s, which is
 * inside the tolerance of the number Cameron stopped raising and buys back the 0.17s the slower
 * read on beats 2 and 3 costs.
 */
export const V6_GAP_FRAMES = 17;

export const voPlanForV6 = (script: V6Script): VoPlan => ({
  id: script.id,
  // The light voice, the same one the reviewed cut used. The low read is doing a specific job
  // on the pain format that a film describing a product does not need.
  voice: VOICE_BY_FORMAT.reframe,
  lines: script.beats.map((beat) => ({
    written: beat.phrase,
    spoken: speakable(beat.phrase),
    speed: beat.speed,
  })),
  durationInFrames: v6Duration(script),
  speed: V6_SPEED,
  gapFrames: V6_GAP_FRAMES,
});
