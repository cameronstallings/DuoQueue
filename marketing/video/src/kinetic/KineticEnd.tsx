/**
 * Where the brand is spent.
 *
 * The body of this direction does not carry a mark, a wordmark, a corner handle or a single
 * app colour, which is the whole argument: brand furniture in every frame is what a feed reads
 * as an advert. So all of it arrives at once, in the last two seconds, on the frame whose only
 * job is to be remembered. The mark is the real one, drawn from the same geometry module the
 * app draws from, and the call to action is the same value the shipping end card gets.
 *
 * It still moves. Everything snaps in, the slab wipes, and there is an accent flash on the cut.
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { FONT_FAMILY } from "@/lib/fonts";

import { KineticTexture } from "./KineticFootage";
import { K, KSAFE } from "./palette";
import { useKineticFonts } from "./type-fit";

/** 2.2 seconds. Long enough to read a wordmark and a URL, short enough that it is not the
 * reason anyone scrolls. */
export const KINETIC_END_FRAMES = 66;

const MARK_WIDTH = 250;
const WORDMARK = 152;

/** Overshooting spring, the same family the words use, so the card belongs to the cut it ends
 * rather than looking bolted on. */
const useSnap = (delay: number): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    fps,
    frame: frame - delay,
    config: { damping: 11, mass: 0.5, stiffness: 200 },
  });
};

export const KineticEnd = ({ cta }: { cta: Cta }) => {
  const frame = useCurrentFrame();
  const loaded = useKineticFonts();

  const mark = useSnap(0);
  const word = useSnap(3);
  const slab = useSnap(9);
  const url = useSnap(14);

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: K.ink }} />;
  }

  const wipe = interpolate(slab, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  // Vermillion rather than bone. Screening bone over a near-black card produced three frames
  // of flat mid grey, which at thumbnail size reads as a render fault; the accent reads as the
  // brand arriving.
  const flash = interpolate(frame, [0, 3], [0.35, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: K.ink }}>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: KSAFE.side,
          paddingRight: KSAFE.side,
          // Lifted off centre by roughly half the platform's bottom furniture, so the card is
          // not sitting behind a caption and a sound title.
          paddingBottom: 90,
          gap: 34,
        }}
      >
        <div
          style={{
            opacity: interpolate(mark, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
            transform: `scale(${interpolate(mark, [0, 1], [0.6, 1])}) rotate(${interpolate(mark, [0, 1], [-7, 0])}deg)`,
          }}
        >
          <Mark width={MARK_WIDTH} />
        </div>

        <div
          style={{
            fontFamily: FONT_FAMILY.displayBold,
            fontSize: `${WORDMARK}px`,
            lineHeight: `${Math.round(WORDMARK * 1.16)}px`,
            letterSpacing: `${WORDMARK * 0.02}px`,
            color: K.bone,
            opacity: interpolate(word, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
            transform: `scale(${interpolate(word, [0, 1], [0.72, 1])})`,
          }}
        >
          duoqueue
        </div>

        {/* The call to action as a filled slab rather than a line of text: on a feed the shape
            of a button is read before the words in it are. */}
        <div style={{ position: "relative", marginTop: 26, padding: "22px 42px" }}>
          <AbsoluteFill
            style={{
              backgroundColor: K.hot,
              transformOrigin: "0% 50%",
              transform: `scaleX(${wipe})`,
            }}
          />
          <div
            style={{
              position: "relative",
              fontFamily: FONT_FAMILY.extrabold,
              fontSize: "68px",
              lineHeight: "78px",
              letterSpacing: "-0.02em",
              color: K.onHot,
              opacity: wipe > 0.55 ? 1 : 0,
            }}
          >
            {cta.line}
          </div>
        </div>

        <div
          style={{
            fontFamily: FONT_FAMILY.monoSemibold,
            fontSize: "44px",
            letterSpacing: "0.12em",
            color: K.bone,
            opacity: interpolate(url, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(url, [0, 1], [16, 0])}px)`,
          }}
        >
          {cta.url}
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{ backgroundColor: K.hot, opacity: flash, mixBlendMode: "screen" }}
      />
      <KineticTexture />
    </AbsoluteFill>
  );
};
