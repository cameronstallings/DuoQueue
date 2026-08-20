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

import { CURRENT, CURVE, EASE, TRAVEL, WATERFALL_ENTRY } from "./motion";
import { Texture } from "./Plate";
import { K } from "./skin";
import { useDisplayFonts } from "./type-fit";

/** Re-exported, not defined here. The number moved to ./script when the audio path needed the
 * composition's length from a node script that cannot import this file. See it for why. */
export { END_FRAMES } from "./script";

const MARK_WIDTH = 250;
const WORDMARK = 152;

/**
 * The card's four events, and every gap between them is deliberate.
 *
 * The last version of these numbers left the card finished at local frame 30 of 36, and the
 * render bore it out: 20 of the 36 frames were pixel for pixel identical, in three blocks, the
 * longest of them 8 frames. A card that finishes six frames early reads as the film having
 * ended before it ended.
 *
 * A power4.out is 94% travelled at 60% of its duration, which is the thing the first attempt
 * at these numbers did not account for: the tweens were queued end to end against their stated
 * lengths and each one had gone visually still a third of its length before the next began.
 * Measured on that render the card still held four frozen frames between the seam and the
 * wipe and four more between the wipe and the URL.
 *
 * At 30 frames the job is now: arrive on the seam (0 to 10, settled by about 7), stamp the
 * call to action (8 to 19, settled by about 15), land the URL under it (15 to 23, settled by
 * about 20), then hold. Nothing waits for anything: the URL ignites while the slab is still
 * finishing, which is the same overlap rule the rail's cascade runs on.
 *
 * The ten frames of hold at the end are deliberate and they are not the same defect. A third
 * of a second is what the last thing a viewer reads costs to read, and a call to action that
 * is still moving when the file ends is one nobody can act on. Every other still frame in this
 * film is a bug; this one is the ending.
 */
const REVEAL_AT = CURVE.entry - 2;
/** Frames the call to action slab takes to wipe. */
const WIPE = 11;
/** Frames the URL takes to arrive. Longer than a rail word's, because it is the last thing
 * that moves and a snap would put the card at rest sooner. */
const URL_ENTRY = 8;

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

  // Ignited BEFORE the slab has finished its nominal wipe, not after it. The wipe is a
  // power4.out over 10 frames and it is 94% done by frame 6 of them, so queueing the URL
  // behind the tween's stated end put four frames of nothing between two events that should
  // overlap. The doctrine's word for the fix is the same one the rail's cascade uses: overlap,
  // do not queue.
  const urlAt = REVEAL_AT + WIPE - 4;
  const url = interpolate(frame, [urlAt, urlAt + URL_ENTRY], [0, 1], {
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
              transform: `translateY(${String(((1 - url) * WATERFALL_ENTRY.anchor.lift).toFixed(1))}px)`,
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
