/**
 * One beat: a graded plate, a statement over it, and a hard cut in and out of both.
 *
 * There is no transition anywhere in this direction. Every beat is its own Sequence, so the
 * footage and the type change on the same frame and nothing dissolves. A crossfade is the
 * single most reliable way to make eleven seconds look like an advert, and the shipping
 * formats' one soft swap is most of why the current output reads the way it does.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { FONT_FAMILY } from "@/lib/fonts";
import { VIDEO_H, VIDEO_W } from "@/lib/scale";

import type { Beat } from "./beats";
import { KineticFootage, KineticTexture } from "./KineticFootage";
import { KineticWords } from "./KineticWords";
import { K, KSAFE } from "./palette";
import { fitStack, useKineticFonts } from "./type-fit";

const BOX_W = VIDEO_W - KSAFE.side * 2;
const BOX_H = VIDEO_H - KSAFE.top - KSAFE.bottom;

/** Ceiling on any one line. A three-letter line fitted to 936px wants about 500px of type,
 * which is a slab rather than a word and leaves nothing for the lines under it. */
const CAP = 420;

const JUSTIFY = { high: "flex-start", mid: "center", low: "flex-end" } as const;

/** How much of a knockout letter is footage rather than flat bone. See the note at the
 * knockout branch below: this number is the floor that keeps a word legible over a dark plate. */
const KNOCKOUT_TEXTURE = 0.62;

/** Peak opacity of the two-frame flash at a cut. Deliberately well short of a white-out: at
 * 0.9 the flooded beat opened on a completely blown frame, which at thumbnail size reads as a
 * dropped frame rather than as an impact, and a full-frame luminance jump repeated through a
 * cut is worth being careful with for its own sake. At 0.35 it is a hit and not a wash. */
const FLASH_PEAK = 0.35;

/** The type block for a beat, positioned and tilted, with its optional mono footnote. Kept
 * separate from the plate because `knockout` has to render this same block inside a
 * multiplying layer and every other treatment renders it on top of one. */
const Statement = ({ beat, seed, ink }: { beat: Beat; seed: string; ink: "bone" | "ink" }) => {
  const frame = useCurrentFrame();
  const sizes = fitStack({
    lines: beat.lines.map((line) => line.toUpperCase()),
    width: BOX_W,
    height: BOX_H,
    cap: CAP,
  });

  // The block itself settles as well as the words in it, which reads as the camera arriving
  // rather than as the text arriving. Six frames, and it is over before the last word lands.
  const settle = interpolate(frame, [0, 7], [1.035, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The footnote is the machine voice, and it arrives after the statement it annotates.
  const noteIn = interpolate(frame, [10, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        paddingLeft: KSAFE.side,
        paddingRight: KSAFE.side,
        paddingTop: KSAFE.top,
        paddingBottom: KSAFE.bottom,
        display: "flex",
        flexDirection: "column",
        justifyContent: JUSTIFY[beat.anchor ?? "mid"],
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          transform: `rotate(${beat.tilt ?? 0}deg) scale(${settle})`,
          transformOrigin: beat.align === "center" ? "50% 50%" : "0% 50%",
        }}
      >
        <KineticWords
          lines={beat.lines}
          sizes={sizes}
          accent={beat.accent}
          slab={beat.slab}
          align={beat.align}
          ink={ink}
          accentInk={ink === "ink" ? "ink" : "hot"}
          landed={beat.openLanded}
          seed={seed}
        />
        {beat.note ? (
          <div
            style={{
              marginTop: 28,
              fontFamily: FONT_FAMILY.monoSemibold,
              fontSize: 34,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: ink === "ink" ? K.onHot : K.hot,
              opacity: noteIn,
              transform: `translateY(${(1 - noteIn) * 14}px)`,
              textAlign: beat.align ?? "left",
            }}
          >
            {beat.note}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const KineticBeat = ({ beat, index }: { beat: Beat; index: number }) => {
  const loaded = useKineticFonts();
  const frame = useCurrentFrame();
  const seed = `beat-${String(index)}`;

  // Nothing measures or paints until the faces are in. A frame captured before then would be
  // typeset in Chromium's fallback sans and nothing downstream would report it.
  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: K.ink }} />;
  }

  const flashFrames = beat.flash ?? 0;
  const flash = interpolate(frame, [0, Math.max(1, flashFrames)], [FLASH_PEAK, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const plate = <KineticFootage clip={beat.clip} from={beat.clipFrom} treatment={beat.treatment} seed={seed} />;

  return (
    <AbsoluteFill style={{ backgroundColor: beat.treatment === "flood" ? K.hot : K.ink }}>
      {beat.treatment === "knockout" ? (
        // The letterforms are the window, and the whole effect is one blend mode: bone type on
        // a black field, with the plate multiplied over the lot. Black stays black outside the
        // words; inside them the bone is scaled by the footage, so the footage is visible only
        // where a letter is. No mask, no SVG, no second copy of the font.
        //
        // The opacity on that multiply is what makes it survive real material. A gameplay
        // frame can be a dark corridor, and a straight multiply against it produced letters
        // that were black on black: the first render of this beat had a word missing entirely.
        // At 0.62 the letters never fall below 38 percent of bone however dark the plate goes,
        // and the footage still reads clearly inside them.
        <AbsoluteFill style={{ isolation: "isolate", backgroundColor: "#000" }}>
          <Statement beat={beat} seed={seed} ink="bone" />
          <AbsoluteFill style={{ mixBlendMode: "multiply", opacity: KNOCKOUT_TEXTURE }}>
            {plate}
          </AbsoluteFill>
        </AbsoluteFill>
      ) : (
        <>
          {plate}
          {/* The one treatment that shows the app plainly still needs its bottom third held
              down, because the type sits there and the footage under it is a bright UI. */}
          {beat.treatment === "proof" ? (
            <AbsoluteFill
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(8,7,10,0) 33%, rgba(8,7,10,0.94) 88%)`,
              }}
            />
          ) : null}
          <Statement beat={beat} seed={seed} ink={beat.treatment === "flood" ? "ink" : "bone"} />
        </>
      )}

      {flashFrames > 0 ? (
        // Two or three frames at the cut. On a dark beat it is the accent and reads as impact;
        // on the flooded beat it is bone, because a vermillion flash over vermillion is
        // nothing at all.
        <AbsoluteFill
          style={{
            backgroundColor: beat.treatment === "flood" ? K.bone : K.hot,
            opacity: flash,
            mixBlendMode: "screen",
          }}
        />
      ) : null}

      <KineticTexture />
    </AbsoluteFill>
  );
};
