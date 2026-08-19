/**
 * Format 2 of the spec's four: name the feeling, sell nothing.
 *
 * There is no product in this format. It is gameplay footage of solo queue going badly and
 * two or three lines that describe an evening the viewer has had, which is why it needs no
 * app knowledge to land and why the end card is the first time DuoQueue is mentioned at all.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { spacing } from "@app/theme/tokens";

import { Clip } from "@/components/Clip";
import { HookLine } from "@/components/HookLine";
import { PostShell } from "@/components/PostShell";
import { Stage } from "@/components/Stage";
import type { Cta } from "@/config/phase";
import { px, SAFE } from "@/lib/scale";
import type { PainHook } from "@/types";

/** Frames between lines. 18 is 600ms, which is about how long the short lines this format
 * uses take to read, so each one has landed before the next pulls the eye down. */
const STAGGER = 18;

const Body = ({ hook }: { hook: PainHook }) => {
  const frame = useCurrentFrame();

  return (
    <Stage>
      <Clip name={hook.clip} />
      {/* Bottom left, inside the safe box: the stack builds downward from wherever it starts,
          so anchoring the bottom keeps the last line, which is the one that has to be read,
          in the same place whether the hook has two lines or three. */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "flex-start",
          paddingLeft: SAFE.side,
          paddingRight: SAFE.side,
          paddingBottom: SAFE.bottom,
          gap: px(spacing.sm),
        }}
      >
        {hook.lines.map((line, index) => (
          <HookLine
            key={index}
            text={line}
            // One size for the whole stack rather than `hero` per line. fitText sizes each
            // line independently, so at `hero` a two word line would tower over the one under
            // it and the stack would read as three unrelated captions. At `sub` every line in
            // the queue fits without shrinking, so they all come out the same size.
            size="sub"
            // A line steps back to the app's muted ink when the next one arrives, so the whole
            // list is still readable at the end and the newest line is still the loud one. The
            // last line has nothing after it, so it is the one that stays lit: it is the line
            // the format exists to deliver, and dimming it would leave the frame with no
            // subject at all.
            tone={index < hook.lines.length - 1 && frame >= (index + 1) * STAGGER ? "muted" : "ink"}
            delayFrames={index * STAGGER}
          />
        ))}
      </AbsoluteFill>
    </Stage>
  );
};

export const Pain = ({ hook, cta }: { hook: PainHook; cta: Cta }) => (
  <PostShell cta={cta}>
    <Body hook={hook} />
  </PostShell>
);
