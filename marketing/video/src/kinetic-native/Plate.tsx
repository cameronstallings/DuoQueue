/**
 * The footage layer, and the camera that carries the eye across every hard cut in the film.
 *
 * =====================================================================================
 * THE SECOND CUT INVERTED THIS FILE'S ARGUMENT
 * =====================================================================================
 *
 * The first version of this file said footage was surface: greyscaled, blurred to 20px, sunk
 * 30% under a vignette, duotoned into the accent, or reduced to whatever showed through the
 * letterforms. There was one exception, a single beat that ran an app clip nearly clean.
 *
 * Cameron's note on that render was that it loses the gamer read entirely, and he is right.
 * The audience for this app plays games, the footage is the only thing in the first second
 * that says the video is for them, and greyscale blurred to 20px says nothing at all. The
 * argument for treating footage as texture was that the app's own interface copy competes with
 * a headline, which is TRUE OF THE APP CLIPS and not true of gameplay: a firefight has no
 * sentences in it to compete with.
 *
 * So the grades below are inverted. `live` is the default and it is gameplay in colour, sharp,
 * full bleed, at full brightness, with a scrim UNDER THE TYPE rather than over the picture.
 * `app` is the product graded almost not at all, and the type moves out of its way instead.
 * `flood` is the one beat that is not photographic at all, and it is unchanged, because a flat
 * vermillion field between two photographic beats is what stops the film reading as a
 * slideshow of footage.
 *
 * THE SCRIM IS THE WHOLE TRICK. Legibility over live footage can be bought two ways: sink the
 * picture until nothing competes, or darken only the part of the frame the type occupies. The
 * first is what the last cut did and it costs the picture. The second costs nothing a viewer
 * notices, because a gradient with no visible edge in it does not read as a graphic. Every
 * scrim here is shaped to the beat's `anchor`, so the gameplay beats keep clean footage at the
 * top and bottom of the frame and the app beats keep the product's half of the screen clean.
 *
 * THE CAMERA IS THE CARRIER. The type cuts on the waterfall, but the plate under it hard cuts,
 * and a hard cut between two still plates is a dead stop. So the camera runs at ONE constant
 * velocity for the whole film: it pans left at 4.4px per frame and pushes in at 0.0034 scale
 * per frame, and NO BEAT EVER PARKS IT. At every cut the outgoing plate and the incoming plate
 * are travelling at the same rate in the same direction, which is the vector law applied to a
 * surface rather than to an element. Each beat re-centres its own pan around zero so the travel
 * never exposes an edge; the absolute position resets at the cut, the velocity does not.
 *
 * THE PORTRAIT PROBLEM, and what the last cut got wrong about it. A phone screen recording
 * covers a 1080 wide box at exactly 1080. There is no horizontal headroom for a pan to move
 * into, and the answer used to be to park the camera twelve frames in and let the app's own
 * animation own the rest of the beat. Measured on the render, that left the deck beat frozen
 * for its last twenty three frames and STOPPED at the cut out of it: half a second of decay
 * into a still frame, four literally identical frames inside it, and then a hard cut with
 * nothing moving on either side. That is a slideshow seam, and it is the one thing this file
 * exists to prevent.
 *
 * So a portrait plate gets the same camera with the pan taken out. A push needs no headroom at
 * all, because the plate only ever grows: x stays at zero, the scale never goes under its base,
 * and no edge can reach the frame at any point of any beat. The plate moves for every frame it
 * is on screen and is still moving at the cut, in the same Z direction as the live plate either
 * side of it. The x half of the seam is carried by the words, which is where this direction's
 * current has always lived. See `camera` in the grade table below.
 *
 * What differs per treatment is the camera MODE, the BASE SCALE, the vertical LIFT and how long
 * the camera travels for, never the rate. Those are framing decisions and the seam does not
 * care about them.
 *
 * WHAT IS NOT HERE, and why. Direction B's camera added a per frame random weave on both axes
 * on top of a random drift, with a comment saying the frame is never twice in the same place.
 * That is the idle wobble the doctrine bans outright: motion with no destination, which reads
 * as the video waiting rather than as the video moving. A camera path with a mapped start and
 * end is a sustained motion route; a jitter is not.
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
import { alpha } from "@/lib/color";
import { FPS, VIDEO_W } from "@/lib/scale";
import type { ClipName } from "@/types";

import { CAMERA, CURRENT, EASE } from "./motion";
import type { Anchor, Treatment } from "./script";
import { K } from "./skin";

const isPresent = (path: string): boolean => getStaticFiles().some((asset) => asset.name === path);

/** Half the frame width, which is where a centred transform origin sits. */
const HALF_W = VIDEO_W / 2;

/**
 * Per treatment: the CSS filter on the video, how far it is sunk towards the field, and what
 * the camera's base scale is. Tuned against real frames rather than by arithmetic.
 */
const GRADE: Record<
  Treatment,
  {
    /** Painted under the video, and all there is if the file is missing. */
    field: string;
    /**
     * How the camera moves on this surface, and it is a property of the FOOTAGE rather than a
     * choice.
     *
     * `pan` is the film's camera: leftward at CAMERA.pan and pushing in at CAMERA.push, both
     * centred on the beat's midpoint. It needs horizontal headroom, and a landscape source
     * cropped into a vertical frame has plenty.
     *
     * `push` is the same camera with the pan taken out, and it exists because a portrait
     * screen recording has NO horizontal headroom at all: it covers a 1080 wide box at exactly
     * 1080, so every pixel of pan exposes the field behind it. The old answer was to park the
     * camera after twelve frames, and that answer is what this cut is fixing: parking it left
     * the plate frozen for the last three quarters of every app beat and STOPPED at the cut
     * out of it. A stopped outgoing plate under a hard cut is the dead beat the doctrine names,
     * and it is exactly what the review found at 3.43s: half a second of decay into a still
     * frame, then a seam with nothing moving on either side of it.
     *
     * A push needs no headroom, because the plate only ever grows: x stays at zero and the
     * scale never goes under the base. So the app plate now moves for every frame of its beat
     * and is still moving at the cut, and the Z sign it is moving in is the same one the live
     * plate either side of it is moving in, which is the part of the vector law a surface can
     * actually satisfy here. The x half of the seam is carried by the words, which is where
     * this direction's current has always lived.
     */
    camera: "pan" | "push";
    filter: string;
    /** How the video sits on the field. `multiply` is how the flooded beat keeps its colour
     * and still gets texture out of the footage. */
    videoBlend?: "multiply";
    videoAlpha?: number;
    /** Pulled back towards the field. On `live` this is the ONLY uniform darkening in the
     * frame and it is deliberately shallow; the scrim does the rest, where the type is. */
    sink: number;
    vignette: number;
    /**
     * The camera's base scale for this grade, which is what decides the CROP: the visible
     * source width is 810/scale for a landscape clip and the whole frame width for a portrait
     * one, whatever `boxWidth` below is set to.
     *
     * On `live` it is a framing decision, and the number is where the game's own HUD leaves
     * the frame; see the value and `lift` for the measurements. On `app` it is the FLOOR of a
     * push rather than the midpoint of a pan, because that treatment has no pan: 1.10 is where
     * the plate starts and every other number measured against an app screen in this file, the
     * notification mask and both anchored scrims, is measured at it.
     */
    camScale: number;
    /**
     * The width of the box the video is laid out in, BEFORE the camera transform, and it is
     * the fix for the one real bug the first render of this cut had: black bars down the sides
     * of every gameplay beat.
     *
     * The mechanism is worth writing down because it is not obvious. `objectFit: cover` crops
     * the source to its LAYOUT BOX, and the camera then scales and pans that box. So the pan
     * has only whatever headroom the scale bought it, which is (boxWidth * scale - 1080) / 2,
     * and a 70 frame beat pans 4.4 * 70 = 308px, needing 154 of them. At a base of 1.14 the
     * box gives 11px at the start of the push and the plate's own edge slides into frame.
     *
     * Raising the base until the sum works is one answer and it is the wrong one for landscape
     * footage: it costs crop, and a 2560x1440 gameplay frame is already down to a quarter of
     * its width in a vertical video. Widening the LAYOUT BOX instead costs nothing at all,
     * because the visible source width works out to 810/scale whatever the box is: the box only
     * ever decides how much is held in reserve for the pan. 1520 holds 236px in reserve on the
     * longest beat, against the 154 it needs.
     *
     * It only helps a landscape source. A portrait screen recording covers a 1080 wide box at
     * exactly 1080, so widening the box crops MORE of the phone rather than less, which is why
     * both other treatments leave it at the frame width and park their camera instead.
     */
    boxWidth: number;
    /**
     * Composition pixels the plate is lifted, which crops that much more off the top of the
     * source and lets that much more of the bottom in.
     *
     * One object again, and it is the gameplay's own HUD. Valorant prints its event banners
     * ("SPIKE CARRIER KILLED", "SPIKE PLANTED") across the top centre of the frame at about
     * y=160 to 240 of a 1440 tall capture, and the vertical crop at this scale starts at about
     * y=206: the banner arrives cut in half along the top edge of the video, in a red within a
     * few degrees of the brand accent, during the hook. A whole HUD reads as gameplay and a
     * chopped one reads as a framing mistake.
     *
     * The numbers are measured off the capture with a 20 row grid rather than estimated: the
     * banner occupies source rows 186 to 236, and the ability row along the bottom starts at
     * about 1300. So the clean window is 1050 rows, the crop window is 1440/scale rows, and
     * BOTH can be excluded as long as the scale never drops under 1.371. That is what set
     * camScale below: 1.50 leaves the longest live beat at 1.381 at the loosest point of its
     * push, which is a 1043 row window, and 92px of lift centres that window on the clean
     * band. Measured at the extremes of both live beats the crop runs from source y 248 to
     * 1291 at worst, so nothing of either HUD reaches the frame.
     *
     * The first attempt at this used 150px against a base of 1.45, which is what happens when
     * the banner's extent is estimated from a thumbnail instead of measured: it cleared a
     * banner 80 rows higher than the real one and let the bottom quarter of the real one sit
     * on the top edge anyway.
     */
    lift?: number;
    /**
     * Masks the top of the frame to the field.
     *
     * Aimed at one object. The app recording carries an iOS notification banner reading "You
     * matched with Marcus." across its top edge for most of its length, and the framing cuts it
     * in half, so an unmasked app beat opens on a chopped grey bar with half a sentence in it.
     * There is no toast free window long enough to hold a beat, so it is masked.
     *
     * It also keeps the word "matched" off screen, which matters beyond tidiness: this is a
     * platonic app and the one frame where a viewer reads the real interface is not the frame
     * to hand them dating vocabulary.
     */
    topMask?: number;
  }
> = {
  // Nothing removed and nothing softened. The saturation and contrast are a grade, not a
  // treatment: they make a compressed screen capture look photographed rather than screenshot.
  live: {
    field: K.ink,
    filter: "saturate(1.08) contrast(1.05)",
    // Shallow on purpose. This is the darkening that applies to the WHOLE frame, including the
    // top and bottom where there is no type, so it is the number that decides whether a viewer
    // reads the picture as gameplay or as a wash. The first cut had it at 0.30 on top of a
    // greyscale and a 20px blur.
    sink: 0.16,
    vignette: 0.6,
    camera: "pan",
    // Scale and lift are one decision and they are solved together: scale sets how many of the
    // capture's 1440 rows the frame holds, the lift sets WHICH rows. 1.50 is the smallest base
    // whose loosest push still fits the 1050 clean rows between the two HUDs, and every pixel
    // over it is crop spent for nothing. See `lift` for the measurements.
    camScale: 1.5,
    boxWidth: 1520,
    lift: 92,
  },
  // The product, and the least graded thing in the film. A screen recording of a dark UI needs
  // no help; every stop taken off it here is a stop of the thing the video is selling.
  app: {
    field: K.ink,
    filter: "saturate(1.06) contrast(1.03)",
    sink: 0.04,
    vignette: 0.5,
    // No pan, so this is a floor rather than a midpoint: the plate starts here and grows.
    // 1.1 is what the notification mask below and both app scrims are measured against.
    camera: "push",
    camScale: 1.1,
    boxWidth: VIDEO_W,
    topMask: 76,
  },
  flood: {
    field: K.hot,
    // The multiply is what gives a flat colour field its texture. Half strength and almost no
    // vignette: the point of a flood is that it is the brightest second in the film, and NOT
    // FACES is near black type, so anything that darkens the middle makes the beat dark on
    // dark.
    // Blurred to 30px and down to 0.16, from 14px and 0.22. At the old numbers the deck's own
    // card edges survived the multiply as soft rectangles in the top corners, which on a flat
    // field reads as a light leak rather than as texture. What the multiply is for is stopping
    // a flat vermillion from looking like a solid fill; a mottle does that and a shape does
    // not.
    filter: "grayscale(1) contrast(1.2) brightness(1.34) blur(30px)",
    videoBlend: "multiply",
    videoAlpha: 0.16,
    sink: 0,
    vignette: 0.12,
    // The one place a portrait plate still pans, and it gets away with it because at 16%
    // through a 30px blur under a multiply there is no edge to expose: what would show is the
    // flooded field, which is what is already there.
    camera: "pan",
    camScale: 1.36,
    boxWidth: VIDEO_W,
  },
};

/**
 * The scrim, shaped to where the type is going to sit.
 *
 * Stops are in percentages of the frame height, and each one is placed against a real object
 * in the footage behind it:
 *
 *   center  a band. Clear above 8% and below 92%, so the top and bottom eighths of a gameplay
 *           beat are ungraded footage. 0.64 through the middle is what a bone headline needs
 *           over a sunlit map, which is the brightest material in the set.
 *   top     the deck beat. FULLY opaque to 26%, which is 499px, and gone by 30%, which is
 *           576px. The card's top edge is at 640 at the start of the beat and rises to 591 as
 *           the push runs, so the scrim dies above the product at every frame of the beat and
 *           the card, its name, its game and its playstyle tag are completely ungraded.
 *
 *           Opaque at 1.0 rather than at the 0.985 it used to be, and the two percent is one
 *           specific object. The deck's HIGHLIGHTS row carries a portrait bubble whose mock
 *           data does not agree with itself: a photograph of a woman captioned "John". It sits
 *           at 109 to 449, so it was under the old scrim at about two percent and it read as a
 *           grey smudge in the shape of a face, in the deck, in a film whose rail says there
 *           are no photos in the deck. Two percent of nothing is worth having.
 *   bottom  the DUO LOCKED beat, and the fiddliest of the three because that screen leaves a
 *           gap of about 60px between what must stay clean and what must go. Measured on the
 *           file rather than by eye: the lime Send a message button is source rows 1254 to
 *           1423 and the last row of Keep swiping is 1562, which put through the crop and the
 *           camera is a button ending between 1106 and 1120 and a link running from 1183 to
 *           1272 as the push carries them down the frame. Opaque from the bottom to 38%, which
 *           is 1190px, and gone by 41.5%, which is 1123px. The button never touches the ramp;
 *           the link is 90% covered at its worst frame and completely covered below 1190,
 *           because it would otherwise show through the counters of DUO, which is what the
 *           last render did. The 3.5% ramp reads as an edge on nothing, because what is
 *           actually there is the app's own black background.
 */
const scrimFor = (treatment: Treatment, anchor: Anchor): string | undefined => {
  if (treatment === "flood") {
    return undefined;
  }
  if (anchor === "top") {
    return `linear-gradient(to bottom, ${alpha(K.ink, 1)} 0%, ${alpha(K.ink, 1)} 26%, ${alpha(K.ink, 0)} 30%)`;
  }
  if (anchor === "bottom") {
    return `linear-gradient(to top, ${alpha(K.ink, 1)} 0%, ${alpha(K.ink, 1)} 38%, ${alpha(K.ink, 0)} 41.5%)`;
  }
  return `linear-gradient(to bottom, ${alpha(K.ink, 0)} 8%, ${alpha(K.ink, 0.64)} 26%, ${alpha(K.ink, 0.64)} 74%, ${alpha(K.ink, 0)} 92%)`;
};

/**
 * The camera path. Linear on both axes on purpose: constant velocity is what makes the speed
 * either side of a cut identical without having to match two curves against each other.
 *
 * `start` and `stop` park the camera outside a window. Both app beats park it because a
 * portrait plate has almost no horizontal headroom, the flood beat parks it to buy the
 * stillness before the climax, and the arrival beat parks it until its retraction has settled,
 * because a plate pushing in underneath a wrapper pulling back is two opposite scale signs in
 * one frame.
 */
const useCamera = ({
  mode,
  start,
  stop,
  base,
  lift,
  pinRight,
}: {
  mode: "pan" | "push";
  start: number;
  stop: number;
  base: number;
  lift: number;
  pinRight: boolean;
}): string => {
  const frame = useCurrentFrame();
  const span = Math.max(1, stop - start);
  const progress = interpolate(frame, [start, stop], [0, 1], {
    easing: EASE.linear,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const push = CAMERA.push * span;
  // The lift is a framing constant and not part of the move: it does not change over the beat,
  // so it costs the seam nothing and it is applied after the scale, in frame pixels.
  const y = -lift;

  if (mode === "push") {
    // No pan, so the base is a FLOOR rather than a midpoint and the plate can never be under
    // it. That is the whole safety argument for running this camera across a portrait plate
    // with no horizontal headroom: scale only ever grows and no edge can come into frame at
    // any point of any beat.
    const scale = base + push * progress;
    // WHERE THE PUSH IS ANCHORED, and it is the answer to the one screen a centred push
    // cannot survive.
    //
    // Scaling about the frame's centre pushes content out of BOTH sides. That is right for a
    // card or a photograph, which sit in the middle with margins around them, and wrong for a
    // chat, whose message bubble runs to within 50px of the phone's right edge: at the centre
    // the bubble's last word is off the frame a third of the way through the beat.
    //
    // Pinning the growth to the right edge fixes it exactly. The transform maps x to
    // 540 + s(x - 540), so putting the point 1080 back where it started costs 540(1 - s) of
    // translation, and everything on that edge then holds still while the screen grows away
    // from it to the left. What leaves the frame is the empty left side of the conversation
    // and the outer column of the keyboard, which is nothing, and the drift it produces is
    // LEFTWARD: the film's own current, arriving for free out of a Z move.
    const pin = pinRight ? HALF_W * (1 - scale) : 0;
    return `translateX(${pin.toFixed(2)}px) translateY(${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
  }

  const pan = CAMERA.pan * span;
  // Centred on zero, so half the travel is spent either side of the beat's midpoint and the
  // base scale only has to cover half the pan rather than all of it.
  const x = -CURRENT * (pan / 2) + CURRENT * pan * progress;
  const scale = base - push / 2 + push * progress;

  return `translateX(${x.toFixed(2)}px) translateY(${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
};

export const Plate = ({
  clip,
  from,
  treatment,
  anchor,
  camStart,
  camStop,
  camScale,
  camPinRight,
}: {
  clip: ClipName;
  from: number;
  treatment: Treatment;
  anchor: Anchor;
  camStart?: number;
  camStop?: number;
  camScale?: number;
  camPinRight?: boolean;
}) => {
  const { durationInFrames } = useVideoConfig();
  const entry = clips[clip];
  const path = `footage/${entry.file}`;
  const grade = GRADE[treatment];
  const camera = useCamera({
    mode: grade.camera,
    start: camStart ?? 0,
    stop: camStop ?? durationInFrames,
    base: camScale ?? grade.camScale,
    lift: grade.lift ?? 0,
    pinRight: camPinRight === true,
  });
  const scrim = scrimFor(treatment, anchor);

  return (
    // isolate, so the flood's multiply works against this footage and not against whatever the
    // beat painted underneath it.
    <AbsoluteFill style={{ backgroundColor: grade.field, isolation: "isolate", overflow: "hidden" }}>
      {isPresent(path) ? (
        <AbsoluteFill
          style={{
            transform: camera,
            mixBlendMode: grade.videoBlend,
            opacity: grade.videoAlpha,
          }}
        >
          {/* The layout box, centred, and wider than the frame on the gameplay beats so the
              pan has somewhere to go. See `boxWidth` above for why this is not the same thing
              as zooming out. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: (VIDEO_W - grade.boxWidth) / 2,
              width: grade.boxWidth,
            }}
          >
            {/* OffthreadVideo rather than Video: these are 60fps screen and game captures and
                Remotion's own compositor decodes far more than Chromium's <video> does.
                trimBefore is where in the clip this beat starts, which is how two beats over
                one file are two different moments rather than the same second twice. */}
            <OffthreadVideo
              src={staticFile(path)}
              trimBefore={Math.round((entry.from + from) * FPS)}
              trimAfter={Math.round(entry.to * FPS)}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover", filter: grade.filter }}
            />
          </div>
        </AbsoluteFill>
      ) : null}

      {grade.sink > 0 ? (
        <AbsoluteFill style={{ backgroundColor: K.ink, opacity: grade.sink }} />
      ) : null}

      {/* Wide and shallow: it holds the eye in the middle of the frame and it is not here to
          announce itself. */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(128% 82% at 50% 46%, ${alpha(K.ink, 0)} 38%, ${alpha(K.ink, 0.8)} 100%)`,
          opacity: grade.vignette,
        }}
      />

      {grade.topMask !== undefined ? (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(to bottom, ${alpha(K.ink, 1)} 0px, ${alpha(K.ink, 1)} ${String(grade.topMask)}px, ${alpha(K.ink, 0)} ${String(grade.topMask + 34)}px)`,
          }}
        />
      ) : null}

      {scrim !== undefined ? <AbsoluteFill style={{ backgroundImage: scrim }} /> : null}
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
        backgroundImage: `repeating-linear-gradient(to bottom, ${alpha(K.ink, 0.04)} 0px, ${alpha(K.ink, 0.04)} 1px, ${alpha(K.ink, 0)} 1px, ${alpha(K.ink, 0)} 4px)`,
      }}
    />
  </AbsoluteFill>
);
