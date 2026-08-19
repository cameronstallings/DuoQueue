import type { CSSProperties } from "react";

import { spring, useCurrentFrame, useVideoConfig } from "remotion";

import { motion, spacing } from "@app/theme/tokens";

import { px } from "./scale";

/**
 * The one entrance in this pipeline. Every element that arrives on screen (a hook line, a
 * tick, a list row) arrives this way, so a post moves with one timing and one distance
 * throughout and retuning the app's motion tokens retunes the videos with it.
 *
 * motion.base is the app's standard transition, 200ms, which is 6 frames at 30fps. It is
 * written as a conversion rather than as 6 so the two cannot drift. Damping 200 is critically
 * overdamped: it settles without overshoot, because a bouncing line is a motion-graphics tell
 * and this brand does not have those. No scale, no blur, no glow.
 *
 * Returns the style rather than the raw progress because the lift distance is part of the
 * house entrance, and a second caller picking its own would be the same value typed twice.
 */
export const useEnter = (delayFrames = 0): CSSProperties => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    fps,
    frame: frame - delayFrames,
    config: { damping: 200 },
    durationInFrames: Math.round((motion.base / 1000) * fps),
  });

  return {
    opacity: progress,
    // Up, by the app's smallest true gap. Far enough to read as arrival at 30fps, short enough
    // that a row delayed behind three others has not visibly travelled across the frame.
    transform: `translateY(${px(spacing.tight) * (1 - progress)}px)`,
  };
};
