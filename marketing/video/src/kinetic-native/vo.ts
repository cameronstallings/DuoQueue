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
 */
import { VOICE_BY_FORMAT, speakable, type VoPlan } from "@/audio/vo";

import { kineticNativeDuration } from "./KineticNative";
import type { KineticNativeScript } from "./script";

export const voPlanForKineticNative = (script: KineticNativeScript): VoPlan => ({
  id: script.id,
  voice: VOICE_BY_FORMAT.reframe,
  lines: script.beats.map((beat) => {
    const written = beat.lines.join(" ");
    return { written, spoken: speakable(written) };
  }),
  durationInFrames: kineticNativeDuration(script),
});
