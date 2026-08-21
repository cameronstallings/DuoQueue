/**
 * THE OBJECT, AND EVERYTHING THAT MOVES IT.
 *
 * A fragment is drawn as a CARD: the cropped clip at its own true aspect, at a stated width,
 * with rounded corners and one shadow. Nothing is stretched, nothing is letterboxed and nothing
 * is cropped again at render time, because the crop already happened in ffmpeg and is recorded
 * in public/footage/README.md beside the line that produced it. The element is sized from the
 * crop's own pixels, so "cover" and "contain" give the same picture and the fit is not a
 * decision this file has to make.
 *
 * =====================================================================================
 * WHAT IS THIS FILE'S, AND WHAT IS src/frag/Fragment.tsx's
 * =====================================================================================
 *
 * THE MOTION MODEL IS THAT FILE'S, reproduced rather than imported. `moveOf` there is not
 * exported and `Shot` bakes in that direction's grid, its hang band and its 7 degree tilt, so
 * reusing it would have meant editing a module the delivered ad renders through. The
 * instruction on src/frag/ is explicit and a re-render to prove it unchanged costs more than
 * forty lines of duplication. Every constant either file uses comes from
 * src/kinetic-native/motion.ts, so the two cannot drift on the numbers that matter.
 *
 * Four numbers below are not in motion.ts because that file was tuned against a dark ground,
 * and all four were re-measured on a render for a LIGHT one. They are that file's findings and
 * they are carried over rather than rediscovered: FADE_AT, ARRIVAL_CUT, CUT_FLOOR and
 * ARRIVAL_BLUR. The reasoning for each is under it.
 *
 * THE TILT IS NOT REPRODUCED, and that is this direction's one deliberate divergence in the
 * picture. See the note at the foot of ./ground.ts. The short version: the fragment ad is the
 * dimensional one, two films that share a ground, a palette, a script, a read and a shot plan
 * have to disagree about something a viewer can see, and a rotated plane under a 210px headline
 * puts two cameras on one frame. The SHADOW stays, which is what was actually doing the work of
 * lifting the object off the surface.
 *
 * =====================================================================================
 * THE MOTION IS THREE THINGS AND NOT ONE MORE
 * =====================================================================================
 *
 *   THE CURRENT. Every object drifts left at CRUISE for the whole of its shot, re-centred so
 *   the drift is symmetric about the grid and never accumulates. It is the carrier: four of the
 *   six fragments are deliberately still holds, because a fragment that is being drawn is a
 *   fragment you cannot read, so without it this film has four beats of frozen pixels.
 *
 *   THE SEAM. Technique 3, cut the curve, at every boundary except one: the outgoing object
 *   accelerates left on power4.in and dies mid path, the incoming enters from the right on the
 *   mirrored power4.out and is already moving when it appears. Partial travel is TRAVEL, 12% of
 *   THIS frame's width, 130px, and not the catalog's 230, which assumes a 1920 wide landscape.
 *
 *   THE ARRIVAL. Technique 2, the inverse zoom through, spent exactly once, on "duo locked".
 *   The playstyle chip recedes under blur and the DUO card arrives oversized and retracts. No x
 *   travel on either side of that seam, because a positional seam under a scale seam is two
 *   gestures at one cut and the eye reads the second one as the real one.
 *
 * There is no fourth thing. No idle float, no breathe, no parallax, no shadow that pulses.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { FRAGMENTS, type FragShot, type Vector } from "@/frag/plan";
import { CURVE, EASE, INVERSE, TRAVEL } from "@/kinetic-native/motion";

import { cruiseAt, MEASURE, PIECE_GAP, SHADOW, STAGE_Y, TOP_MAX, TOP_MIN, X0 } from "./ground";
import { CROPS } from "./plan";
import { Source } from "../v6/media";

/** Blur for the one inverse zoom seam. The catalog gives 10px for text scale subjects and 18 to
 * 20 for a full frame; the subject here is a 523px card and an 844px strip, and 20px on an
 * object carrying the app's own mono type smears it into a glitch rather than into speed. */
const ARRIVAL_BLUR = 14;

/**
 * TWO OPACITIES THE CATALOG SETS FOR A DARK GROUND AND A LIGHT GROUND HAS TO RESET, both
 * measured on a render rather than predicted, and both the same defect twice: an opacity that
 * reads as depth on off black reads as a HOLE on warm off white, because here the object is the
 * dark thing and the field is the bright one.
 *
 * FADE_AT replaces CURVE.fadeAt, 0.727. The rule behind that number is that the fade must
 * complete while the object is still accelerating, which the catalog states as 28% of the
 * TRAVEL. At 0.9 the fade completes at 66% of the travel, 85px of 130, still 88% of the object
 * on frame and still accelerating hard, so the rule survives. What it buys is the last two
 * frames before every cut, which at 0.727 showed bare ground.
 *
 * ARRIVAL_CUT replaces INVERSE.cut, 0.15, on the one reserved seam. Both halves of that gesture
 * meet at it by definition, so at 0.15 the swap frame was a near empty field with a blurred
 * grey smudge on it: a white flash in the middle of the film's payoff.
 */
const FADE_AT = 0.9;
const ARRIVAL_CUT = 0.42;

/**
 * What the outgoing object still has on the frame it is cut on, and it is 0.14 rather than 0
 * because 0 put a hole at every seam. A beat's Sequence ends on frame `frames - 1` and the next
 * begins on the frame after, so whatever the outgoing object is at on its last frame is the
 * whole picture below the type. A floor is also the more doctrinally correct shape: the rule is
 * CUT MID MOTION on both sides, and an object that has already faded to nothing before the cut
 * is not being cut, it is being dispensed with.
 */
const CUT_FLOOR = 0.14;

interface Move {
  x: number;
  scale: number;
  blur: number;
  opacity: number;
}

/**
 * The whole motion model as one function, so the entry and the exit cannot drift apart and both
 * halves of every seam are readable in one place.
 *
 * `frame` is local to the SHOT and `frames` is the shot's length. The cruise runs on the BEAT's
 * clock instead, which is what makes a two shot beat one continuous camera move: computing it
 * per shot re-centres it twice and puts a 32px jump in the middle of "send a message".
 */
const moveOf = (
  frame: number,
  frames: number,
  beatFrame: number,
  beatLength: number,
  enter: Vector,
  exit: Vector,
  /** Frames the ENTRY clock alone is advanced by, so the opening picture is already part way
   * through its arrival on frame zero. It does not touch the cruise or the exit. */
  lead: number,
): Move => {
  const cruise = cruiseAt(beatFrame, beatLength);
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

  // An "arrive" or "recede" side contributes no x, so the reserved gesture is scale alone. A
  // "hold" side contributes nothing at all: the object simply exists, already travelling, and
  // the cut is a velocity match rather than an unmarked seam.
  const enterX = enter === "curve" ? (1 - enterT) * TRAVEL : 0;
  const exitX = exit === "curve" ? -leaveT * TRAVEL : 0;

  const enterScale =
    enter === "arrive" ? INVERSE.entryScale + (1 - INVERSE.entryScale) * enterT : 1;
  const exitScale = exit === "recede" ? 1 + (INVERSE.exitScale - 1) * leaveT : 1;

  const enterBlur = enter === "arrive" ? (1 - enterT) * ARRIVAL_BLUR : 0;
  const exitBlur = exit === "recede" ? leaveT * ARRIVAL_BLUR : 0;

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
 * The pieces of a multi piece shot share one transform rather than carrying their own, so the
 * card and the action row on beat one travel as one object. Staggering them would be a fourth
 * transition type for a two element group and would also say they are two separate claims,
 * which they are not: a card and the three things you can do to it are one screen.
 */
export const Exhibit = ({
  shot,
  frames,
  from,
  beatLength,
  enter,
  exit,
  lead = 0,
}: {
  shot: FragShot;
  frames: number;
  /** Where this shot starts inside its beat. */
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
    // The rectangle actually drawn. Default is the whole crop, so a fragment with no entry in
    // CROPS goes through identical arithmetic and lands on identical pixels.
    const view = CROPS[piece.frag] ?? { x: 0, y: 0, width: sourceW, height: sourceH };
    const scale = piece.width / view.width;
    return {
      piece,
      height: Math.round(piece.width * (view.height / view.width)),
      // The whole clip at the crop's scale, pushed up and left so the crop's origin lands on
      // the object's. The object's own `overflow: hidden` does the cutting.
      film: {
        width: Math.round(sourceW * scale),
        height: Math.round(sourceH * scale),
        left: -Math.round(view.x * scale),
        top: -Math.round(view.y * scale),
      },
    };
  });
  const stack =
    sized.reduce((total, row) => total + row.height, 0) + PIECE_GAP * (sized.length - 1);

  // The hang band. The stack's top is where centring on the stage would put it, pulled into
  // [TOP_MIN, TOP_MAX] so a 113px chip cannot sit hundreds of pixels below the type with
  // nothing in between and a 745px pair cannot run down into the platform's own chrome.
  let cursor = Math.min(Math.max(STAGE_Y - stack / 2, TOP_MIN), TOP_MAX);

  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${move.x.toFixed(2)}px) scale(${move.scale.toFixed(4)})`,
        opacity: move.opacity,
        filter: move.blur > 0.05 ? `blur(${move.blur.toFixed(1)}px)` : undefined,
      }}
    >
      {sized.map(({ piece, height, film }) => {
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
              boxShadow: SHADOW,
              // Under the rounded corners. Every fragment is a region of an app screen, so its
              // own field is what a corner should reveal: without this a 24px radius shows a
              // sliver of ground through the antialiased edge and the card reads as cut out
              // rather than as an object. This film draws the DARK theme on the light ground,
              // which is the direction's thesis, so the fill is the app's off black.
              backgroundColor: "#0A0B09",
            }}
          >
            <div style={{ position: "absolute", ...film }}>
              <Source clip={FRAGMENTS[piece.frag].dark} from={0} fit="cover" />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
