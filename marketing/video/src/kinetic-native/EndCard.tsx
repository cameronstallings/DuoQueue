/**
 * Where the brand is spent, and the last seam in the film.
 *
 * The body of this direction carries no mark, no wordmark, no corner handle and not one app
 * colour, which is the whole argument: brand furniture in every frame is what a feed reads as
 * an advert. So all of it arrives at once, in the last two seconds, on the frame whose only
 * job is to be remembered. The mark is the real one, drawn from the geometry module the app
 * itself draws from, and the call to action is the same value the shipping end card gets.
 *
 * THE SEAM. The payoff beat accelerates LEFT and dies mid motion; this card picks the same
 * direction up mid path, entering from the right at 0.35 opacity on the mirrored ease. That is
 * technique 3, cut the curve, the film's default boundary and its current, returned to
 * immediately after the one reserved vector was spent on the arrival before it.
 *
 * The card arrives COMPOSED inside that sliding wrapper rather than assembling itself under
 * it. A second entrance layered on a seam entrance is two arrivals at one boundary and the
 * eye reads the second one as the real cut. What it does instead is keep performing after it
 * lands: the call to action slab wipes in and the URL arrives under it on a technique 6
 * cascade, which is a staged reveal rather than a wobble.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { FONT_FAMILY } from "@/lib/fonts";

import { CURRENT, CURVE, EASE, sec, TRAVEL, WATERFALL_ENTRY } from "./motion";
import { Texture } from "./Plate";
import { K } from "./skin";
import { useDisplayFonts } from "./type-fit";

/**
 * 1.7 seconds, down from 2.2.
 *
 * The staged reveal on this card used to finish at local frame 20 and the card then held,
 * unchanged, for the remaining 46 frames. A second and a half of a frozen frame is the last
 * thing a viewer sees and it is the clearest possible signal that the video has finished
 * before it has ended. The reveals are now spread to land at frame 33 and the card is 51
 * frames long, so what is left is 0.6s of hold on the call to action, which is an ending
 * rather than a wait.
 */
export const END_FRAMES = Math.round(sec(1.7));

const MARK_WIDTH = 250;
const WORDMARK = 152;

/** Local frame the staged reveal begins, which is after the seam entry has settled. */
const REVEAL_AT = CURVE.entry + 5;
/** Frames the call to action slab takes to wipe. */
const WIPE = 9;

export const EndCard = ({ cta }: { cta: Cta }) => {
  const frame = useCurrentFrame();
  const loaded = useDisplayFonts();

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: K.ink }} />;
  }

  // The incoming half of the cut. Same distance and the mirrored ease of the exit that hands
  // off to it, so the card's initial velocity is the payoff block's final velocity.
  const x = interpolate(frame, [0, CURVE.entry], [-CURRENT * TRAVEL, 0], {
    easing: EASE.power4Out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Ignites at 0.35 mid path rather than fading up from nothing.
  const opacity = interpolate(frame, [0, CURVE.entry * 0.4], [CURVE.ignite, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wipe = interpolate(frame, [REVEAL_AT, REVEAL_AT + WIPE], [0, 1], {
    easing: EASE.power4Out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const urlAt = REVEAL_AT + WIPE + WATERFALL_ENTRY.gap * 2;
  const url = interpolate(frame, [urlAt, urlAt + WATERFALL_ENTRY.normal.frames], [0, 1], {
    easing: EASE.power4Out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    // The stage ground is painted by the composition behind this, so the card sliding in from
    // the right never opens a summed-opacity gap onto white.
    <AbsoluteFill style={{ transform: `translateX(${x.toFixed(2)}px)`, opacity }}>
      <AbsoluteFill style={{ backgroundColor: K.ink }}>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: 72,
            paddingRight: 72,
            // No lift. It used to carry 90px of bottom padding, which put the lockup's
            // optical centre at about 900 with a visibly deeper margin under it than over
            // it, and the card read as laid out for a different aspect ratio. The rail does
            // not run over the end card, so there is nothing here for a keep out band to
            // avoid and the captions doctrine's true centre is simply correct: y = 960.
            paddingBottom: 0,
            gap: 40,
          }}
        >
          <Mark width={MARK_WIDTH} />

          <div
            style={{
              fontFamily: FONT_FAMILY.displayBold,
              fontSize: `${String(WORDMARK)}px`,
              lineHeight: `${String(Math.round(WORDMARK * 1.16))}px`,
              letterSpacing: `${String(WORDMARK * 0.02)}px`,
              color: K.bone,
            }}
          >
            duoqueue
          </div>

          {/* The call to action as a filled slab rather than a line of text: on a feed the
              shape of a button is read before the words in it are. */}
          <div style={{ position: "relative", marginTop: 26, padding: "22px 42px" }}>
            <AbsoluteFill
              style={{
                backgroundColor: K.hot,
                transformOrigin: "0% 50%",
                transform: `scaleX(${wipe.toFixed(4)})`,
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
                opacity: wipe > 0.6 ? 1 : 0,
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
              opacity: frame >= urlAt ? 1 : 0,
              transform: `translateY(${String(((1 - url) * WATERFALL_ENTRY.normal.lift).toFixed(1))}px)`,
            }}
          >
            {cta.url}
          </div>
        </AbsoluteFill>

        <Texture />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
