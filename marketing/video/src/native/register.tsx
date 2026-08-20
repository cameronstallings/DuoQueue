/**
 * Direction A registers itself, so Root.tsx carries one import and one element for it and
 * dropping the direction is deleting a directory.
 *
 * `render-day` selects the composition called `Post` by id and nothing else, so registering
 * here cannot change what `pnpm video:day` renders.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";

import { NativePost, nativeDuration } from "./NativePost";
import { NATIVE_DEFAULT } from "./scripts";

const FRAME = { width: VIDEO_W, height: VIDEO_H, fps: FPS } as const;

export const NativeCompositions = () => (
  <Composition
    id="Direction-A-Native"
    component={NativePost}
    {...FRAME}
    durationInFrames={nativeDuration(NATIVE_DEFAULT)}
    defaultProps={{ script: NATIVE_DEFAULT, cta: CTA.waitlist }}
    calculateMetadata={({ props }) => ({ durationInFrames: nativeDuration(props.script) })}
  />
);
