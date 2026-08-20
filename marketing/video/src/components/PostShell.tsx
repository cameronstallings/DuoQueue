/** Every post is a body and then the end card. This is the one place that is true. */
import type { ReactNode } from "react";

import { Sequence, useVideoConfig } from "remotion";

import type { Cta } from "@/config/phase";

import { END_CARD_FRAMES } from "@/lib/duration";

import { EndCard } from "./EndCard";

/**
 * The body goes inside its own Sequence rather than being left to run underneath the end
 * card, for two reasons that both matter.
 *
 * It unmounts the footage the moment the card starts. OffthreadVideo extracts one frame of
 * source per frame it is mounted for, so 75 frames under an opaque card is 2.5 seconds of
 * decode paid for and never seen, three times a day.
 *
 * And it moves the clock. Inside a Sequence, useCurrentFrame() starts at 0 and
 * useVideoConfig().durationInFrames reports the sequence, so a format times its beats against
 * its own body and never has to remember to subtract the card.
 */
export const PostShell = ({ cta, children }: { cta: Cta; children: ReactNode }) => {
  const { durationInFrames } = useVideoConfig();
  const body = durationInFrames - END_CARD_FRAMES;

  return (
    <>
      <Sequence durationInFrames={body} name="body">
        {children}
      </Sequence>
      {/* EndCard carries its own Stage and is full bleed, so it sits beside the body rather
          than inside it. */}
      <Sequence from={body} durationInFrames={END_CARD_FRAMES} name="end card">
        <EndCard cta={cta} />
      </Sequence>
    </>
  );
};
