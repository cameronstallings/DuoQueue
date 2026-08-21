/**
 * DIRECTION A - DEVICE LED.
 *
 * A phone as a real object in studio light, and the app's own interface leaving its surface.
 *
 * =====================================================================================
 * THE IDEA, AND WHY IT IS NOT THE SAAVI REFERENCE
 * =====================================================================================
 *
 * The food delivery reel does a crude version of this and its crudeness is instructive: two flat
 * devices at a fixed tilt on a flat colour field, identical scale on both, no camera, no light,
 * no screen events. It is a mockup preset, and a mockup preset is exactly what Cameron looked at
 * and called cheap.
 *
 * What makes a device shot expensive is not the device, it is the LIGHT and the EVENTS. So:
 *
 *   THE DEVICE IS LIT. A specular band travels across the glass as a function of its rotateY, a
 *   hairline of the studio's light runs the outside of the body, and an elliptical contact pool
 *   under it squashes and slides with the tilt. Turn the phone and the light moves. Neither
 *   reference has any of this.
 *
 *   THE INTERFACE LEAVES THE GLASS. This is the direction's whole argument and it is the answer to
 *   "you cannot really see the app". A screen recording drawn at device scale renders the app's
 *   own chips at about half their recorded size, which is the legibility problem three cuts in a
 *   row have had. So the chip the sentence is about DETACHES from the exact pixels it lives at,
 *   travels forward in Z to 320, and holds in front of the device at 640 to 720px wide - wider
 *   than the phone it came off - while the glass behind it racks out of focus. The crop rectangles
 *   in public/footage/README.md are in the recording's own coordinates, so `onGlass` can start
 *   each flight at the place that element actually is on that screen. Nothing is approximated.
 *
 *   ONE THING LEAVES AT A TIME. The previous element returns to the glass as the next one lifts,
 *   overlapping by six frames, so the film is always mid-motion and there is never a stack of
 *   floating chips. That is the measured "one peer element" with a handover instead of a cut.
 *
 * =====================================================================================
 * THE SHAPE
 * =====================================================================================
 *
 *   f  0-133   the game, as a 940px plate on the ground, the only shot that is not the product
 *              its plate recedes, defocuses and washes toward the paper as the statement builds
 *   f133       THE DEVICE ARRIVES out of the receding plate: rotated 18 degrees, 18% oversized,
 *              smeared, unwinding to square over eight frames, with a colour flood on the frame
 *              it lands. Both sides of that seam are SHRINKING, which is the Z sign rule
 *   f143       the perspective gesture, spent once, on the product
 *   f239       ">> 3 GAMES IN COMMON" lifts off the glass at 214,1110 and flies to 640px wide
 *   f285       it returns as "ROCKET LEAGUE . Ranked Grinder" lifts from 74,924
 *   f379       DUO LOCKED lifts from the middle of the card
 *   f415       the Send a message button lifts from under it
 *   f451       the device turns away, 34 degrees, and recedes; the game arrives oversized and
 *              retracts onto the ground for the last clause
 *   f487       the closing hold, 19 frames, on the only image outside the app
 *   f506       the end card
 *
 * The device is on screen for 318 of the 551 frames and rotates on five of them. It is never
 * still for a beat and it never wobbles between beats.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { Soundtrack } from "@/audio/Soundtrack";
import type { Cta } from "@/config/phase";

import { End } from "../End";
import { Field, Flash, Flip, Grain } from "../Field";
import { clauseFrames, focusAt, RECEDE, statementPlan, statementsOf } from "../film";
import { CENTRE_X, elevation, GROUND, INK, OBJECT_Y, PAPER } from "../ground";
import { Fragment, heightOf } from "../media";
import {
  arrive,
  EASE,
  flashAt,
  FLIP_FRAMES,
  GESTURE,
  gestureAmount,
  ramp,
  REST,
} from "../motion";
import { Plane, Stage } from "../Plane";
import type { ProScript } from "../script";
import { AppThemed } from "../theme";
import { beatFrames, beatStarts, bodyFrames, END_FRAMES } from "../timing";
import { groupSize, useFaces, wordCount } from "../type";
import { Words } from "../Words";

import { Contact, Device, deviceHeight, onGlass } from "./Device";

/**
 * The device, at rest.
 *
 * 640 of 1080 is 59%, in the lower half of the measured 56-78% band, and it came down from 760
 * when the ground came up. On off-black a 760px device is 1624px tall, 85% of the frame height,
 * and its top edge sits 48px off the top of the frame: it read as an object emerging out of a
 * field it was nearly the same colour as. On paper the same object is a near-black slab covering
 * three fifths of a bright frame, and the thing it covers is the ground the whole direction is
 * now built on. At 640 the body is 1368 tall with 176px of paper above it and 336 below, so it
 * SITS on the ground instead of replacing it.
 *
 * It also sharpens the direction's own argument rather than softening it. The chips that lift off
 * the glass fly to 640 and 720px wide, which is now as wide as the device or wider, so the app is
 * literally larger off the phone than on it. That is the answer to "you cannot really see the
 * app", and at 760 the lifted chip was still the smaller of the two objects.
 */
const DEVICE_W = 640;
const DEVICE_CY = 860;

/**
 * The gameplay plate, and it is an OBJECT on the ground now rather than a full bleed image.
 *
 * On off-black a full bleed plate cost nothing, because the plate is dark and the ground was
 * dark: the frame never visibly lost its ground. On paper it is the largest possible ground
 * change, and holding ONE ground from the first frame to the last is reference point 1 - all
 * three reels Cameron sent do it and not one of them ever cuts the ground away. So the plate
 * joins the film instead of interrupting it: 940 of 1080, which is the widest object in any of
 * the three directions and 70px of paper clear on each side, drawn in the film's own camera with
 * the film's own shadow under it. Direction B already draws this same footage this way at 880 and
 * direction C at 1010, so this is the set agreeing with itself rather than a fourth rule.
 *
 * Every frame of its motion survives: the slow push across the shot, the recede and defocus under
 * the statement, and the inverse zoom that hands to the brand.
 */
const PLATE_W = 940;

/**
 * The crop rectangles, in the recording's own 1180x2556 pixels, copied from the table in
 * public/footage/README.md. They are the ONLY reason an element can lift off from where it
 * actually is; guessing a position here is what would make the whole gesture read as a graphic.
 */
const GLASS = {
  games: [345, 1790, 490, 100],
  role: [120, 1490, 670, 90],
  locked: [330, 425, 520, 640],
  send: [55, 1235, 1070, 206],
} as const;

interface LiftShot {
  at: number;
  until: number;
  frag: "games" | "role" | "locked" | "send";
  rect: readonly [number, number, number, number];
  /** How wide it is once it has arrived in front of the device. */
  width: number;
}

/** Frames the flight off the glass takes. Longer than the eight frame arrival because the element
 * is travelling a real distance as well as unwinding, and the reference's own long arrival, the
 * ClickUp window, takes ten. */
const FLIGHT = 12;

const Lift = ({
  shot,
  focus,
  deviceRotY,
}: {
  shot: LiftShot;
  focus: number;
  deviceRotY: number;
}) => {
  const frame = useCurrentFrame();
  const start = onGlass({ cx: CENTRE_X, cy: DEVICE_CY, width: DEVICE_W }, shot.rect);

  // Out over FLIGHT frames, and back over the last eight of its window, so the handover to the
  // next element is a return rather than a disappearance.
  const out = ramp(frame, shot.at, shot.at + FLIGHT, 0, 1, EASE.quintOut);
  const back = ramp(frame, shot.until - 8, shot.until, 0, 1, EASE.cubicIn);
  const t = Math.max(0, out - back);

  const width = Math.round(start.width + (shot.width - start.width) * t);
  const cx = CENTRE_X + (start.cx - CENTRE_X) * (1 - t);
  const cy = start.cy + (OBJECT_Y - start.cy) * t;

  const air = arrive(frame - shot.at);
  return (
    <Plane
      name={`lift-${shot.frag}`}
      pose={{
        ...REST,
        // It leaves the glass carrying the glass's own rotation and unwinds out of it, which is
        // what "it was part of that surface a moment ago" looks like.
        rotY: deviceRotY * (1 - t) + air.rotY * 0.4,
        rotX: air.rotX * 0.4,
        rotZ: air.rotZ * 0.5,
        scale: 1,
        smearX: air.smearX * 0.7,
        smearY: air.smearY * 0.7,
        opacity: t < 0.02 ? 0 : 1,
      }}
      cx={cx}
      cy={cy}
      width={width}
      height={heightOf(shot.frag, width)}
      radius={Math.round(10 + 16 * t)}
      // It travels toward the camera, and it recedes with everything else when the words arrive.
      z={320 * t + RECEDE.z * (1 - focus) * 0.6}
      gloss={0.2}
      // The scrim below washes the CONTENT toward the paper; the shadow and the hairline are
      // outside it and have to be told, or a receded light chip is an empty outlined box sitting
      // on the statement. Same number, stated once. See the `veil` note in ../surface.
      veil={(1 - focus) * 0.72}
    >
      <Fragment frag={shot.frag} startAt={shot.at} />
      {/* THE LIFTED CHIP RECEDES LIKE EVERY OTHER OBJECT IN THE THREE FILMS, and on the dark
          ground it did not have to. There the statement was pale ink and the chip under it was
          near black, so a word could cross a chip and still be read. Here both are near black:
          "lock the duo," laid across the DUO LOCKED banner at full contrast is two dark things in
          the same 400 pixels. So the chip takes the same wash toward the paper the hero takes in
          ../Hero and the plate takes above, and the type has a ground again. */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(${PAPER},1)`,
          opacity: (1 - focus) * 0.72,
          pointerEvents: "none",
        }}
      />
    </Plane>
  );
};

/** The game, as the widest object in the film. The only shot that is not the product, at both
 * ends of it. See PLATE_W for why it stopped being full bleed when the ground went light. */
const Plate = ({
  frame,
  frames,
  focus,
  pull,
  startAt,
}: {
  frame: number;
  frames: number;
  focus: number;
  pull: number;
  /** The composition frame this plate mounted on. `frame` here is already local to the plate, so
   * the clip underneath it needs the absolute frame told to it separately: frag-play is 57 frames
   * and the closing plate runs 66, which is the black tail the first render ended on. */
  startAt: number;
}) => {
  // A slow push across the whole shot. It starts moving at the top of the beat and it is still
  // moving at the bottom, so it never parks; the plate is a camera on a landscape capture that is
  // already cropped by the frame, so two more percent costs nothing that is not already gone.
  const grow = ramp(frame, 0, frames, 1.06, 1.14, EASE.linear);
  const recede = 1 - focus;
  const height = heightOf("play", PLATE_W);
  const { shadow } = elevation(0, 0);
  return (
    <div
      style={{
        position: "absolute",
        left: Math.round(CENTRE_X - PLATE_W / 2),
        top: Math.round(OBJECT_Y - height / 2),
        width: PLATE_W,
        height,
        borderRadius: 26,
        backgroundColor: INK.app,
        boxShadow: shadow,
        overflow: "hidden",
        // The plate's own depth: the inverse zoom at either end of the film, and a small pull back
        // as it hands the frame to the statement. The push below lives INSIDE the plate so the
        // picture travels while the object does not grow.
        transform: `scale(${(pull * (1 - 0.06 * recede)).toFixed(4)})`,
      }}
    >
      <AbsoluteFill
        style={{
          transform: `scale(${(grow * (1 - 0.12 * recede)).toFixed(4)})`,
          filter: recede > 0.02 ? `blur(${(recede * 9).toFixed(1)}px)` : undefined,
        }}
      >
        <Fragment frag="play" startAt={startAt} />
      </AbsoluteFill>
      {/* The recede, washing toward the paper rather than toward black, so the statement builds on
          something the film's own near-black ink can be read on. Same law as every other recede in
          the three directions; see section 3 of ../ground. It is heavier here than the scrim in
          ../Hero because a plate is a PHOTOGRAPH: the hero's scrim sits over app UI, which is flat
          and has one dark value, and this one sits over a lit stone wall with a rifle across it. */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(${PAPER},1)`,
          opacity: recede * 0.7,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export const ProA = ({ script, cta }: { script: ProScript; cta: Cta }) => {
  const loaded = useFaces();
  const frame = useCurrentFrame();

  const frames = beatFrames(script);
  const starts = beatStarts(script);
  const body = bodyFrames(script);

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  const statements = statementsOf(script, starts, frames);
  const focus = focusAt(frame, statements);

  const b1 = starts[1] ?? 0;
  const b2 = starts[2] ?? 0;
  const b3 = starts[3] ?? 0;
  const clause = clauseFrames(frames[3] ?? 1, 3);
  /** The frame the device turns away and the game comes back. */
  const leaves = b3 + clause * 2;

  const lifts: LiftShot[] = [
    { at: b2 + 4, until: b2 + 52, frag: "games", rect: GLASS.games, width: 640 },
    { at: b2 + 46, until: b2 + 104, frag: "role", rect: GLASS.role, width: 700 },
    { at: b3 + 2, until: b3 + clause + 2, frag: "locked", rect: GLASS.locked, width: 470 },
    { at: b3 + clause - 4, until: leaves, frag: "send", rect: GLASS.send, width: 720 },
  ];

  // THE DEVICE'S OWN CAMERA. It arrives at b1, gestures once at b1+10, and turns away at `leaves`.
  // Nothing else moves it, which is the difference between a device in a film and a device in a
  // mockup: the tilt exists for the frames it means something and is gone the rest of the time.
  const air = arrive(frame - b1);
  const gesture = gestureAmount(frame, b1 + 10);
  const away = ramp(frame, leaves, leaves + 14, 0, 1, EASE.cubicIn);
  const deviceRotY = air.rotY + GESTURE.rotY * gesture + 34 * away;
  const devicePose = {
    rotX: air.rotX + GESTURE.rotX * gesture,
    rotY: deviceRotY,
    rotZ: air.rotZ,
    scale: air.scale * (1 - (1 - RECEDE.scale) * (1 - focus)) * (1 - 0.14 * away),
    smearX: air.smearX + 16 * away,
    smearY: air.smearY + 4 * away,
    opacity: air.opacity * (RECEDE.opacity + (1 - RECEDE.opacity) * focus) * (1 - away),
  };

  // The glass racks out of focus while something is floating in front of it, so the floating
  // element is the brightest and the sharpest object on the frame rather than merely the nearest.
  const lifted = lifts.reduce(
    (most, shot) =>
      Math.max(
        most,
        Math.max(
          0,
          ramp(frame, shot.at, shot.at + FLIGHT, 0, 1, EASE.quintOut) -
            ramp(frame, shot.until - 8, shot.until, 0, 1, EASE.cubicIn),
        ),
      ),
    0,
  );

  // The two plate windows. The opening one recedes into the device's arrival; the closing one
  // arrives oversized and retracts, which matches the sign of the device receding away from it.
  const plateIn = frame < b1 + 10;
  const plateOut = frame >= leaves - 6 && frame < body;
  const plateReturn = ramp(frame, leaves - 6, leaves + 12, 1.18, 1, EASE.quintOut);
  const plateLeave = ramp(frame, b1 - 8, b1 + 10, 1, 0.84, EASE.cubicIn);

  const flash = Math.max(flashAt(frame, b1 + 2), flashAt(frame, b2 + 4), flashAt(frame, b3 + 2));
  const pull = ramp(frame, body - 9, body, 0, 1, EASE.cubicIn);

  return (
    <Field>
      <Soundtrack id={script.id} />

      {plateIn ? (
        <Plate
          frame={frame}
          frames={b1 + 10}
          startAt={0}
          focus={focus}
          pull={plateLeave * (1 - 0.4 * ramp(frame, b1 - 2, b1 + 10, 0, 1, EASE.cubicIn))}
        />
      ) : null}
      {plateOut ? (
        <Plate
          frame={frame - (leaves - 6)}
          frames={body - (leaves - 6)}
          startAt={leaves - 6}
          focus={focus}
          pull={plateReturn * (1 - 0.2 * pull)}
        />
      ) : null}

      {frame >= b1 - 6 && frame < leaves + 16 ? (
        <Stage>
          <Contact
            cx={CENTRE_X}
            // 48px under the body's own bottom edge, computed rather than typed, so the pool
            // follows the device if its size ever moves again.
            cy={DEVICE_CY + Math.round(deviceHeight(DEVICE_W) / 2) + 48}
            width={DEVICE_W}
            rotX={devicePose.rotX}
            rotY={devicePose.rotY}
            lift={1 - focus}
          />
          <Device
            pose={devicePose}
            cx={CENTRE_X}
            cy={DEVICE_CY}
            width={DEVICE_W}
            defocus={lifted}
            z={RECEDE.z * (1 - focus)}
            startAt={b1 - 6}
          />
          {lifts.map((shot) =>
            frame >= shot.at && frame < shot.until ? (
              <Lift key={shot.frag} shot={shot} focus={focus} deviceRotY={deviceRotY} />
            ) : null,
          )}
        </Stage>
      ) : null}

      {statements.map((statement) => {
        if (frame < statement.at || frame >= statement.at + statement.window) {
          return null;
        }
        const words = wordCount(statement.lines);
        const shape = statementPlan(statement.window, words, statement.solo);
        return (
          <Words
            key={statement.at}
            name={`a${String(statement.at)}`}
            lines={statement.lines}
            keyWord={statement.key}
            size={groupSize(statement.lines)}
            frame={frame - statement.at - shape.start}
            cadence={shape.cadence}
            exitAt={shape.exitAt - shape.start}
          />
        );
      })}

      <Flash amount={flash} />

      <Sequence from={body} durationInFrames={END_FRAMES} layout="none">
        <End cta={cta} />
      </Sequence>

      <Grain />
      <Flip amount={ramp(frame, 0, FLIP_FRAMES, 1, 0)} />
    </Field>
  );
};

/**
 * THE SAME FILM, SHOT IN THE APP'S OTHER THEME.
 *
 * Not a variant and not a setting: the identical component, the identical script, read, mix, beat
 * table, schedule, ground, grid, type, wipe, flood and end card, wrapped in the one context that
 * decides which column of the footage table ../media reads and which surface law an object made
 * of that footage obeys. See ../theme.tsx for the measurement that makes the second half of that
 * sentence necessary and for what the light law actually does.
 *
 * Put the two files side by side and every statement builds on the same frame, which is the only
 * arrangement under which the comparison Cameron recorded both themes for means anything.
 */
export const ProALight = (props: { script: ProScript; cta: Cta }) => (
  <AppThemed theme="light">
    <ProA {...props} />
  </AppThemed>
);
