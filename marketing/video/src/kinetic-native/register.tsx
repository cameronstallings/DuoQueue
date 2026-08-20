/**
 * The combined direction registers itself, so Root.tsx carries one import and one element for
 * it and dropping the direction is deleting a directory.
 *
 * `render-day` selects the composition called `Post` by id and nothing else, so registering
 * here cannot change what `pnpm video:day` renders.
 *
 * TWO COMPOSITIONS, ONE FILM. They are the same script, the same mix, the same beat table,
 * the same camera and the same seams. The only difference between them is `typeScale`, the
 * fraction of the safe box each beat's hero line is fitted to. Registering the pair rather
 * than passing `--props` at the command line is deliberate: it makes "these differ in exactly
 * one number" a property of the file rather than of whoever typed the render command, and the
 * whole reason the pair exists is that a size cannot be chosen from an adjective.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";

import { KineticNative } from "./KineticNative";
import { KINETIC_NATIVE, kineticNativeDuration } from "./script";
import { TYPE_SCALE } from "./skin";

const FRAME = { width: VIDEO_W, height: VIDEO_H, fps: FPS } as const;

const SCALES = [
  { id: "Kinetic-Native-A", typeScale: TYPE_SCALE.a },
  { id: "Kinetic-Native-B", typeScale: TYPE_SCALE.b },
] as const;

export const KineticNativeCompositions = () => (
  <>
    {SCALES.map(({ id, typeScale }) => (
      <Composition
        key={id}
        id={id}
        component={KineticNative}
        {...FRAME}
        durationInFrames={kineticNativeDuration(KINETIC_NATIVE)}
        defaultProps={{ script: KINETIC_NATIVE, cta: CTA.waitlist, typeScale }}
        calculateMetadata={({ props }) => ({ durationInFrames: kineticNativeDuration(props.script) })}
      />
    ))}
  </>
);
