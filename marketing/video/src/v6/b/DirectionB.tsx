/**
 * DIRECTION B, "END CARD NATIVE": the one thing Cameron likes, extended backwards over the
 * whole film.
 *
 * His note was exact about what survived the fifth cut: "i really dont like how it looks at
 * all, besides the ending where it says join the waitlist". That ending is black ground, the
 * mark, centred legible type, one filled slab, and nothing else competing for the frame. It is
 * a real signal about taste rather than an accident of that one card, so this direction takes
 * it as the brief for every frame instead of only the last thirty.
 *
 * =====================================================================================
 * THE FOUR RULES IT KEEPS FROM THE CARD
 * =====================================================================================
 *
 *   BLACK GROUND, EVERYWHERE. Not a graded plate, not a flooded field, not a scrim over
 *   footage. K.ink over the whole frame for the entire film, with the same grain the end card
 *   already carries so the two do not read as different materials.
 *
 *   THE MARK IS ON EVERY FRAME AND IT NEVER MOVES. The end card's mark is the only piece of
 *   brand furniture in the previous film. Here it is present from frame one, small, centred,
 *   fixed. It is the constant everything else passes through.
 *
 *   CENTRED, RESTRAINED TYPE AT ONE SIZE. 74px, centred, in the face the card's call to action
 *   is set in, at the same position in every beat. Nothing is fitted to the frame width and
 *   nothing is sized by how long a word is.
 *
 *   FOOTAGE IS A FRAMED PLATE THAT NEVER BLEEDS. Every clip enters inside a window with a
 *   hairline around it and real black on all four sides. Nothing in this direction touches the
 *   frame edge except the ground.
 *
 * =====================================================================================
 * THE WINDOW, AND WHAT IT COSTS
 * =====================================================================================
 *
 * The insert box is 920 wide by 1430 tall, and `fitApp` of that is 660 x 1430: the whole
 * 1180 x 2556 screen at 0.559 of its own scale, uncropped, with 210px of ground each side and
 * 380 above. This is the smallest app of the three directions and it is a deliberate trade
 * rather than an oversight. The vertical budget is what binds: the screen is 2.166 times taller
 * than it is wide, so every pixel of height spent on the mark and the type costs 0.46 pixels of
 * app width. To reach direction C's 785px the window would need 1700px of height, which leaves
 * 220px for a mark, a type block and two margins, and at that point this is not the end card's
 * language any more, it is direction A with a logo on it.
 *
 * What it buys is that the app is a PLATE. It has an edge, it sits in space, and it is the same
 * object in the same rectangle every time it appears, including on the two beats that are not
 * the app at all. That is what the end card does with the mark and the slab, and it is the
 * reason this direction exists.
 *
 * =====================================================================================
 * MOTION
 * =====================================================================================
 *
 * Two gestures and the seam, which is the doctrine's two to three transition types.
 *
 * The plate slides through the fixed window on the film's current: in from the right on a
 * mirrored power4 over 130px of partial travel, out to the left on the accelerating half. So a
 * beat boundary is a cut between a plate still arriving and a plate still leaving, and the last
 * plate hands its leftward velocity straight to the end card's existing entry from the right.
 * The type does the waterfall cut over the same boundary.
 *
 * The mark does nothing at all, ever, and that is the point of it.
 */
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { Soundtrack } from "@/audio/Soundtrack";
import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { EndCard } from "@/kinetic-native/EndCard";
import { CURVE, EASE, TRAVEL } from "@/kinetic-native/motion";
import { Texture } from "@/kinetic-native/Plate";
import { K } from "@/kinetic-native/skin";
import { alpha } from "@/lib/color";
import { VIDEO_W } from "@/lib/scale";

import { fitApp, isGameplay, Source } from "../media";
import type { Shot, V6Script } from "../script";
import { Stack } from "../Stack";
import { beatFrames, beatStarts, bodyFrames, END_FRAMES } from "../timing";
import { filmSize, useFaces } from "../type";

/** The mark, at the top, on every frame, never moving. Small enough to be a signature rather
 * than a headline: the end card's is 250px wide because it is the subject there, and this one
 * is a quarter of that because here it is the frame's own furniture. */
const MARK = { width: 72, top: 78 } as const;

/** The type block's own band. Centred inside it, so a one line beat and a two line beat share
 * an optical centre rather than a top edge. */
const TYPE = { top: 168, height: 176, cap: 74 } as const;

/**
 * The window every clip appears inside, and it is ONE RECTANGLE for all six beats.
 *
 * `fitApp(920, 1430)` is 660 x 1430, so the box is the app's own aspect and the app fills it
 * exactly, uncropped. The gameplay fills the same rectangle on a cover fit, cropped and then
 * magnified, and that asymmetry is the direction's whole argument rather than a compromise in
 * it. See the `isGame` branch in `Plate` for why the magnification is not optional and why a
 * 16:9 plate showing the whole capture is not available at all.
 *
 * Cropping the game costs nothing that is not already gone. It is a 2560 x 1440 capture in a
 * vertical film: no version of it is uncropped, in any of the three directions, and the brief
 * only ever asked for the APP to be whole. What the single window buys is that the two gameplay
 * beats land in the same place, at the same size, with the same edge, as the four app beats
 * between them, and a film whose furniture never moves is what the end card actually is.
 */
const WINDOW = { top: 380, height: 1430, width: 920 } as const;

const APP_RECT = fitApp(WINDOW.width, WINDOW.height);

const Plate = ({
  shot,
  frames,
  isGame,
  isFirst,
}: {
  shot: Shot;
  frames: number;
  isGame: boolean;
  isFirst: boolean;
}) => {
  const frame = useCurrentFrame();


  // In from the right, out to the left, on the film's one current. The opening plate is already
  // most of the way through its own arrival on frame one, because the doctrine forbids fading
  // up into an empty opening frame.
  const enter = interpolate(frame, [isFirst ? -CURVE.entry * 0.7 : 0, CURVE.entry], [0, 1], {
    easing: EASE.power4Out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const leave = interpolate(frame, [frames - CURVE.exit, frames], [0, 1], {
    easing: EASE.power4In,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = (1 - enter) * TRAVEL - leave * TRAVEL;
  const opacity =
    Math.min(1, CURVE.ignite + enter * (1 - CURVE.ignite)) * (1 - Math.min(1, leave * 1.35));

  return (
    <div
      style={{
        position: "absolute",
        left: Math.round((VIDEO_W - APP_RECT.width) / 2),
        top: WINDOW.top + Math.round((WINDOW.height - APP_RECT.height) / 2),
        width: APP_RECT.width,
        height: APP_RECT.height,
        transform: `translateX(${x.toFixed(2)}px)`,
        opacity,
        borderRadius: 24,
        overflow: "hidden",
        // A hairline and nothing else. The end card carries no shadows, so neither does this:
        // a plate on black with a drawn edge is the same material as the slab on that card.
        boxShadow: `0 0 0 1px ${alpha(K.bone, 0.16)}`,
      }}
    >
      {isGame ? (
        // THE GAMEPLAY IS MAGNIFIED INSIDE THE PLATE, and this is the fix for the one part of
        // this direction verification called a failure. A 2560 x 1440 capture covered into a
        // 660 x 1430 window keeps 26% of the width and ALL of the height, so the plate ran from
        // the ceiling of the room to the ability bar and the middle third, which is where
        // everything happens, got a third of the plate. Beat six read as a black ceiling, a
        // lamp and an unreadable HUD.
        //
        // Scaling inside the plate throws away the top and bottom rather than the sides: at
        // 1.34 the visible band is 75% of the source height, centred, which drops the ceiling
        // and the HUD and leaves the crosshair and whatever it is pointed at filling the
        // window. It is a ramp rather than a hold, so the plate is moving through the cut at
        // both ends like everything else in this film.
        //
        // The alternative was a 16:9 plate showing the whole frame, and it is not available:
        // this capture is a spectator view whose full frame carries a minimap, a combat report
        // and two teammates' real gamertags. The narrow crop is what keeps other people's names
        // out of published marketing.
        <AbsoluteFill style={{ transform: `scale(${(1.28 + 0.12 * (frame / Math.max(1, frames))).toFixed(4)})` }}>
          <Source clip={shot.clip} from={shot.from} fit="cover" />
        </AbsoluteFill>
      ) : (
        <Source clip={shot.clip} from={shot.from} fit="contain" />
      )}
    </div>
  );
};

const Beat = ({
  index,
  shot,
  lines,
  keyWord,
  frames,
  size,
  isGame,
}: {
  index: number;
  shot: Shot;
  lines: string[];
  keyWord: string | undefined;
  frames: number;
  size: number;
  isGame: boolean;
}) => (
  <AbsoluteFill>
    <Plate shot={shot} frames={frames} isGame={isGame} isFirst={index === 0} />

    <div
      style={{
        position: "absolute",
        left: 0,
        top: TYPE.top,
        width: VIDEO_W,
        height: TYPE.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack
        lines={lines}
        keyWord={keyWord}
        frames={frames}
        size={size}
        align="center"
        color={K.bone}
        accent={K.hot}
        delay={index === 0 ? -7 : 0}
      />
    </div>
  </AbsoluteFill>
);

export const DirectionB = ({
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
    return <AbsoluteFill style={{ backgroundColor: K.ink }} />;
  }

  // The measure is the window rather than the frame, so the type is the same width as the plate
  // it labels and the composition has one column instead of two.
  const size = filmSize(script, WINDOW.width, TYPE.cap);

  return (
    <AbsoluteFill style={{ backgroundColor: K.ink }}>
      <Soundtrack id={script.id} />

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
            size={size}
            isGame={isGameplay((shots[index] ?? { clip: "deck-dark" as const }).clip)}
          />
        </Sequence>
      ))}

      {/* Outside the beat sequences on purpose. The mark is the one thing in this film that is
          not an event: it is on the first frame, it is on the last frame of the body, and it
          does not know a cut has happened. */}
      <Sequence from={0} durationInFrames={body} layout="none">
        <div
          style={{
            position: "absolute",
            left: 0,
            top: MARK.top,
            width: VIDEO_W,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Mark width={MARK.width} />
        </div>
      </Sequence>

      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Texture />
      </AbsoluteFill>

      <Sequence from={body} durationInFrames={END_FRAMES} layout="none">
        <EndCard cta={cta} />
      </Sequence>
    </AbsoluteFill>
  );
};
