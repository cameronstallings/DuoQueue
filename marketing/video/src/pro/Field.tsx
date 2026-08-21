/**
 * THE FIELD. The ground the film is played on, and the three things that are allowed to happen
 * to it.
 *
 * The reference's background is NOT one colour, which is the finding the rejected direction
 * inverted: it held one warm off-white for the whole film and put every event on the objects. In
 * the Uber reel a full-frame colour flood arrives on a beat and decays, twice, and the film
 * bookends itself with a luminance flip. Measured:
 *
 *   blue    in f102-f108 (6f), peak f108 (ONE FRAME), out f108-f115 (7f), 13f total, #C7E2FB
 *   yellow  in f130-f134 (4f), peak f134 (ONE FRAME), out f134-f140 (6f), 10f total, #FAF79D
 *   flip    black to white f16-f25: 24, 48, 73, 98, 122, 147, 173, 198, 224, 249
 *           ten frames, perfectly linear, no easing at either end
 *
 * ON THIS GROUND THE FLOOD IS THE MEASUREMENT ITSELF. The dark cut had to invert it, lifting the
 * frame toward the accent at a tenth of an alpha because on off-black a 10% chartreuse veil is
 * the same size of event a 25% pastel veil is on white. On paper no inversion is needed: the
 * frame washes toward a pale, exactly as the reference's does, and the pale is the volt family's
 * own. See FLOOD in ./ground.
 *
 * IT MULTIPLIES RATHER THAN COVERS, and that was measured on a render rather than reasoned. The
 * first light cut laid the pale over everything at an ordinary alpha, and on the frame the flood
 * peaks the hero card was ERASED: the object the film is about went pale green for four frames.
 * The reference does not have that problem because its card is white and its ground is white, so
 * a flood over both changes both by the same proportion. Ours is a near-black object on paper.
 * A multiply is the light rather than the paint: it takes the ground from (246,243,234) to about
 * (227,240,167) and leaves a near-black card at (9,11,6) essentially where it was, which is what
 * a coloured lamp swung across a table actually does.
 *
 * `screen` was the dark cut's blend and it had to go either way, because on a near-white field it
 * does nothing at all.
 *
 * THE STREAK FIELD is the cheapest thing in the reference and the one that makes a fast move read
 * as fast rather than as abrupt: Uber f222-f234 is thin 1 to 3px lines at scattered y, moving
 * leftward AT DIFFERENT RATES. The different rates are the whole point; one rate is a wipe. They
 * are drawn in the film's own ink, so on this ground they are dark lines over a pale field, which
 * is what the reference reel actually shows.
 *
 * THE GRAIN is not a stylistic filter. A 1080x1920 field of one near-white value bands in H.264:
 * the codec quantises a slow gradient into visible steps and a large soft sweep is the worst case
 * for it. A whisper of noise dithers the step away. At 0.05 under an overlay blend it is
 * invisible as texture and does the job.
 */
import { AbsoluteFill, staticFile } from "remotion";

import { FLOOD, GROUND, INK } from "./ground";

export const Field = ({ children }: { children?: React.ReactNode }) => (
  <AbsoluteFill style={{ backgroundColor: GROUND.base }}>
    <AbsoluteFill style={{ backgroundImage: GROUND.sweep }} />
    <AbsoluteFill style={{ backgroundImage: GROUND.pool }} />
    {children}
  </AbsoluteFill>
);

export const Grain = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      backgroundImage: `url(${staticFile("noise.png")})`,
      backgroundRepeat: "repeat",
      mixBlendMode: "overlay",
      opacity: 0.05,
    }}
  />
);

/**
 * The colour flood. `amount` comes from `flashAt` in ./motion, so its shape is the measured
 * 4-in / 1-held / 6-out and not a fade.
 */
export const Flash = ({ amount, colour = FLOOD }: { amount: number; colour?: string }) => {
  if (amount <= 0.002) {
    return null;
  }
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colour,
        opacity: amount,
        mixBlendMode: "multiply",
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * The bookend flip. Ten frames, linear, no easing, exactly as measured, and on this ground it is
 * the measurement rather than an inversion of it: Uber's own bookend runs black to white over
 * f16-f25. The film opens out of black onto the paper rather than fading up an image.
 */
export const Flip = ({ amount }: { amount: number }) => {
  if (amount <= 0.002) {
    return null;
  }
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", opacity: amount, pointerEvents: "none" }} />
  );
};

/**
 * Speed streaks, at different rates.
 *
 * Seeded from the index rather than from Math.random, because a render that draws different noise
 * on a retry is not reproducible and Remotion may render any frame in any order on any thread.
 */
const STREAKS = Array.from({ length: 14 }, (_, i) => ({
  y: ((i * 137) % 100) / 100,
  // 0.55 to 1.55 of the base rate. Two streaks never share one.
  rate: 0.55 + (((i * 61) % 100) / 100),
  thickness: 1 + (i % 3),
  length: 90 + ((i * 53) % 260),
  alpha: 0.16 + (((i * 29) % 40) / 100),
}));

export const Streaks = ({
  frame,
  frames,
  /** Pixels the base rate travels over the whole window. Negative is leftward, the film's
   * current. */
  travel = -1900,
  opacity = 1,
}: {
  frame: number;
  frames: number;
  travel?: number;
  opacity?: number;
}) => {
  const t = Math.min(1, Math.max(0, frame / Math.max(1, frames)));
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none", opacity }}>
      {STREAKS.map((streak, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${String(streak.y * 100)}%`,
            left: 1080,
            width: streak.length,
            height: streak.thickness,
            backgroundColor: INK.type,
            opacity: streak.alpha,
            transform: `translateX(${(travel * streak.rate * t).toFixed(1)}px)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/**
 * The velocity-matched wipe.
 *
 * Uber f214-f220: the black panel edge crosses 698, 655, 596, 516, 405, 203, 0 - deltas of 43,
 * 59, 80, 111, 202, accelerating - in SEVEN FRAMES across 720px with an 80px feather. Critically,
 * the type is exiting leftward at the same time and THE PANEL CHASES IT OFF: same direction,
 * matched velocity, so the seam carries the momentum through instead of interrupting it.
 *
 * The panel has a FINITE WIDTH and keeps going, rather than covering and then being removed. It
 * enters from the right, spans the frame at the halfway point, and leaves off the left, so the
 * shot after it is revealed by the same move that hid the shot before it. A panel that covers and
 * then fades is two events; this is one.
 *
 * `t` runs 0 to 1 across the whole crossing. The frame is fully covered at t = 0.5.
 */
export const Wipe = ({
  t,
  /** The app's own off-black, which is also what the measured panel is: Uber wipes a BLACK panel
   * across a white ground, so on this ground the seam is the reference rather than a reading of
   * it, and the panel is made of the same off-black every fragment in the film is made of. */
  colour = INK.app,
  feather = 120,
}: {
  t: number;
  colour?: string;
  feather?: number;
}) => {
  if (t <= 0 || t >= 1) {
    return null;
  }
  const width = 1080 + feather * 2;
  const x = 1080 - t * (1080 + width);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: x,
          width,
          backgroundImage: `linear-gradient(to right, transparent 0px, ${colour} ${String(feather)}px, ${colour} ${String(width - feather)}px, transparent ${String(width)}px)`,
        }}
      />
    </AbsoluteFill>
  );
};
