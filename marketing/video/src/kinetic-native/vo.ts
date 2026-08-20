/**
 * The combined direction's read, derived from its own display type.
 *
 * The film has two written registers and they never say the same words: the huge fitted type
 * is the CLAIM and the rail is the READ. The voice says the claim, because the claim is the
 * sentence the film is built out of and because a voice reading the rail while the type says
 * something else is three registers arguing. So one beat is one spoken phrase, and the phrase
 * is that beat's lines joined back into the sentence they were broken out of.
 *
 * That join is why the beats hold short lines. "this is / not a / dating / app" is four lines
 * on screen because each is fitted to the frame width on its own, and it is one phrase in the
 * mouth. Breaking the copy by hand is the authoring surface for the picture; putting it back
 * together is the authoring surface for the voice, and neither can drift from the other
 * because there is only one copy of the words.
 *
 * The voice is the light one. The film is a reframe in shape, a denial followed by a
 * correction, and the low matter of fact read is doing a specific job on the pain format that
 * this does not need.
 *
 * =====================================================================================
 * THE PACE, and why it is two numbers rather than one
 * =====================================================================================
 *
 * The note on the last cut was that the video talks too fast and feels rushed. There are
 * exactly three ways to answer that and only two of them are honest.
 *
 *   CUT WORDS       done in ./script.ts: 25 words to 20, and every beat rewritten so one word
 *                   carries it. This is the real fix. A rushed film is usually a film with too
 *                   much in it, and slowing a full script down just makes a long film that is
 *                   also slow.
 *   SPEED 0.9       the rate the words themselves are read at. A tenth off is audible as
 *                   deliberateness rather than as drag; much further and Kokoro starts to
 *                   sound sedated rather than composed.
 *   GAP 18 FRAMES   0.60s of breath between statements, against the 8 frames (0.27s) every
 *                   other post uses. This is where most of the air comes from, and it costs
 *                   nothing in comprehension because nobody is speaking during it.
 *
 * The third one is the reason the two levers are separate. Rate and silence both read as
 * "pace" to a viewer and they are completely different things to a listener: a slow rate
 * changes the performance, a long gap changes the edit. This film wanted the edit changed.
 *
 * Both are declared here rather than in the builder, so the whole pace of this direction is
 * one object and no other post is touched by it.
 */
import { VOICE_BY_FORMAT, speakable, type VoPlan } from "@/audio/vo";

// From ./script and never from ./KineticNative, for the same reason END_FRAMES lives there:
// `scripts/build-audio.ts` imports this module under node to work out how long a bed has to
// be, and reaching the composition would pull `@/lib/fonts` in behind it, which opens a
// `delayRender` handle at module scope with no render to hold back.
import { kineticNativeDuration, type KineticNativeScript } from "./script";

/**
 * Kokoro's rate multiplier for this film, and the DEFAULT rather than the rule. See the header.
 *
 * One beat overrides it. Measuring the last cut showed the rate was not uniformly wrong, it was
 * uneven: five phrases landed at or under broadcast pace and the opening sentence landed 25%
 * clear of the next fastest. A single film-wide number cannot express that, so the opening
 * carries its own rate in `Beat.speed` and this stays where it was for the other five.
 */
export const KINETIC_SPEED = 0.9;

/** Frames of silence between statements. 0.60s at 30fps. See the header. */
export const KINETIC_GAP_FRAMES = 18;

export const voPlanForKineticNative = (script: KineticNativeScript): VoPlan => ({
  id: script.id,
  voice: VOICE_BY_FORMAT.reframe,
  lines: script.beats.map((beat) => {
    const written = beat.lines.join(" ");
    // `speed` is usually absent, and an absent one falls through to KINETIC_SPEED below. One
    // beat sets it; see `Beat.speed` in ./script.ts for the measurement that put it there.
    return { written, spoken: speakable(written), speed: beat.speed };
  }),
  durationInFrames: kineticNativeDuration(script),
  speed: KINETIC_SPEED,
  gapFrames: KINETIC_GAP_FRAMES,
});
