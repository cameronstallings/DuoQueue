/**
 * One cut. Full bleed, always moving, graded well past neutral.
 *
 * There is no scrim here and no letterbox, which is the difference between this and
 * `components/Clip.tsx`. A scrim is what a brand video puts under its type; the captions in
 * this direction carry their own edge, so the footage keeps its whole frame and the corners
 * are handled by a falloff instead of a ramp.
 */
import {
  AbsoluteFill,
  getStaticFiles,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { clips } from "@/data/clips";
import { FPS } from "@/lib/scale";

import { consumes } from "./framing";
import { BACKDROP, GRADE, VIGNETTE } from "./look";
import type { Framing, Shot as ShotCut } from "./types";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const transformOf = (framing: Framing) =>
  `translate(${framing.x.toFixed(2)}px, ${framing.y.toFixed(2)}px) scale(${framing.scale.toFixed(4)})`;

export const Shot = ({ shot }: { shot: ShotCut }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clip = clips[shot.clip];
  const path = `footage/${clip.file}`;

  // public/footage is gitignored and filled by hand, so a missing file is a real state. It is
  // fatal here rather than drawn as a panel: this direction is judged on finished frames, and
  // a placeholder in one of them is a failed render whether or not it says so politely.
  if (!getStaticFiles().some((asset) => asset.name === path)) {
    throw new Error(`Direction A wants public/${path}, which is not on this disk.`);
  }

  // Linear, not eased. An ease-out drift decelerates into stillness at the end of every cut,
  // which is the exact thing this direction exists to avoid; a constant push reads as a camera
  // that never stops.
  const drift = interpolate(frame, [0, Math.max(shot.frames - 1, 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Settles in about a third of a second with a touch of overshoot, so a punched cut lands
  // like a hand on a trackpad rather than like a keyframe.
  const settle = shot.punch
    ? spring({ fps, frame, config: { damping: 13, stiffness: 190, mass: 0.7 } })
    : 1;

  const framing: Framing = {
    scale: mix(shot.from.scale, shot.to.scale, drift) + (shot.punch ?? 0) * (1 - settle),
    x: mix(shot.from.x, shot.to.x, drift),
    y: mix(shot.from.y, shot.to.y, drift),
  };

  const rate = shot.rate ?? 1;
  const trimBefore = Math.round((clip.from + shot.start) * FPS);
  // A tenth of a second of tail. checkShots has already proved the clip is long enough for it.
  const trimAfter = trimBefore + Math.ceil((consumes(shot) + 0.1) * FPS);

  return (
    <AbsoluteFill style={{ backgroundColor: BACKDROP, overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: GRADE }}>
        <AbsoluteFill style={{ transform: transformOf(framing), transformOrigin: "center center" }}>
          <OffthreadVideo
            src={staticFile(path)}
            trimBefore={trimBefore}
            trimAfter={trimAfter}
            playbackRate={rate}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundImage: VIGNETTE }} />
    </AbsoluteFill>
  );
};
