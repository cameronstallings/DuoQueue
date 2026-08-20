/**
 * Two seconds of ending. Not a card: the last shot is still there, frozen and thrown out of
 * focus, with the mark stamped over it. Cutting to a clean brand panel is the exact moment a
 * viewer files a video under advertising, and there is no reason to hand them that moment
 * when the footage can simply stay.
 *
 * The mark and the wordmark are the app's real ones (Mark.tsx draws from the same geometry
 * module the app draws from), because the identity being loose in this direction is about
 * the montage, not about pretending the app is called something else.
 */
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { clips } from "@/data/clips";
import { FONT_FAMILY } from "@/lib/fonts";
import { FPS } from "@/lib/scale";

import { BLOCK_INK, INK, VOLT } from "./palette";

export const END_BEAT_FRAMES = 66;

/** The frozen backdrop: the DUO LOCKED reveal a beat after the brackets close, held and
 * defocused. Taken from the reveal rather than from later in the same clip because at this
 * blur radius a face is a grey smudge, while the volt ring and the label are still shapes. */
const BACKDROP = { clip: "duo-locked" as const, at: 0.55 };

export const EndBeat = ({ cta }: { cta: Cta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stamp = spring({ frame, fps, config: { damping: 12, mass: 0.6, stiffness: 200 }, durationInFrames: 16 });
  const word = spring({ frame: frame - 3, fps, config: { damping: 14, mass: 0.6, stiffness: 190 }, durationInFrames: 16 });
  const pillWipe = interpolate(frame, [9, 15], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tail = interpolate(frame, [15, 21], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: BLOCK_INK, overflow: "hidden" }}>
      <Freeze frame={0}>
        <OffthreadVideo
          src={staticFile(`footage/${clips[BACKDROP.clip].file}`)}
          trimBefore={Math.round(BACKDROP.at * FPS)}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // Still drifting. Two seconds of a frozen frame under a frozen lockup is the one
            // place this direction could accidentally turn back into a title card.
            transform: `scale(${interpolate(frame, [0, END_BEAT_FRAMES], [1.3, 1.46])})`,
            filter: "blur(30px) brightness(0.46) saturate(0.9)",
          }}
        />
      </Freeze>
      <AbsoluteFill style={{ backgroundColor: "rgba(6,8,5,0.55)" }} />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: 34,
          paddingLeft: 96,
          paddingRight: 96,
          // Biased down out of the true centre so the stack sits between the middle of the
          // frame and the 18+ line instead of leaving a hole under itself.
          paddingTop: 150,
        }}
      >
        <div style={{ transform: `scale(${interpolate(stamp, [0, 1], [0.7, 1])})`, opacity: Math.min(stamp * 2, 1) }}>
          <Mark width={280} />
        </div>
        <div
          style={{
            fontFamily: FONT_FAMILY.displayBold,
            fontSize: 96,
            lineHeight: "112px",
            letterSpacing: "0.02em",
            color: INK,
            transform: `translateY(${interpolate(word, [0, 1], [26, 0])}px)`,
            opacity: Math.min(Math.max(word, 0) * 2, 1),
          }}
        >
          duoqueue
        </div>
        <div
          style={{
            marginTop: 10,
            backgroundColor: VOLT,
            color: BLOCK_INK,
            fontFamily: FONT_FAMILY.extrabold,
            fontSize: 56,
            lineHeight: "62px",
            letterSpacing: "-0.02em",
            padding: "18px 38px",
            borderRadius: 14,
            transform: "rotate(-1.2deg)",
            clipPath: `inset(0 ${pillWipe}% 0 0)`,
            boxShadow: "0 14px 40px rgba(0,0,0,0.5)",
          }}
        >
          {cta.line}
        </div>
        <div
          style={{
            fontFamily: FONT_FAMILY.monoSemibold,
            fontSize: 40,
            letterSpacing: "0.06em",
            color: INK,
            opacity: tail * 0.92,
            overflowWrap: "anywhere",
            textAlign: "center",
          }}
        >
          {cta.url}
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 176 }}>
        <div
          style={{
            fontFamily: FONT_FAMILY.mono,
            fontSize: 26,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: INK,
            opacity: tail * 0.55,
          }}
        >
          18+ / ios / us
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
