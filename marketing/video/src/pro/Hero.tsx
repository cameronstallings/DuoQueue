/**
 * ONE OBJECT, FOR THE WHOLE FILM, THAT CHANGES WHAT IS WRITTEN ON IT.
 *
 * This is the device the rejected directions never used and it is the one that removes the
 * stutter. Measured, Uber f131-f138: the UberX card becomes the XL card WITHOUT LEAVING. Over
 * seven frames the title crossfades, the badge crossfades blue "Fastest" to yellow "Extra seat",
 * the subtitle crossfades, the car morphs sedan to van and the price changes last, while the card
 * scales 538 to 474 to 465 wide, executes a +/-2.9 degree in-plane wobble and the field flashes.
 *
 * The film never cuts to a second card. `src/frag/plan.ts` was six fragments, six entries and six
 * exits, which is six stutters, and Cameron heard all six of them in the read and saw all six of
 * them in the picture.
 *
 * A STATE is what the object currently is. Moving between two states is a MORPH: the box travels
 * from one rect to the other while the two pieces of footage crossfade inside it under
 * `object-fit: cover`, so the outgoing content crops rather than distorting and the incoming
 * content resolves out of a crop. Only the first state of a film ARRIVES; every state after it is
 * the same object with something else on it.
 *
 * THE BACKDROP is the second Z plane, and it exists because a single object on a field is a
 * photograph. It is the same footage, thrown far out of focus, at a fifth of the contrast, moving
 * at its OWN rate while the hero holds. Uber f372-432 is exactly this: the picker card holds
 * while a map layer behind it fades up, scales about 1.15 and translates. That is parallax, and
 * the rejected direction's answer to it was `CRUISE = 1.25` px per frame applied uniformly to
 * every object and to the type block, which is not parallax, it is a crawl.
 *
 * It is drawn small and scaled up rather than blurred at full size: a 46px blur over 1080x1920 is
 * one of the most expensive things a browser can be asked for, and a 270x480 plate at an 11px
 * blur scaled four times is the same picture for a sixteenth of the work.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { RECEDE } from "./film";
import { PAPER } from "./ground";
import { Fragment, heightOf, type FragName } from "./media";
import {
  arrive,
  EASE,
  GESTURE,
  gestureAmount,
  morphAt,
  MORPH,
  ramp,
  REST,
  type Pose,
} from "./motion";
import { Plane } from "./Plane";

export interface HeroState {
  /** Absolute frame this state begins on. */
  at: number;
  frag: FragName;
  width: number;
  radius?: number;
  /** How glossy this surface is. A whole phone screen is glass; a chip cut out of one is matte. */
  gloss?: number;
  /** The centre this state sits on, when it is not the film's object anchor. */
  cy?: number;
  /** Seconds into the clip, for a state that wants a different moment of the same file. */
  from?: number;
  /**
   * A NEW object rather than the same one carrying something else.
   *
   * The default is a morph, because the morph is the device that removes the stutter and it should
   * cost a flag to give it up. A state marks itself `arrive` only where the film genuinely cuts:
   * in direction B that is once, at the seam where the wipe crosses the frame, and the arrival is
   * the measured eight frame unwind rather than a fade.
   */
  arrive?: boolean;
}

export interface HeroPlan {
  states: readonly HeroState[];
  /** Absolute frames the mid-beat perspective gesture is spent on. Two in a film, at the most. */
  gestures: readonly number[];
  /** The object anchor. */
  cy: number;
}

const rectOf = (state: HeroState): { w: number; h: number; r: number } => ({
  w: state.width,
  h: heightOf(state.frag, state.width),
  r: state.radius ?? 26,
});

/**
 * The object at a given absolute frame.
 *
 * `focus` is 1 when the object owns the frame and 0 when it has receded behind a statement; see
 * RECEDE in ./film.ts for why the object moves rather than the type.
 */
export const Hero = ({
  plan,
  focus,
  lead = 0,
  extra,
}: {
  plan: HeroPlan;
  focus: number;
  lead?: number;
  /**
   * A direction's own camera on the object, applied ON TOP of the measured pose rather than
   * replacing any of it. Written as deltas and multipliers for exactly that reason: an `extra`
   * that overwrote `scale` would silently delete the arrival's oversize and the morph's dip, and
   * the bug would look like a tuning problem rather than a structural one.
   */
  extra?: {
    scaleMul?: number;
    smearAdd?: number;
    opacityMul?: number;
    rotXAdd?: number;
    rotYAdd?: number;
    zAdd?: number;
  };
}) => {
  const frame = useCurrentFrame();

  let index = 0;
  plan.states.forEach((state, i) => {
    if (frame >= state.at) {
      index = i;
    }
  });
  const state = plan.states[index];
  if (state === undefined) {
    return null;
  }
  const previous = index > 0 && state.arrive !== true ? plan.states[index - 1] : undefined;

  const morph = previous === undefined ? null : morphAt(frame, state.at);
  const blend = morph === null || morph.t >= 1 ? 1 : morph.t;

  const to = rectOf(state);
  const from = previous === undefined ? to : rectOf(previous);
  const shape = (a: number, b: number): number => Math.round(a + (b - a) * blend);
  const width = shape(from.w, to.w);
  const height = shape(from.h, to.h);
  const radius = shape(from.r, to.r);

  // The first state ARRIVES, and so does any state the plan marks. Everything else is the same
  // object, already here, with something else written on it.
  const base: Pose =
    index === 0 || state.arrive === true
      ? arrive(frame - state.at, index === 0 ? lead : 0)
      : { ...REST, opacity: 1 };

  // The mid-beat gesture, spent on the frames the plan names and nowhere else. It is
  // punctuation: bottom edge toward camera, right edge toward camera, out over nine frames and
  // back over five.
  const gesture = plan.gestures.reduce((most, at) => Math.max(most, gestureAmount(frame, at)), 0);

  const cy = state.cy ?? plan.cy;
  const z = RECEDE.z * (1 - focus);
  const pose: Pose = {
    rotX: base.rotX + GESTURE.rotX * gesture + (extra?.rotXAdd ?? 0),
    rotY: base.rotY + GESTURE.rotY * gesture + (extra?.rotYAdd ?? 0),
    rotZ: base.rotZ + (morph?.rotZ ?? 0),
    scale:
      base.scale *
      (morph?.scale ?? 1) *
      (1 - (1 - RECEDE.scale) * (1 - focus)) *
      (extra?.scaleMul ?? 1),
    smearX: base.smearX + (extra?.smearAdd ?? 0),
    smearY: base.smearY + (extra?.smearAdd ?? 0) * 0.22,
    opacity:
      base.opacity * (RECEDE.opacity + (1 - RECEDE.opacity) * focus) * (extra?.opacityMul ?? 1),
  };

  return (
    <Plane
      name="hero"
      pose={pose}
      cx={540}
      cy={cy}
      width={width}
      height={height}
      radius={radius}
      z={z + (extra?.zAdd ?? 0)}
      gloss={state.gloss ?? 0.3}
    >
      {/* Both pieces of footage live in the box at once for the seven frames of a morph, each
          filling it under `cover`, so the outgoing content crops away and the incoming content
          resolves out of a crop rather than either of them distorting. */}
      {previous !== undefined && blend < 1 ? (
        <AbsoluteFill style={{ opacity: 1 - blend }}>
          <Fragment frag={previous.frag} from={previous.from} startAt={previous.at} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ opacity: blend }}>
        <Fragment frag={state.frag} from={state.from} startAt={state.at} />
      </AbsoluteFill>
      {/* Atmospheric perspective on the way out, and nothing more.

          This used to run at 0.25 to hold a receded object down UNDER the statement, back when the
          object stayed at 46% and the two shared a frame. It does not any more: see RECEDE in
          ../film, where the object now leaves at 0.08 because compositing a headline over a phone
          is the exact thing Cameron objected to and the exact thing neither reference does.

          0.10 is what is left of it: enough that the object loses contrast as it goes, which is
          what stops a shrinking object from reading as a smaller object rather than a further one,
          and not enough to leave a grey veil on the paper on the way. */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(${PAPER},1)`,
          opacity: (1 - focus) * 0.1,
          pointerEvents: "none",
        }}
      />
    </Plane>
  );
};

/** Which state is current at a frame, for a caller that needs to know what the object is. */
export const stateAt = (plan: HeroPlan, frame: number): HeroState | undefined => {
  let found: HeroState | undefined;
  plan.states.forEach((state) => {
    if (frame >= state.at) {
      found = state;
    }
  });
  return found;
};

/**
 * The far plane. Same footage, thrown out of focus, moving at its own rate.
 *
 * The scale ramp runs across the STATE's life rather than the film's, so the backdrop is always
 * mid-travel and never parks: it starts moving when the object changes and it is still moving
 * when the object changes again, which is the doctrine's rule about motion that performs.
 *
 * THE OPACITY IS A GROUND NUMBER AND IT CAME DOWN WITH THE GROUND. At 0.22 a blurred near-black
 * plate over off-black was a second dark layer at a fifth of the contrast, which is what the
 * reference's far plane is. The same 0.22 over paper is a grey haze laid across the whole frame
 * for the length of the film: it drags the ground about 30 luma off the value every other
 * decision in ./ground was measured against, and it makes the film look like it was shot through
 * a dirty window. Uber's own far plane is a LIGHT map behind a light card. At 0.10 the plate is
 * still plainly moving at its own rate behind the hero and the ground is still the ground.
 */
export const Backdrop = ({ plan, opacity = 0.1 }: { plan: HeroPlan; opacity?: number }) => {
  const frame = useCurrentFrame();
  const state = stateAt(plan, frame);
  if (state === undefined) {
    return null;
  }
  const life = Math.max(1, frame - state.at);
  const grow = ramp(life, 0, 150, 1.0, 1.16, EASE.linear);
  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity }}>
      <AbsoluteFill
        style={{
          // A quarter-size plate scaled up: the same picture as a full-frame 44px blur, for a
          // sixteenth of the compositing cost.
          width: 270,
          height: 480,
          transformOrigin: "0 0",
          transform: `scale(${(4 * grow).toFixed(4)}) translate(${((1 - grow) * 34).toFixed(1)}px, ${((1 - grow) * 60).toFixed(1)}px)`,
          filter: "blur(11px) saturate(0.65)",
        }}
      >
        <Fragment frag={state.frag} from={state.from} startAt={state.at} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** How far through a morph the object is at a frame, for the field flash that fires with it. */
export const morphIgnition = (plan: HeroPlan, frame: number): number =>
  plan.states.some((state) => state.at > 0 && frame >= state.at && frame < state.at + MORPH.frames)
    ? 1
    : 0;
