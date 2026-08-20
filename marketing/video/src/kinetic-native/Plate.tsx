/**
 * Footage as surface, and the camera that carries the eye across every hard cut in the film.
 *
 * Nothing here shows a screen recording the way the shipping formats do, with one deliberate
 * exception: `proof` runs the app clip nearly clean for a second and a half, because a video
 * that never once shows the product is an art project. Every other treatment grades the
 * footage until it is texture: greyscaled, crushed, duotoned into the accent, or reduced to
 * whatever shows through the letterforms.
 *
 * THE CAMERA IS THE CARRIER. The type cuts on the waterfall, but the plate under it hard cuts,
 * and a hard cut between two still plates is a dead stop. So the camera runs at ONE constant
 * velocity for the whole film: it pans left at 4.4px per frame and pushes in at 0.0034 scale
 * per frame, every beat, without exception. At every cut the outgoing plate and the incoming
 * plate are travelling at the same speed in the same direction, which is the vector law
 * applied to a surface rather than to an element, and twelve seconds of it reads as one camera
 * move rather than as nine shots. Each beat re-centres its own pan around zero so the travel
 * never exposes an edge; the absolute position resets at the cut, the velocity does not.
 *
 * WHAT IS NOT HERE, and why. Direction B's camera added a per frame random weave on both axes
 * on top of a random drift, with a comment saying the frame is never twice in the same place.
 * That is the idle wobble the doctrine bans outright: motion with no destination, which reads
 * as the video waiting rather than as the video moving. A camera path with a mapped start and
 * end is a sustained motion route; a jitter is not.
 *
 * WHAT CHANGED AFTER THE FIRST RENDER. The rates above were 1.8px and 0.0018, and the frames
 * proved that a rule can be satisfied and the film still fail. Under two pixels a frame,
 * across a plate that is greyscaled, blurred to 9px and sunk to 36%, moves nothing a viewer
 * can see: there are no edges left in the image for the eye to track. Every beat of the first
 * render was pixel for pixel identical for between two thirds of a second and a second and a
 * quarter, and the film read as a stack of still cards joined by dissolves. The doctrine's
 * actual test is that pausing at any second finds something meaningful mid flight, so the
 * camera now moves at a rate that passes that test by eye rather than on paper.
 */
import {
  AbsoluteFill,
  getStaticFiles,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { clips } from "@/data/clips";
import { FPS } from "@/lib/scale";
import type { ClipName } from "@/types";

import { CAMERA, CURRENT, EASE } from "./motion";
import type { Treatment } from "./script";
import { K } from "./skin";

const isPresent = (path: string): boolean => getStaticFiles().some((asset) => asset.name === path);

/**
 * Per treatment: the CSS filter on the video, an optional colour multiplied over it, and how
 * far the whole thing is sunk towards the field. Tuned against real frames rather than by
 * arithmetic: `shadow` has to leave enough shape for the eye to read movement behind the type
 * and not one stop more.
 */
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
    /**
     * Overrides the camera's base scale for this grade only.
     *
     * The house base is 1.36, which is the headroom the pan and the push need, and for a
     * plate that is texture it does not matter what is cropped away. It matters exactly once.
     * The proof beat is the only second in the film where a viewer sees the product, and its
     * framing has two hard constraints rather than one: at 1.36 the crop threw away the lime
     * DUO LOCKED header, which is the piece of that frame that says what the screenshot is,
     * and anything under about 1.13 lets the recording's notification banner into the top of
     * the frame. 1.08 keeps the header well clear of the 72px mask that deals with the
     * banner, and the beat's camera is parked at local frame 12 so the whole path stays
     * inside that window. The pan and the push rate are unchanged, which is what the seam
     * cares about; only the framing and how long it travels for are.
     */
    camScale?: number;
  }
> = {
  // The blur on these two is not softness for its own sake. Ungraded app footage carries real
  // interface copy at 40px, and a frame with a legible sentence behind a huge headline reads
  // as two videos playing at once. Blurred, the same footage is colour and movement, which is
  // the only job it has here.
  shadow: {
    field: K.ink,
    // Blurred harder and sunk less than it was. More blur means the app's own hard edges
    // stop reading as horizontal bars behind the type; less sink means what is left of the
    // image has enough value in it for the camera move to be visible at all. The first
    // render had those two the wrong way round.
    filter: "grayscale(1) brightness(1.5) contrast(1.05) blur(20px)",
    tint: K.hot,
    tintAlpha: 0.34,
    sink: 0.3,
    vignette: 1,
  },
  duotone: {
    field: K.ink,
    filter: "grayscale(1) brightness(1.3) contrast(1.12) blur(18px)",
    tint: K.hot,
    tintAlpha: 1,
    sink: 0.3,
    vignette: 1,
  },
  flood: {
    field: K.hot,
    // The multiply is what gives a flat colour field its texture, and on the first render it
    // was doing far more than that: at 0.42 over a 0.4 vignette the vermillion came down to a
    // dark maroon in the middle of the frame, and NOT FACES is near black type, so the beat
    // ended up dark on dark. The whole point of a flood is that it is the brightest second in
    // the film. Half the multiply and almost no vignette.
    filter: "grayscale(1) contrast(1.2) brightness(1.34) blur(14px)",
    videoBlend: "multiply",
    videoAlpha: 0.22,
    sink: 0,
    vignette: 0.12,
  },
  // Sharp, no vignette at all. This plate is only ever seen through the letterforms, so
  // every value it loses is a letter that goes dim and a vignette would take exactly the ends
  // of the words the eye reads last.
  //
  // Brightness was 1.95, which was too far the other way: the footage clipped to near white
  // and the letters came out as flat bone with a faint dirty mottle in them, so the beat both
  // looked cheap and threw away the only reason to knock type out of footage. 1.28 with the
  // contrast lifted keeps the letters bright enough to read at thumbnail size and leaves the
  // gameplay in them actually visible, which is what makes those three beats move.
  knockout: {
    field: "#000000",
    filter: "grayscale(1) brightness(1.7) contrast(1.15)",
    sink: 0,
    vignette: 0,
  },
  proof: {
    field: K.ink,
    filter: "saturate(1.12) contrast(1.06)",
    sink: 0.08,
    vignette: 0.85,
    camScale: 1.08,
  },
};

/**
 * The camera path. Linear on both axes on purpose: constant velocity is what makes the speed
 * either side of a cut identical without having to match two curves against each other.
 *
 * `start` and `stop` park the camera outside a window, which two beats need. The proof beat
 * parks it early to buy the stillness before the climax, and the arrival beat parks it until
 * its retraction has settled, because a plate pushing in underneath a wrapper pulling back is
 * two opposite scale signs in one frame.
 */
const useCamera = (start: number, stop: number, base: number): string => {
  const frame = useCurrentFrame();
  const span = Math.max(1, stop - start);
  const progress = interpolate(frame, [start, stop], [0, 1], {
    easing: EASE.linear,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pan = CAMERA.pan * span;
  const push = CAMERA.push * span;
  // Centred on zero, so half the travel is spent either side of the beat's midpoint and the
  // base scale only has to cover half the pan rather than all of it.
  const x = -CURRENT * (pan / 2) + CURRENT * pan * progress;
  const scale = base - push / 2 + push * progress;

  return `translateX(${x.toFixed(2)}px) scale(${scale.toFixed(4)})`;
};

export const Plate = ({
  clip,
  from,
  treatment,
  camStart,
  camStop,
}: {
  clip: ClipName;
  from: number;
  treatment: Treatment;
  camStart?: number;
  camStop?: number;
}) => {
  const { durationInFrames } = useVideoConfig();
  const entry = clips[clip];
  const path = `footage/${entry.file}`;
  const grade = GRADE[treatment];
  const camera = useCamera(camStart ?? 0, camStop ?? durationInFrames, grade.camScale ?? CAMERA.base);

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
          {/* OffthreadVideo rather than Video: the app clips are phone screen recordings and
              Remotion's own compositor decodes far more than Chromium's <video> does.
              trimBefore is where in the clip this beat starts, which is how two beats over one
              file are two different moments rather than the same second twice. */}
          <OffthreadVideo
            src={staticFile(path)}
            trimBefore={Math.round((entry.from + from) * FPS)}
            trimAfter={Math.round(entry.to * FPS)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: grade.filter }}
          />
        </AbsoluteFill>
      ) : null}

      {grade.tint !== undefined ? (
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

      {/* Wide and shallow: it holds the eye in the middle of the frame where the type is, and
          it is not here to announce itself. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(125% 78% at 50% 44%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.72) 100%)",
          opacity: grade.vignette,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Grain and a scanline, over everything.
 *
 * Static, not animated: this is a surface, not motion, so it is not the idle wobble the
 * doctrine bans. Grain is the cheapest signal there is that a frame was photographed rather
 * than composed, and clean gradients over flat colour are exactly what a feed reads as an
 * advert. The scanline is one pixel in four at 4% and is invisible as a pattern; what it does
 * is stop the flat vermillion floods banding under H.264.
 */
export const Texture = () => (
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
        backgroundImage:
          "repeating-linear-gradient(to bottom, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 4px)",
      }}
    />
  </AbsoluteFill>
);
