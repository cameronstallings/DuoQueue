/**
 * THE OBJECT, and everything that moves it.
 *
 * A fragment is drawn as a CARD: the cropped clip at its own true aspect, at a stated width,
 * with rounded corners and one shadow, inside the stage's single perspective. Nothing is
 * stretched, nothing is letterboxed and nothing is cropped again at render time, because the
 * crop already happened in ffmpeg and is recorded in public/footage/README.md beside the line
 * that produced it. The element is sized from the crop's own pixels, so "cover" and "contain"
 * would give the same picture and the fit is not a decision this file has to make.
 *
 * =====================================================================================
 * THE MOTION IS THREE THINGS AND NOT ONE MORE
 * =====================================================================================
 *
 *   THE CURRENT. Every object drifts left at CRUISE for the whole of its shot, re-centred so
 *   the drift is symmetric about the grid and never accumulates. It is the carrier: four of the
 *   six fragments are deliberately still holds, so without it this film has four beats of frozen
 *   pixels, which is the doctrine's stated failure and also just a video that looks broken.
 *
 *   THE SEAM. Technique 3, cut the curve, at every boundary except one: the outgoing object
 *   accelerates left on power4.in and dies mid path, the incoming enters from the right on the
 *   mirrored power4.out and is already moving when it appears. Partial travel is TRAVEL, which
 *   motion.ts sets at 12% of THIS frame's width, 130px, and not the catalog's 230, which assumes
 *   a 1920 wide landscape frame.
 *
 *   THE ARRIVAL. Technique 2, the inverse zoom through, spent exactly once, on "duo locked".
 *   The prompt recedes to 0.8 under blur, the DUO card arrives at 1.25 and retracts. No x travel
 *   on either side of that seam, because a positional seam under a scale seam is two gestures at
 *   one cut and the eye reads the second one as the real one.
 *
 * There is no fourth thing. No idle float, no breathe, no parallax, no shadow that pulses. The
 * doctrine bans those outright as motion that goes nowhere and comes back, and this film has no
 * excuse to want them: something is travelling on every frame.
 *
 * =====================================================================================
 * WHY THE OPACITY CURVE IS WHERE IT IS
 * =====================================================================================
 *
 * The outgoing object's opacity reaches zero at CURVE.fadeAt of its exit, which is 0.727 of the
 * duration and therefore, under a power4, 28% of the TRAVEL. That is the catalog's rule stated
 * in distance rather than in time, and the distinction is not pedantry: fading on a time
 * fraction would kill the object at 8% of its travel, which reads as a disappearance instead of
 * as speed. The incoming ignites at CURVE.ignite, 0.35, part way along its own path, because a
 * binary 0 to 1 pops and a fade from nothing is the crossfade Cameron already rejected once.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { CURVE, EASE, INVERSE, TRAVEL } from "@/kinetic-native/motion";

import {
  CRUISE,
  MEASURE,
  PIECE_GAP,
  SHADOW,
  STAGE_Y,
  TILT,
  TOP_MAX,
  TOP_MIN,
  X0,
} from "./ground";
import { FRAGMENTS, type FragShot, type Theme, type Vector } from "./plan";
import { Source } from "../v6/media";

/**
 * Blur for the one inverse-zoom seam.
 *
 * The catalog gives 10px for text-scale subjects and 18 to 20 for a full frame. The subject here
 * is a 523px card and an 844px strip, which is between the two, and 20px on an object carrying
 * the app's own mono type smears it into a glitch rather than into speed. 14 is the value that
 * still reads as depth on a 640px-tall object without destroying the letterforms either side of
 * the cut.
 */
const ARRIVAL_BLUR = 14;

/**
 * TWO OPACITY NUMBERS THAT THE CATALOG SETS FOR A DARK GROUND AND THIS FILM HAS TO RESET.
 *
 * Both were measured on a render, not predicted, and they are the same defect twice: an opacity
 * that reads as depth on off-black reads as a hole on warm off-white, because the object is the
 * dark thing here and the field is the bright one. A 0.15 alpha dark card on off-black is a
 * shape you can still see; the same card on this ground is 85% ground.
 *
 * `FADE_AT` replaces CURVE.fadeAt, 0.727. The rule behind that number is that the object's fade
 * must complete while it is still accelerating, which the catalog states as 28% of the TRAVEL
 * and converts to 0.727 of the duration under a power4. At 0.9 the fade completes at 66% of the
 * travel, 85px of 130, which is still 88% of the object on frame and still accelerating hard, so
 * the rule survives. What it buys is the last two frames before every cut: at 0.727 the object
 * was gone 2.7 frames before the next one arrived and the seam showed bare ground, which was
 * plainly visible at the hand-off into the end card.
 *
 * `ARRIVAL_CUT` replaces INVERSE.cut, 0.15, on the one reserved seam. Both halves of that
 * gesture meet at it by definition, so at 0.15 the swap frame was a near-empty field with a
 * blurred grey smudge on it: a white flash in the middle of the film's payoff. At 0.42 the
 * receding prompt and the arriving card are each a legible dark mass on their own frame and the
 * depth is carried by the scale and the blur, which is where it belonged anyway.
 */
const FADE_AT = 0.9;
const ARRIVAL_CUT = 0.42;

/**
 * WHAT THE OUTGOING OBJECT STILL HAS LEFT ON THE FRAME IT IS CUT ON, and it is 0.14 rather than
 * 0 because 0 put a hole at every seam in the film.
 *
 * A beat's Sequence ends on frame `frames - 1` and the next beat's begins on the frame after,
 * so there is no overlap: whatever the outgoing object is at on its last frame is the whole
 * picture below the type. With FADE_AT at 0.9 and CURVE.exit at 10 frames, the fade completed
 * at exactly frame `frames - 1`, so the last frame of every beat was bare ground. It was caught
 * on the delivered file at f346, the hand-off into the end card, where there is no next beat's
 * type to disguise it, but the same frame exists at all five body seams.
 *
 * A floor is also the more doctrinally correct shape. The rule is CUT MID-MOTION on both sides;
 * an object that has already faded to nothing before the cut is not being cut, it is being
 * dispensed with. At 0.14 the last three frames run 0.33, 0.24, 0.14 and the object is still
 * there, still accelerating left, when the film cuts away from it.
 */
const CUT_FLOOR = 0.14;

/** How a shot's picture is transformed at a given frame of its own window. */
interface Move {
  x: number;
  scale: number;
  blur: number;
  opacity: number;
}

/**
 * The whole motion model, as one function, so the entry and the exit cannot drift apart and a
 * reader can see both halves of every seam in one place.
 *
 * `frame` is local to the SHOT. `frames` is the shot's length. The cruise is computed from the
 * shot's own midpoint, which is what re-centres it: at the halfway frame the object sits exactly
 * on the grid, and it is CRUISE * frames / 2 to the right of it at the start and the same
 * distance to the left at the end.
 */
const moveOf = (
  frame: number,
  frames: number,
  /** The BEAT's clock, which the cruise runs on rather than the shot's. See `Shot` for why. */
  beatFrame: number,
  beatLength: number,
  enter: Vector,
  exit: Vector,
  /** Frames the ENTRY clock alone is advanced by, so the film's opening picture is already part
   * way through its arrival on frame zero. It does not touch the cruise or the exit, so the
   * shot still ends exactly where the read put it. */
  lead: number,
): Move => {
  const cruise = CRUISE * (beatLength / 2 - beatFrame);
  const arriving = frame + lead;

  const entering = enter === "arrive" ? INVERSE.entry : CURVE.entry;
  const enterT = interpolate(arriving, [0, entering], [0, 1], {
    easing: EASE.power4Out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const leaving = exit === "recede" ? INVERSE.exit : CURVE.exit;
  const exitAt = frames - leaving;
  const leaveT = interpolate(frame, [exitAt, frames], [0, 1], {
    easing: EASE.power4In,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Positional travel, on the beats whose seam is the default one. An "arrive" or "recede" side
  // contributes no x, so the reserved gesture is scale alone and never scale plus a slide. A
  // "hold" side contributes nothing at all: the object simply exists, already travelling, and
  // the cut is the velocity match.
  const enterX = enter === "curve" ? (1 - enterT) * TRAVEL : 0;
  const exitX = exit === "curve" ? -leaveT * TRAVEL : 0;

  const enterScale = enter === "arrive" ? INVERSE.entryScale + (1 - INVERSE.entryScale) * enterT : 1;
  const exitScale = exit === "recede" ? 1 + (INVERSE.exitScale - 1) * leaveT : 1;

  const enterBlur = enter === "arrive" ? (1 - enterT) * ARRIVAL_BLUR : 0;
  const exitBlur = exit === "recede" ? leaveT * ARRIVAL_BLUR : 0;

  // The entry ignites mid path; the exit dies at 28% of its travel, which under power4 is 0.727
  // of its duration. On the reserved seam both sides meet at INVERSE.cut instead, which is the
  // one opacity both halves of that gesture agree on. A "hold" side never changes opacity: the
  // whole point of it is that the object is fully there for every frame of its window.
  const enterFloor = enter === "arrive" ? ARRIVAL_CUT : CURVE.ignite;
  const enterFade =
    enter === "hold"
      ? 1
      : interpolate(arriving, [0, entering * 0.4], [enterFloor, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const exitFloor = exit === "recede" ? ARRIVAL_CUT : CUT_FLOOR;
  const exitFade =
    exit === "hold"
      ? 1
      : interpolate(frame, [exitAt, exitAt + leaving * FADE_AT], [1, exitFloor], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return {
    x: cruise + enterX + exitX,
    scale: enterScale * exitScale,
    blur: Math.max(enterBlur, exitBlur),
    opacity: Math.min(enterFade, exitFade),
  };
};

/**
 * One shot's fragments, placed and moved together.
 *
 * The pieces of a multi-piece shot share one transform rather than carrying their own, so the
 * two chips on beat two travel as one object. Staggering them would be a fourth transition type
 * for a two element group and would also say they are two separate claims, which they are not:
 * a title and a count of shared titles are one sentence rendered by the app.
 */
export const Shot = ({
  shot,
  theme,
  frames,
  from,
  beatLength,
  enter,
  exit,
  lead = 0,
}: {
  shot: FragShot;
  theme: Theme;
  /** This shot's own length, which the entry and exit are placed against. */
  frames: number;
  /** Where this shot starts inside its beat. The cruise is computed from the BEAT's clock and
   * not the shot's, so a beat with two shots is one continuous camera move and the two objects
   * are at the same x on the frame either side of the cut between them. Computing it per shot
   * re-centred it twice and put a 32px jump in the middle of "send a message". */
  from: number;
  beatLength: number;
  enter: Vector;
  exit: Vector;
  lead?: number;
}) => {
  const frame = useCurrentFrame();
  const move = moveOf(frame, frames, from + frame, beatLength, enter, exit, lead);

  const sized = shot.pieces.map((piece) => {
    const [sourceW, sourceH] = FRAGMENTS[piece.frag].source;
    return { piece, height: Math.round((piece.width * sourceH) / sourceW) };
  });
  const stack =
    sized.reduce((total, row) => total + row.height, 0) + PIECE_GAP * (sized.length - 1);

  // The hang band. The stack's top is where centring on the stage would put it, pulled into
  // [TOP_MIN, TOP_MAX] so a 113px chip cannot sit 590px below the type with nothing in between
  // and a 644px card cannot run down into the platform's own chrome. See TOP_MIN in ./ground.
  let cursor = Math.min(Math.max(STAGE_Y - stack / 2, TOP_MIN), TOP_MAX);

  return (
    <AbsoluteFill
      style={{
        perspective: `${String(TILT.perspective)}px`,
        perspectiveOrigin: TILT.origin,
      }}
    >
      <AbsoluteFill
        style={{
          transform: `translateX(${move.x.toFixed(2)}px) scale(${move.scale.toFixed(4)})`,
          opacity: move.opacity,
          filter: move.blur > 0.05 ? `blur(${move.blur.toFixed(1)}px)` : undefined,
        }}
      >
        {sized.map(({ piece, height }) => {
          const top = cursor;
          cursor += height + PIECE_GAP;
          const left =
            piece.align === "center" ? X0 + Math.round((MEASURE - piece.width) / 2) : X0;
          return (
            <div
              key={piece.frag}
              style={{
                position: "absolute",
                left,
                top,
                width: piece.width,
                height,
                borderRadius: piece.radius,
                overflow: "hidden",
                transform: TILT.transform,
                boxShadow: SHADOW,
                // Under the rounded corners. Every fragment is a region of an app screen, so its
                // own field is what a corner should reveal: without this a 24px radius shows a
                // sliver of ground through the antialiased edge and the card reads as cut out
                // rather than as an object.
                backgroundColor: theme === "dark" ? "#0A0B09" : "#F2F4EB",
              }}
            >
              <Source clip={FRAGMENTS[piece.frag][theme]} from={0} fit="cover" />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
