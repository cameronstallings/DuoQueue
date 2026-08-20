/**
 * The four things painted over the cut: flashes, shake, a vignette and grain.
 *
 * They exist for one reason. A montage assembled from a phone screen recording and a 1440p
 * game capture is two different pictures with two different noise floors, and cutting between
 * them every half second makes that obvious. A shared grain and a shared vignette put both
 * halves behind the same glass, and the flashes and the shake give the cuts a physical cause.
 */
import { AbsoluteFill, interpolate, random, staticFile, useCurrentFrame } from "remotion";

import type { Ink } from "./edit";
import { HOT, INK, VOID, VOLT } from "./palette";

const FLASH_INK: Record<Ink, string> = { hot: HOT, volt: VOLT, ink: INK, void: VOID };

export interface Flash {
  at: number;
  frames: number;
  ink: Ink;
}

export interface Hit {
  at: number;
  power: number;
}

/** How long a hit keeps ringing. Ten frames is a third of a second, which is about as long as
 * a shake can run before it stops reading as impact and starts reading as a broken render. */
const SHAKE_FRAMES = 10;

/** Sub-pixel motion is invisible after H.264, so the amplitude has to be big enough to survive
 * the encoder. The frame is scaled up by SHAKE_COVER to hide the edges this drags in. */
export const SHAKE_COVER = 1.06;

export const shakeAt = (frame: number, hits: Hit[]): { x: number; y: number; rotate: number } => {
  let x = 0;
  let y = 0;
  let rotate = 0;
  for (const hit of hits) {
    const since = frame - hit.at;
    if (since < 0 || since > SHAKE_FRAMES) {
      continue;
    }
    const decay = Math.pow(1 - since / SHAKE_FRAMES, 2) * hit.power;
    x += Math.sin(since * 2.1) * 22 * decay;
    y += Math.cos(since * 1.7) * 16 * decay;
    rotate += Math.sin(since * 2.6) * 0.55 * decay;
  }
  return { x, y, rotate };
};

/** A flash is one to three frames. Longer than that and it is a transition, which is the thing
 * this direction is trying not to have. `void` holds flat instead of fading, because the turn
 * between the two acts is a hole in the video rather than a bloom over it. */
export const Flashes = ({ flashes }: { flashes: Flash[] }) => {
  const frame = useCurrentFrame();
  const live = flashes.filter((flash) => frame >= flash.at && frame < flash.at + flash.frames);

  return (
    <>
      {live.map((flash) => {
        const since = frame - flash.at;
        const opacity =
          flash.ink === "void"
            ? 1
            : interpolate(since, [0, flash.frames], [0.92, 0], { extrapolateRight: "clamp" });
        return (
          <AbsoluteFill
            key={`${flash.at}-${flash.ink}`}
            style={{ backgroundColor: FLASH_INK[flash.ink], opacity }}
          />
        );
      })}
    </>
  );
};

/** Corners pulled down so the eye lands in the middle of the frame and so white type has
 * something to sit against wherever a shot happens to be bright. */
export const Vignette = () => (
  <AbsoluteFill
    style={{
      backgroundImage:
        "radial-gradient(ellipse 78% 62% at 50% 46%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.32) 72%, rgba(0,0,0,0.66) 100%)",
    }}
  />
);

/** The same grain tile the app uses, retiled every frame so it moves. A static grain over
 * moving footage reads as a dirty lens; a moving one reads as film. */
export const Grain = () => {
  const frame = useCurrentFrame();
  const x = Math.floor(random(`grain-x-${frame}`) * 128);
  const y = Math.floor(random(`grain-y-${frame}`) * 128);

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("noise.png")})`,
        backgroundRepeat: "repeat",
        backgroundPosition: `${x}px ${y}px`,
        opacity: 0.075,
        mixBlendMode: "overlay",
      }}
    />
  );
};
