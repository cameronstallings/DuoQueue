/**
 * The combined direction registers itself, so Root.tsx carries one import and one element for
 * it and dropping the direction is deleting a directory.
 *
 * `render-day` selects the composition called `Post` by id and nothing else, so registering
 * here cannot change what `pnpm video:day` renders.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";

import { KineticNative, kineticNativeDuration } from "./KineticNative";
import { KINETIC_NATIVE } from "./script";

const FRAME = { width: VIDEO_W, height: VIDEO_H, fps: FPS } as const;

export const KineticNativeCompositions = () => (
  <Composition
    id="Kinetic-Native"
    component={KineticNative}
    {...FRAME}
    durationInFrames={kineticNativeDuration(KINETIC_NATIVE)}
    defaultProps={{ script: KINETIC_NATIVE, cta: CTA.waitlist }}
    calculateMetadata={({ props }) => ({ durationInFrames: kineticNativeDuration(props.script) })}
  />
);
