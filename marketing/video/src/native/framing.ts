/**
 * Where a cut is pointed, and the two ways pointing it can go wrong.
 *
 * Every shot fills the frame: `object-fit: cover` crops the footage to 9:16 and then a
 * transform punches into that crop. The transform is what makes the difference between a
 * screen recording playing inside a video and a shot that is about the card in the middle of
 * it, so it is authored as "put this part of the source here", not as a pixel offset nobody
 * can check.
 *
 * Both failures below are silent in Studio at a glance and obvious in a finished MP4, which is
 * why they throw instead of warning:
 *
 *   1. A framing that translates further than its scale can cover exposes the frame edge, and
 *      a black bar down one side of a full-bleed video is the whole direction lost.
 *   2. OffthreadVideo renders NOTHING past a clip's trimmed range (see clips.ts). A shot that
 *      asks for more seconds than its clip has plays black under a caption.
 */
import { clips } from "@/data/clips";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";
import type { ClipName } from "@/types";

import type { Framing, Shot } from "./types";

/** The two shapes in public/footage: an iPhone screen recording, and 1440p gameplay. Held
 * here rather than in clips.ts because only this direction needs to know them, and the
 * shipping formats deliberately do not care. */
const APP_SOURCE = { w: 1180, h: 2556 } as const;
const GAME_SOURCE = { w: 2560, h: 1440 } as const;
const GAME_CLIPS: readonly ClipName[] = ["broll-loss", "broll-quiet", "broll-teamfight"];

const sourceOf = (clip: ClipName) => (GAME_CLIPS.includes(clip) ? GAME_SOURCE : APP_SOURCE);

/** The footage as `object-fit: cover` lays it out: scaled to the short side and centred, so
 * part of it is already outside the frame before any transform. */
const covered = (clip: ClipName) => {
  const source = sourceOf(clip);
  const fill = Math.max(VIDEO_W / source.w, VIDEO_H / source.h);
  return { w: source.w * fill, h: source.h * fill };
};

interface Aim {
  /** The point in the SOURCE to aim at, as a fraction of its width and height. */
  fx?: number;
  fy?: number;
  /** Where that point should land in the 1080x1920 frame, in composition pixels. Defaults to
   * the centre horizontally and a little above it vertically, which is where app content has
   * to sit to stay clear of the caption block. */
  tx?: number;
  ty?: number;
  scale: number;
}

/**
 * Solves the transform for one aim. CSS applies `translate(x, y) scale(s)` right to left, so a
 * point at container coordinate `c` ends up at `(c - centre) * s + centre + t`; this returns
 * the `t` that lands it on target. Keeping the same aim across two scales is what makes a
 * drift a push in rather than a slide.
 */
export const aim = (clip: ClipName, { fx = 0.5, fy = 0.5, tx = VIDEO_W / 2, ty = 880, scale }: Aim): Framing => {
  const box = covered(clip);
  const naturalX = fx * box.w - (box.w - VIDEO_W) / 2;
  const naturalY = fy * box.h - (box.h - VIDEO_H) / 2;
  return {
    scale,
    x: tx - VIDEO_W / 2 - (naturalX - VIDEO_W / 2) * scale,
    y: ty - VIDEO_H / 2 - (naturalY - VIDEO_H / 2) * scale,
  };
};

/** How far a framing may travel before the frame edge shows. At scale 1 the answer is zero:
 * cover leaves no slack, which is exactly the trap. */
const exposes = ({ scale, x, y }: Framing): string | null => {
  const slackX = (VIDEO_W / 2) * (scale - 1);
  const slackY = (VIDEO_H / 2) * (scale - 1);
  if (Math.abs(x) > slackX + 0.5) {
    return `x=${Math.round(x)} needs scale >= ${(1 + Math.abs(x) / (VIDEO_W / 2)).toFixed(3)}, and it is ${scale}`;
  }
  if (Math.abs(y) > slackY + 0.5) {
    return `y=${Math.round(y)} needs scale >= ${(1 + Math.abs(y) / (VIDEO_H / 2)).toFixed(3)}, and it is ${scale}`;
  }
  return null;
};

/** Seconds of source one shot eats, playback rate included. */
export const consumes = (shot: Shot): number => (shot.frames / FPS) * (shot.rate ?? 1);

/** Called once when a script module loads, so a bad shot fails the render immediately with a
 * message naming it, rather than 40 seconds later as a black frame in an MP4. */
export const checkShots = (id: string, shots: readonly Shot[]): void => {
  shots.forEach((shot, index) => {
    const where = `${id} shot ${index + 1} (${shot.clip})`;
    const clip = clips[shot.clip];
    const available = clip.to - clip.from;
    const needed = shot.start + consumes(shot);
    if (needed > available + 1e-6) {
      throw new Error(
        `${where} wants ${needed.toFixed(2)}s of "${shot.clip}", which holds ${available.toFixed(2)}s. ` +
          `Move its start back, shorten it, or lower its rate.`,
      );
    }
    for (const [edge, framing] of [["from", shot.from], ["to", shot.to]] as const) {
      const problem = exposes(framing);
      if (problem) {
        throw new Error(`${where} would expose the frame edge on its ${edge} framing: ${problem}.`);
      }
    }
  });
};
