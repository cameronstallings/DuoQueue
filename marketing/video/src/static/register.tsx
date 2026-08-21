/**
 * ONE composition, driven four times by props, exactly as src/carousel/register.tsx registers one
 * card and lets the script walk the index.
 *
 * The frame SIZE is a prop here rather than a second composition, because the two sheets are one
 * design at two aspect ratios and registering them separately would let them drift. Remotion
 * takes the dimensions back out of `calculateMetadata`, so `Static` with `size: "story"` renders
 * at 1080x1920 and the entry in Studio's sidebar resizes when the prop changes.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS } from "@/lib/scale";

import { LAYOUT } from "./ground";
import { Still } from "./Still";

export const StaticCompositions = () => (
  <Composition
    id="Static"
    component={Still}
    width={LAYOUT.feed.w}
    height={LAYOUT.feed.h}
    fps={FPS}
    durationInFrames={1}
    defaultProps={{ size: "feed" as const, theme: "dark" as const, cta: CTA.waitlist }}
    calculateMetadata={({ props }) => ({
      width: LAYOUT[props.size].w,
      height: LAYOUT[props.size].h,
    })}
  />
);
