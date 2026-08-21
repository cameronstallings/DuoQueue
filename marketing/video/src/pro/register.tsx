/**
 * The three directions register themselves, so Root.tsx carries one import and one element for
 * all three and dropping the set is deleting a directory.
 *
 * `render-day` selects the composition called `Post` by id and nothing else, so registering here
 * cannot change what `pnpm video:day` renders.
 *
 * THREE COMPOSITIONS, ONE ARGUMENT. All three take the same script, resolve the same beat table
 * out of the same measured WAV, play the same mix and end on the same card. The only variable is
 * the direction, which is what makes them comparable: a difference between two of the rendered
 * files is a difference of look and of nothing else.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";

import { ProA } from "./a/DirectionA";
import { ProB } from "./b/DirectionB";
import { ProC } from "./c/DirectionC";
import { PRO } from "./script";
import { proDuration } from "./timing";

const FRAME = { width: VIDEO_W, height: VIDEO_H, fps: FPS } as const;

const DIRECTIONS = [
  { id: "Pro-A", component: ProA },
  { id: "Pro-B", component: ProB },
  { id: "Pro-C", component: ProC },
] as const;

export const ProCompositions = () => (
  <>
    {DIRECTIONS.map(({ id, component }) => (
      <Composition
        key={id}
        id={id}
        component={component}
        {...FRAME}
        durationInFrames={proDuration(PRO)}
        defaultProps={{ script: PRO, cta: CTA.waitlist }}
        calculateMetadata={({ props }) => ({ durationInFrames: proDuration(props.script) })}
      />
    ))}
  </>
);
