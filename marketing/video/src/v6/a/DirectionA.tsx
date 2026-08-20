/**
 * DIRECTION A, "PRODUCT LED": the app is the hero and the type is a label on it.
 *
 * =====================================================================================
 * THE COMPOSITION, and every number in it is the uncropped constraint solved
 * =====================================================================================
 *
 * One phone screen, whole, on a lit studio ground, with a line of type above it. The screen is
 * 748 x 1620, which is `fitApp(748, 1620)` and therefore the entire 1180 x 2556 recording at
 * 0.634 of its own scale with nothing outside the frame. Around it: 166px of ground to each
 * side, 200px above and 100px below. That is a fifth of the frame width given up to margin on
 * purpose, and it is what makes the thing read as a product photographed rather than as a video
 * that happens to be of a phone.
 *
 * Compare what it replaces. The previous direction's app beats ran a cover fit at camera scales
 * of 1.1 and 1.36, which put the screen at 1188 and 1468 pixels wide and threw away between 326
 * and 800 pixels of its height. The Deck header and the pass / ping / boost row, which are the
 * two strips that make the footage read as an application at all, were partly or entirely
 * outside the frame for most of the film. Here they are on every frame of every app beat, and
 * so is the tab bar, the Highlights strip, the card's game chip, its region line and its prompt
 * answer. The app is 37% smaller and 100% present.
 *
 * THE TYPE IS A LABEL. 66px, which is within two points of the end card's own call to action,
 * left aligned to the screen's left edge, bottom aligned to the band above it so the last line
 * always sits the same distance off the top of the phone whether the beat is one line or two.
 * One size for the whole film (see src/v6/type.ts), so no beat is bigger than another because
 * of how it is spelled. It never overlaps the product, at any frame, in any beat.
 *
 * =====================================================================================
 * THE MOTION IS ONE MOVE, NOT SIX
 * =====================================================================================
 *
 * The doctrine's law is that a film should read as one continuous camera move rather than a
 * stack of independently animated slides, and this is the direction that takes it literally.
 * The phone does not re-enter at every beat. It is a single object under a single slow camera
 * that runs for the whole body: 52px of leftward drift and 2.2% of scale across 11.7 seconds,
 * monotonic, never parking and never returning. That is the film's current, and it is a camera
 * move rather than the banned idle wobble, which is motion that goes nowhere and comes back.
 *
 * What cuts at a beat boundary is what is ON the screen, which is a hard cut inside a moving
 * plate, and the type, which does the doctrine's waterfall cut in and out. Nothing else moves,
 * because nothing else needs to: there is a live screen recording on the frame at all times.
 *
 * THE ONE BIG GESTURE is the last beat. The phone accelerates out to the left and the game
 * arrives full bleed on a retracting scale, which is the reserved inverse zoom spent once, on
 * the one moment the film is about: the point of the product is that you stop using it. The
 * game then pans left into the end card, so the card's existing entry from the right picks up
 * the vector the body handed it.
 *
 * THE FILM ALSO OPENS ON THE GAME, which the first cut of this direction did not, and the
 * layout follows the shot plan rather than a beat index for it (see `isGameplay` in
 * ../media.tsx). The two gameplay beats take opposite halves of one gesture: the opening pushes
 * in so the first frame is already travelling, the close retracts. The phone is on four of the
 * six beats and it is the same object in the same place on all four.
 */
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { Soundtrack } from "@/audio/Soundtrack";
import type { Cta } from "@/config/phase";
import { EndCard } from "@/kinetic-native/EndCard";
import { CURVE, EASE, TRAVEL } from "@/kinetic-native/motion";
import { Texture } from "@/kinetic-native/Plate";
import { K } from "@/kinetic-native/skin";
import { alpha } from "@/lib/color";
import { VIDEO_H, VIDEO_W } from "@/lib/scale";

import { GameBed, isGameplay, Source } from "../media";
import type { Shot, V6Script } from "../script";
import { Stack } from "../Stack";
import { beatFrames, beatStarts, bodyFrames, END_FRAMES } from "../timing";
import { filmSize, useFaces } from "../type";

/** The phone, in composition pixels. `fitApp(748, 1620)` returns exactly 748 x 1620, so the
 * rectangle IS the whole recording at its own aspect and there is nothing to letterbox. */
const PHONE = { x: 166, y: 200, width: 748, height: 1620 } as const;

/** Frame top to the bottom of the type band. The block is bottom aligned inside it, so a one
 * line beat and a two line beat share a baseline rather than a top edge. */
const BAND = 166;

/** The label size, and the cap that actually binds. Two points under the end card's call to
 * action, which is the reference this direction was asked to sit next to. */
const CAP = 66;

/**
 * The studio ground, and the bezel that makes the phone an object.
 *
 * The first cut of this direction claimed the phone was "a lit object on a studio ground" and
 * verification measured it: luminance 27.7 on the ground at (60, 900) against 27.8 on the phone
 * body at (400, 1750). A difference of 0.1 is no edge at all, so the plate read only because
 * the app content inside it happened to be brighter than the field, and at the corners it read
 * as a hole.
 *
 * Two changes, both measurable. The ground is lifted so the field is unambiguously lighter than
 * the app's own near black, and the screen now sits inside a BEZEL: a 10px band of dark metal
 * with a bone hairline on its outer edge, which is the thing an actual phone has and the thing
 * that was missing. The screen keeps its exact 748 x 1620 rectangle; the bezel is drawn outside
 * it, so nothing about the uncropped fit changes.
 */
const GROUND = {
  base: "#100F16",
  lift: "#2A2833",
} as const;

/** The bezel's own band, in pixels each side of the screen, and its colour. */
const BEZEL = { band: 10, fill: "#050509" } as const;

/** The film long camera, in pixels of leftward drift and in scale, across the whole body. */
const DRIFT = 52;
const CAMERA_SCALE = 0.022;

const AppBeat = ({
  shot,
  progress,
  leaving,
}: {
  shot: Shot;
  /** 0 to 1 across the whole body, so the camera is one move rather than one per beat. */
  progress: number;
  /** 0 to 1 as the phone accelerates out of the film. Only the last app beat uses it. */
  leaving: number;
}) => {
  const x = DRIFT / 2 - DRIFT * progress - leaving * TRAVEL;
  const scale = (1 + CAMERA_SCALE * progress) * (1 - leaving * 0.06);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: PHONE.x - BEZEL.band,
          top: PHONE.y - BEZEL.band,
          width: PHONE.width + BEZEL.band * 2,
          height: PHONE.height + BEZEL.band * 2,
          transform: `translateX(${x.toFixed(2)}px) scale(${scale.toFixed(4)})`,
          opacity: 1 - leaving,
          borderRadius: 44,
          backgroundColor: BEZEL.fill,
          // The silhouette. A drop that separates the device from the field, a bone hairline on
          // the outer edge of the bezel so the object has a drawn boundary at every frame, and a
          // faint inner line where the bezel meets the glass.
          boxShadow: `0 44px 130px ${alpha("#000000", 0.72)}, 0 0 0 1.5px ${alpha(K.bone, 0.22)}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: BEZEL.band,
            top: BEZEL.band,
            width: PHONE.width,
            height: PHONE.height,
            borderRadius: 34,
            overflow: "hidden",
            boxShadow: `inset 0 0 0 1px ${alpha("#000000", 0.85)}`,
          }}
        >
          <Source clip={shot.clip} from={shot.from} fit="contain" />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Beat = ({
  index,
  shot,
  lines,
  keyWord,
  frames,
  start,
  body,
  size,
  isLastApp,
  isLast,
}: {
  index: number;
  shot: Shot;
  lines: string[];
  keyWord: string | undefined;
  frames: number;
  start: number;
  body: number;
  size: number;
  isLastApp: boolean;
  isLast: boolean;
}) => {
  const frame = useCurrentFrame();
  const progress = (start + frame) / Math.max(1, body);
  const isGame = isGameplay(shot.clip);

  // The phone's exit, and the film's one reserved gesture. It begins before the beat is over so
  // the cut into the game lands with the product still travelling.
  const leaving = isLastApp
    ? interpolate(frame, [frames - CURVE.exit, frames], [0, 1], {
        easing: EASE.power4In,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // The last shot's own exit vector, handed to the end card's entry from the right. Only the
  // closing beat carries it: the opening gameplay beat hands over to a hard cut into the phone,
  // which has its own leftward drift to pick the current up.
  const handoff = isLast
    ? interpolate(frame, [frames - 16, frames], [0, 1], {
        easing: EASE.power4In,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <AbsoluteFill>
      {isGame ? (
        <AbsoluteFill style={{ transform: `translateX(${(-handoff * 66).toFixed(2)}px)` }}>
          {/* The film's two gameplay beats take opposite halves of one gesture. The opening
              pushes in, so the first frame of the film is already travelling; the close is
              overscaled enough that 66px of leftward pan never opens an edge and RETRACTS,
              which is the inverse zoom this film spends exactly once, on the beat that hands
              over to the end card. */}
          <GameBed
            clip={shot.clip}
            from={shot.from}
            frames={frames}
            scaleFrom={isLast ? 1.2 : 1.04}
            scaleTo={isLast ? 1.08 : 1.13}
            filter="saturate(1.06) contrast(1.04)"
          />
          <AbsoluteFill
            style={{
              backgroundImage: `radial-gradient(120% 74% at 50% 44%, ${alpha("#000000", 0)} 40%, ${alpha("#000000", 0.72)} 100%)`,
            }}
          />
          {/* The label sits in the same place on this beat as on the five before it, and this
              is the only beat whose ground is bright and busy. A top ramp rather than a full
              wash: the brief is that the gameplay is unobscured, so the scrim covers the band
              the type occupies and stops 120px under it. */}
          <AbsoluteFill
            style={{
              backgroundImage: `linear-gradient(to bottom, ${alpha("#000000", 0.86)} 0px, ${alpha("#000000", 0.74)} ${String(BAND)}px, ${alpha("#000000", 0)} ${String(BAND + 120)}px)`,
            }}
          />
        </AbsoluteFill>
      ) : (
        <AppBeat shot={shot} progress={progress} leaving={leaving} />
      )}

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: VIDEO_W,
          height: BAND,
          display: "flex",
          alignItems: "flex-end",
          paddingLeft: PHONE.x,
        }}
      >
        <Stack
          lines={lines}
          keyWord={keyWord}
          frames={frames}
          size={size}
          align="left"
          color={K.bone}
          accent={K.hot}
          // The opening beat is already part way through its own arrival on frame one. The
          // doctrine forbids fading up into an empty opening frame, and the first half second is
          // the only half second there is.
          delay={index === 0 ? -7 : 0}
        />
      </div>
    </AbsoluteFill>
  );
};

export const DirectionA = ({
  script,
  shots,
  cta,
}: {
  script: V6Script;
  shots: Shot[];
  cta: Cta;
}) => {
  const loaded = useFaces();
  const frames = beatFrames(script);
  const starts = beatStarts(script);
  const body = bodyFrames(script);

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  const size = filmSize(script, PHONE.width, CAP);
  // The beat the phone accelerates out of, which is the last one that has a phone on it. Found
  // rather than assumed, so the reserved exit follows the shot plan instead of an index.
  const lastAppIndex = shots.reduce(
    (found, shot, index) => (isGameplay(shot.clip) ? found : index),
    -1,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND.base }}>
      <Soundtrack id={script.id} />

      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(116% 62% at 50% 33%, ${GROUND.lift} 0%, ${GROUND.base} 72%)`,
        }}
      />

      {script.beats.map((beat, index) => (
        <Sequence
          key={beat.phrase}
          from={starts[index] ?? 0}
          durationInFrames={frames[index] ?? 1}
          layout="none"
        >
          <Beat
            index={index}
            shot={shots[index] ?? { clip: "deck-cards", from: 0 }}
            lines={beat.lines}
            keyWord={beat.key}
            frames={frames[index] ?? 1}
            start={starts[index] ?? 0}
            body={body}
            size={size}
            isLastApp={index === lastAppIndex}
            isLast={index === script.beats.length - 1}
          />
        </Sequence>
      ))}

      <AbsoluteFill style={{ height: VIDEO_H, pointerEvents: "none" }}>
        <Texture />
      </AbsoluteFill>

      <Sequence from={body} durationInFrames={END_FRAMES} layout="none">
        <EndCard cta={cta} />
      </Sequence>
    </AbsoluteFill>
  );
};
