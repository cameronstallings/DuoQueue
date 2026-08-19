/**
 * Format 1 of the spec's four, and the highest reach of them: the assumption, then the
 * correction.
 *
 * The whole format is one swap, and everything else on screen exists to make the swap land.
 * The footage says "matching app", the tick says the obvious reading of that is wrong, and
 * the second line says what it actually is. Someone who scrolls past at the swap has still
 * been told the wrong thing, so beatOne has to be true on its own.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { spacing } from "@app/theme/tokens";

import { Clip } from "@/components/Clip";
import { HookLine } from "@/components/HookLine";
import { PostShell } from "@/components/PostShell";
import { Stage } from "@/components/Stage";
import { Tick } from "@/components/Tick";
import type { Cta } from "@/config/phase";
import { useEnter } from "@/lib/enter";
import { px, SAFE } from "@/lib/scale";
import type { ReframeHook } from "@/types";

/** Frames into the body. The label lands before the sentence it labels, and both land after
 * the footage has had a moment to be recognised as a phone screen. */
const TICK_IN = 6;
const LINE_IN = 12;

/** Share of the body beatOne holds. Late enough that the assumption has landed, early enough
 * that the correction, which is the part worth remembering, gets the majority of the watch. */
const SWAP_AT = 0.4;

const Body = ({ hook }: { hook: ReframeHook }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const tick = useEnter(TICK_IN);
  const swapAt = Math.round(durationInFrames * SWAP_AT);

  return (
    <Stage>
      <Clip name={hook.clip} />
      {/* Bottom anchored: the scrim on a Clip is bottom weighted, so this is the only part of
          the frame where 100px of text is guaranteed legible over any footage, and it is also
          the part the app's own interface is least likely to be doing something in. */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "flex-start",
          paddingLeft: SAFE.side,
          paddingRight: SAFE.side,
          paddingBottom: SAFE.bottom,
          gap: px(spacing.tight),
        }}
      >
        <div style={tick}>
          <Tick>NOT WHAT YOU THINK</Tick>
        </div>
        {frame < swapAt ? (
          <HookLine text={hook.beatOne} delayFrames={LINE_IN} />
        ) : (
          // A cut, not a crossfade: the reversal is the point of the format and a dissolve
          // softens it into a transition. Mounting the second line here puts it on screen
          // already settled, because HookLine measures its entrance from the body's start and
          // that is long finished by the swap.
          <HookLine text={hook.beatTwo} delayFrames={LINE_IN} />
        )}
      </AbsoluteFill>
    </Stage>
  );
};

export const Reframe = ({ hook, cta }: { hook: ReframeHook; cta: Cta }) => (
  <PostShell cta={cta}>
    <Body hook={hook} />
  </PostShell>
);
