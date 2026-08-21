/**
 * THE END CARD, on the light ground.
 *
 * This is the one thing Cameron has consistently said he likes, so the composition, the copy and
 * the choreography are the ones in src/kinetic-native/EndCard.tsx to the frame. Four events,
 * same numbers: arrive on the seam, stamp the call to action, land the URL under it, hold ten
 * frames. The URL still ignites four frames BEFORE the slab's nominal wipe ends, because a
 * power4.out is 94% travelled at 60% of its duration and queueing the two end to end put four
 * dead frames between them; that fix was measured on a render and it is carried over rather
 * than rediscovered.
 *
 * Two things are different and both are consequences of the ground.
 *
 * =====================================================================================
 * THERE IS NO CARD
 * =====================================================================================
 *
 * The kinetic-native card slides an opaque off-black field in from the right, which works
 * because the film behind it is also off-black. Sliding that field over a warm off-white would
 * be the only ground change in the film and it would arrive at 0.35 opacity, which on a pale
 * field reads as a grey wash fading up: a crossfade, which is the note Cameron gave about
 * direction B.
 *
 * So the ground simply continues and the LOCKUP is what arrives. The film holds one ground from
 * frame 1 to frame 377, which is what all three reference reels do and reference point 1 in
 * src/frag/ground.ts. The seam is unchanged: it enters from the right on the mirrored power4,
 * picking up the leftward current the body was still travelling on, and its contents ignite mid
 * path rather than fading up from nothing.
 *
 * =====================================================================================
 * THE ACCENT IS CHARTREUSE, NOT VERMILLION
 * =====================================================================================
 *
 * The kinetic-native skin picked #FF3B14 when the Volt constraint was lifted, and on that film
 * it was right because that film had no other colour in it. This one is ten seconds of app
 * fragments with chartreuse burning inside every one of them, and closing on a hot orange would
 * be a colour non sequitur on the last frame anybody remembers.
 *
 * It cannot be a chartreuse SLAB, though, and that is the same arithmetic the whole direction
 * rests on: #CDFF3D on this ground is about 1.4:1, so a filled chartreuse shape on warm
 * off-white has no edge and the button loses the thing a button is read by, which is its
 * silhouette. So the slab is the app's own off-black and the words on it are raw chartreuse,
 * at about 13:1.
 *
 * That inversion is also the film's thesis restated on its last frame: a dark object carrying
 * chartreuse, sitting on a light ground. The mark and the wordmark are the app's light-theme
 * ink, which is what the app itself draws them in on paper.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { CURRENT, CURVE, EASE, TRAVEL, WATERFALL_ENTRY } from "@/kinetic-native/motion";
import { useDisplayFonts } from "@/kinetic-native/type-fit";
import { FONT_FAMILY } from "@/lib/fonts";

import { GROUND, INK, STAGE_Y } from "./ground";

const MARK_WIDTH = 250;
const WORDMARK = 152;

/** The four events, in frames, unchanged from the card this is adapted from. */
const REVEAL_AT = CURVE.entry - 2;
const WIPE = 11;
const URL_ENTRY = 8;

export const FragEnd = ({ cta }: { cta: Cta }) => {
  const frame = useCurrentFrame();
  const loaded = useDisplayFonts();

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  // The incoming half of the cut: same distance and the mirrored ease of the exit that hands
  // over to it, so the lockup's initial velocity is the last beat's final velocity.
  const x = interpolate(frame, [0, CURVE.entry], [-CURRENT * TRAVEL, 0], {
    easing: EASE.power4Out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, CURVE.entry * 0.4], [CURVE.ignite, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wipe = interpolate(frame, [REVEAL_AT, REVEAL_AT + WIPE], [0, 1], {
    easing: EASE.power4Out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const urlAt = REVEAL_AT + WIPE - 4;
  const url = interpolate(frame, [urlAt, urlAt + URL_ENTRY], [0, 1], {
    easing: EASE.power4Out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ transform: `translateX(${x.toFixed(2)}px)`, opacity }}>
      <AbsoluteFill
        style={{
          alignItems: "center",
          // The lockup's optical centre lands on STAGE_Y, which is where every object in the
          // body landed. It is not the frame's true centre and it is not avoiding anything;
          // it is the brand arriving in the place the product just vacated.
          justifyContent: "center",
          paddingTop: (STAGE_Y - 960) * 2,
          paddingLeft: 72,
          paddingRight: 72,
          gap: 40,
        }}
      >
        <Mark width={MARK_WIDTH} tone="light" />

        <div
          style={{
            fontFamily: FONT_FAMILY.displayBold,
            fontSize: `${String(WORDMARK)}px`,
            lineHeight: `${String(Math.round(WORDMARK * 1.16))}px`,
            letterSpacing: `${String(WORDMARK * 0.02)}px`,
            color: INK.type,
          }}
        >
          duoqueue
        </div>

        {/* The call to action as a filled slab rather than a line of text: on a feed the shape
            of a button is read before the words in it are. Off-black fill, chartreuse words. */}
        <div style={{ position: "relative", marginTop: 26, padding: "22px 42px" }}>
          <AbsoluteFill
            style={{
              backgroundColor: INK.slab,
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
              color: INK.brand,
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
            color: INK.type,
            opacity: frame >= urlAt ? 1 : 0,
            transform: `translateY(${String(((1 - url) * WATERFALL_ENTRY.anchor.lift).toFixed(1))}px)`,
          }}
        >
          {cta.url}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
