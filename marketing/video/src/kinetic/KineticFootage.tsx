/**
 * Footage as texture. Direction B's second half: the type does the talking and this proves it.
 *
 * Nothing here shows a screen recording the way the shipping formats do, with one exception
 * that is deliberate. `proof` runs the app clip nearly clean for a second and a bit, because a
 * video that never once shows the product is an art project. Every other treatment grades the
 * footage until it is a surface: greyscaled, crushed, duotoned into the accent, or reduced to
 * whatever shows through the letterforms.
 *
 * The gameplay clips are only ever used knocked out or duotoned. Another player's gamertag is
 * on screen in the source recording (see public/footage/README.md) and it must not be legible
 * in anything published. The centre crop of a 2560x1440 frame into 1080x1920 already loses the
 * kill feed; the grade finishes the job.
 *
 * Every layer moves. There is no static frame in the cut.
 */
import { AbsoluteFill, getStaticFiles, interpolate, OffthreadVideo, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { clips } from "@/data/clips";
import { FPS } from "@/lib/scale";
import type { ClipName } from "@/types";

import { K } from "./palette";
import type { Treatment } from "./beats";

const isPresent = (path: string): boolean =>
  getStaticFiles().some((asset) => asset.name === path);

/** Per treatment: the CSS filter on the video, an optional colour multiplied over it, and how
 * far the whole thing is sunk towards the field colour. Tuned against real frames, not by
 * arithmetic: `shadow` has to leave enough shape for the eye to read motion behind the type
 * and not one stop more. */
const GRADE: Record<
  Treatment,
  {
    /** Painted under the video, and all there is if the file is missing. */
    field: string;
    filter: string;
    /** How the video sits on the field. `multiply` is how the flooded beat keeps its colour
     * and still gets texture out of the footage. */
    videoBlend?: "multiply";
    videoAlpha?: number;
    /** Multiplied over the video, which is what makes a duotone. */
    tint?: string;
    tintAlpha?: number;
    /** Pulled back towards the field, so type stays the brightest thing in the frame. */
    sink: number;
    vignette: number;
  }
> = {
  // The blur on these two is not softness for its own sake. Ungraded app footage carries real
  // interface copy at 40px, and a frame with a legible sentence behind a huge headline reads
  // as two videos playing at once. Blurred, the same footage is colour and movement, which is
  // the only job it has in this direction. It is also what stops the frame going dead black
  // when the grade is crushed enough to kill that copy by brightness alone.
  shadow: {
    field: K.ink,
    filter: "grayscale(1) contrast(1.2) brightness(0.78) blur(9px)",
    tint: K.hot,
    tintAlpha: 0.32,
    sink: 0.36,
    vignette: 1,
  },
  duotone: {
    field: K.ink,
    filter: "grayscale(1) contrast(1.3) brightness(1.05) blur(13px)",
    tint: K.hot,
    tintAlpha: 1,
    sink: 0.4,
    vignette: 1,
  },
  flood: {
    field: K.hot,
    filter: "grayscale(1) contrast(1.25) brightness(1.2) blur(12px)",
    videoBlend: "multiply",
    videoAlpha: 0.42,
    sink: 0,
    vignette: 0.4,
  },
  // Sharp, bright, and no vignette at all. This plate is seen only through the letterforms,
  // so every value it loses is a letter that goes dim, and a vignette would take exactly the
  // ends of the words the eye reads last.
  knockout: {
    field: "#000000",
    filter: "grayscale(1) contrast(1.2) brightness(1.6)",
    sink: 0,
    vignette: 0,
  },
  proof: { field: K.ink, filter: "saturate(1.12) contrast(1.06)", sink: 0.08, vignette: 0.85 },
};

/**
 * A slow push in, a drift, and a two-pixel weave.
 *
 * The push is what stops a one-second beat over app footage reading as a still. The weave is
 * one frame of deterministic noise on each axis: far too small to notice as shake, big enough
 * that the frame is never twice in the same place, which is most of what separates footage
 * that looks handheld from footage that looks placed.
 */
const useCamera = (seed: string): string => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1]);

  // Enough headroom that the drift never exposes an edge.
  const start = 1.1 + random(`${seed}-z`) * 0.1;
  const scale = start + progress * 0.09;
  const driftX = (random(`${seed}-x`) - 0.5) * 70 * progress;
  const driftY = (random(`${seed}-y`) - 0.5) * 46 * progress;
  const weaveX = (random(`${seed}-w${String(frame)}`) - 0.5) * 3.5;
  const weaveY = (random(`${seed}-v${String(frame)}`) - 0.5) * 3.5;

  return `translate(${driftX + weaveX}px, ${driftY + weaveY}px) scale(${scale})`;
};

export const KineticFootage = ({
  clip,
  from,
  treatment,
  seed,
}: {
  clip: ClipName;
  from: number;
  treatment: Treatment;
  seed: string;
}) => {
  const entry = clips[clip];
  const path = `footage/${entry.file}`;
  const camera = useCamera(seed);
  const grade = GRADE[treatment];

  return (
    // isolate, so the tint multiplies against this footage and not against whatever the beat
    // painted underneath it.
    <AbsoluteFill style={{ backgroundColor: grade.field, isolation: "isolate", overflow: "hidden" }}>
      {isPresent(path) ? (
        <AbsoluteFill
          style={{
            transform: camera,
            mixBlendMode: grade.videoBlend,
            opacity: grade.videoAlpha,
          }}
        >
          {/* OffthreadVideo, not Video: the app clips are phone screen recordings and Remotion's
              own compositor decodes far more than Chromium's <video> does. trimBefore is where
              in the clip this beat starts, which is how two beats over one file are two
              different moments rather than the same second twice. */}
          <OffthreadVideo
            src={staticFile(path)}
            trimBefore={Math.round((entry.from + from) * FPS)}
            trimAfter={Math.round(entry.to * FPS)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: grade.filter }}
          />
        </AbsoluteFill>
      ) : null}

      {grade.tint ? (
        // multiply, so black stays black and every value above it takes the hue. That is a
        // duotone, and it is what turns a recognisable screen recording into a surface.
        <AbsoluteFill
          style={{
            backgroundColor: grade.tint,
            mixBlendMode: "multiply",
            opacity: grade.tintAlpha ?? 1,
          }}
        />
      ) : null}

      {grade.sink > 0 ? (
        <AbsoluteFill style={{ backgroundColor: K.ink, opacity: grade.sink }} />
      ) : null}

      {/* Vignette. Wide and shallow: it is here to hold the eye in the middle of the frame
          where the type is, not to announce itself. */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(125% 78% at 50% 44%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.72) 100%)`,
          opacity: grade.vignette,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Grain and a scanline, over everything.
 *
 * Far heavier than the app's 0.035 overlay. Grain is the cheapest signal there is that a frame
 * was photographed rather than composed, and clean gradients over flat colour are exactly what
 * a feed reads as an advert. The scanline is one pixel in four at 4% and is invisible as a
 * pattern; what it does is stop the flat vermillion floods from banding under H.264.
 */
export const KineticTexture = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("noise.png")})`,
        backgroundRepeat: "repeat",
        mixBlendMode: "overlay",
        opacity: 0.14,
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 4px)`,
      }}
    />
  </AbsoluteFill>
);
