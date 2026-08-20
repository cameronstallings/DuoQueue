/**
 * One shot of the montage: a trimmed, speed-ramped, punching-in piece of footage with a grade
 * on it and, for most of them, a whip into place.
 *
 * Three things here are doing the work the daily formats do not do.
 *
 * The frame is always moving. Every shot has a start and end scale and interpolates between
 * them, so even a 0.4s cut has direction. The zoom is anchored on a focus point rather than
 * on the middle of the frame, because the app footage puts its subject in the top third and a
 * centre-anchored punch would zoom into empty background.
 *
 * The speed is a curve, not a number. See timing.ts: the two poles start near full speed and
 * snap to a quarter of it, which is the effect the whole direction is built around.
 *
 * And a cut is rarely just a cut. A whip translates and smears the incoming shot for four
 * frames; a slam drops it in oversized. Both are short enough to read as impact rather than
 * as a transition anybody has to sit through.
 */
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";

import { clips } from "@/data/clips";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";

import type { Grade, Shot } from "./edit";
import { playbackRateFor } from "./timing";

/** Cold is act one: the colour drained out of solo queue. Live is act two, pushed the other
 * way, because the app's own chartreuse is the brightest thing in the video and the turn
 * should feel like the saturation coming back. */
const GRADE: Record<Grade, string> = {
  cold: "saturate(0.5) contrast(1.24) brightness(0.8)",
  live: "saturate(1.22) contrast(1.1) brightness(1.02)",
};

/** A blue wash over the cold half, under the captions. Cheaper and steadier than pushing the
 * hue rotation far enough to tint on its own. */
const COLD_WASH = "rgba(12,26,58,0.30)";

/** Three frames, of which only the first two carry real blur. Long enough to read as a smear
 * and short enough that a 12 frame shot is not a quarter spent out of focus. */
const WHIP_FRAMES = 3;
const SLAM_FRAMES = 6;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high);

export const ShotView = ({ shot }: { shot: Shot }) => {
  const frame = useCurrentFrame();
  const span = Math.max(shot.frames - 1, 1);
  const progress = clamp(frame / span, 0, 1);

  const [zoomFrom, zoomTo] = shot.zoom ?? [1.1, 1.2];
  const zoom = interpolate(progress, [0, 1], [zoomFrom, zoomTo], {
    easing: Easing.out(Easing.quad),
  });

  // The focus point is clamped to whatever the current scale can actually cover, so authoring
  // a focus on the top third of an app screen cannot open a gap at the frame edge.
  const [focusX, focusY] = shot.focus ?? [VIDEO_W / 2, VIDEO_H / 2];
  const halfW = VIDEO_W / 2 / zoom;
  const halfH = VIDEO_H / 2 / zoom;
  const anchorX = clamp(focusX, halfW, VIDEO_W - halfW);
  const anchorY = clamp(focusY, halfH, VIDEO_H - halfH);
  const offsetX = -(anchorX - VIDEO_W / 2) * zoom;
  const offsetY = -(anchorY - VIDEO_H / 2) * zoom;

  // The entrance, applied to a wrapper so it composes with the punch-in rather than fighting
  // it. Both entrances are over inside a fifth of a second.
  const whipping = shot.enter === "whip" ? 1 - Math.min(frame / WHIP_FRAMES, 1) : 0;
  const eased = Math.pow(whipping, 2);
  const slamming = shot.enter === "slam" ? 1 - Math.min(frame / SLAM_FRAMES, 1) : 0;
  const whipX = (shot.whip ?? 1) * 320 * eased;
  const blur = 20 * eased;
  // Blurring a layer that only just covers the frame drags transparent pixels in from outside
  // it, so a whipping shot is scaled up by more than the blur radius can pull in.
  const cover = 1 + eased * 0.09 + slamming * 0.14;

  const clip = clips[shot.clip];
  const rate = shot.rate ?? 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translateX(${whipX}px) scale(${cover})`,
          filter: blur > 0.4 ? `blur(${blur}px)` : undefined,
        }}
      >
        <OffthreadVideo
          src={staticFile(`footage/${clip.file}`)}
          trimBefore={Math.round(shot.at * FPS)}
          // Not a speed. See timing.ts: this is solved every frame so the source lands on the
          // exact timestamp the ramp asks for.
          playbackRate={playbackRateFor(rate, shot.frames, frame)}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
            filter: GRADE[shot.grade ?? "live"],
          }}
        />
      </AbsoluteFill>
      {shot.grade === "cold" ? <AbsoluteFill style={{ backgroundColor: COLD_WASH }} /> : null}
    </AbsoluteFill>
  );
};
