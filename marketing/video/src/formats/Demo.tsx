/**
 * Format 3 of the spec's four: lowest reach, highest intent. Three steps of the real app,
 * labelled and nothing else.
 *
 * No hook lines over the footage. Someone still watching a demo has already decided they are
 * interested, and the thing they want is to see the product work, so the only copy is the
 * index chip that says which step they are looking at.
 */
import { AbsoluteFill, Series, useVideoConfig } from "remotion";

import { Chip } from "@/components/Chip";
import { Clip } from "@/components/Clip";
import { PostShell } from "@/components/PostShell";
import { Stage } from "@/components/Stage";
import type { Cta } from "@/config/phase";
import { SAFE } from "@/lib/scale";
import type { DemoHook } from "@/types";

/**
 * Frames of bare ground between steps. Two shots of the same app cut together with no gap
 * read as one continuous take that jumped, which looks like a dropped frame rather than an
 * edit. Four frames of the Stage underneath (13ms short of a seventh of a second) is long
 * enough to register as a deliberate cut and too short to be a pause.
 */
const CUT_FRAMES = 4;

const Body = ({ hook }: { hook: DemoHook }) => {
  const { durationInFrames } = useVideoConfig();
  const count = hook.steps.length;
  // Equal shares of what is left after the cuts, with the last step absorbing the rounding so
  // the series lands exactly on the end card instead of a frame either side of it.
  const available = durationInFrames - CUT_FRAMES * (count - 1);
  const share = Math.floor(available / count);
  const lastShare = available - share * (count - 1);

  return (
    <Stage>
      <Series>
        {hook.steps.map((step, index) => (
          <Series.Sequence
            key={index}
            durationInFrames={index === count - 1 ? lastShare : share}
            // The gap is an offset rather than a shorter clip so the arithmetic above stays
            // about how long a step is shown, not about how long it is minus a cut.
            offset={index === 0 ? 0 : CUT_FRAMES}
          >
            <Clip name={step.clip} />
            <AbsoluteFill style={{ alignItems: "flex-start", paddingTop: SAFE.top, paddingLeft: SAFE.side }}>
              {/* Volt, because this is the one piece of chrome the video adds to the app's own
                  interface and it should read as this pipeline's mark on it rather than as
                  something the app is showing. It arrives with the cut and does not animate. */}
              <Chip label={step.label} tone="volt" />
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </Stage>
  );
};

export const Demo = ({ hook, cta }: { hook: DemoHook; cta: Cta }) => (
  <PostShell cta={cta}>
    <Body hook={hook} />
  </PostShell>
);
