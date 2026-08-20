/**
 * The one branded second.
 *
 * Everything before this frame is deliberately unbranded: no lockup in the corner, no
 * graticule, no tick, nothing that says a company made it. That is the whole bet of this
 * direction, and it only pays off if the last beat is unmissable, so the mark arrives alone
 * on black, springs in, and holds for a second and a half.
 *
 * It is also the frame that has to survive being a cover image, which is why the CTA is one
 * line of the same caption face the rest of the video uses and the URL is in the highlighter.
 */
import type { ReactNode } from "react";

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Lockup } from "@/components/Lockup";
import type { Cta } from "@/config/phase";

import { ACCENT, ACCENT_INK, BACKDROP, CAPTION, EDGE, FACE, INK } from "./look";

/** 1.7 seconds. Long enough to read a name and a URL, short enough that nobody scrolls
 * because of it. */
export const NATIVE_END_FRAMES = 51;

/** Bigger than the shipping end card's 420, because this one has no graticule, no grain and no
 * tick around it: on a black frame the mark has to be the thing that is loud. */
const LOCKUP_WIDTH = 580;

const Pop = ({ delay, children }: { delay: number; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ fps, frame: frame - delay, config: { damping: 12, stiffness: 220, mass: 0.7 } });
  return (
    <div
      style={{
        transform: `scale(${(0.7 + 0.3 * pop).toFixed(4)})`,
        opacity: interpolate(pop, [0, 0.3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      {children}
    </div>
  );
};

/** The caption face, edged the same way the captions are, so the last line of the video is
 * clearly the same voice as the first. */
const Edged = ({ text, size }: { text: string; size: number }) => {
  const glyphs = {
    fontFamily: FACE,
    fontSize: `${size}px`,
    lineHeight: `${size * CAPTION.leading}px`,
    letterSpacing: "-0.015em",
    whiteSpace: "nowrap" as const,
  };
  return (
    <span style={{ position: "relative", display: "inline-block", ...glyphs }}>
      <span
        aria-hidden
        style={{
          ...glyphs,
          display: "block",
          color: EDGE,
          WebkitTextStroke: `${(size * CAPTION.outline).toFixed(2)}px ${EDGE}`,
        }}
      >
        {text}
      </span>
      <span
        style={{
          ...glyphs,
          display: "block",
          position: "absolute",
          left: 0,
          top: 0,
          color: INK,
          WebkitTextStroke: `${(size * CAPTION.weightBoost).toFixed(2)}px ${INK}`,
        }}
      >
        {text}
      </span>
    </span>
  );
};

export const NativeEndCard = ({ cta }: { cta: Cta }) => (
  <AbsoluteFill
    style={{
      backgroundColor: BACKDROP,
      alignItems: "center",
      justifyContent: "center",
      gap: 64,
      // Sits above the platform chrome for the same reason the captions do.
      paddingBottom: 220,
    }}
  >
    <Pop delay={0}>
      <Lockup width={LOCKUP_WIDTH} />
    </Pop>
    <Pop delay={6}>
      <Edged text={cta.line} size={78} />
    </Pop>
    <Pop delay={11}>
      <div
        style={{
          backgroundColor: ACCENT,
          color: ACCENT_INK,
          fontFamily: FACE,
          fontSize: "62px",
          lineHeight: "62px",
          letterSpacing: "-0.01em",
          padding: "22px 34px 30px",
          borderRadius: 18,
          maxWidth: 880,
          textAlign: "center",
          // A store URL has nothing a browser will break on. Two lines inside the highlighter
          // is not pretty; a URL running off the frame is worse.
          overflowWrap: "anywhere",
        }}
      >
        {cta.url}
      </div>
    </Pop>
  </AbsoluteFill>
);
