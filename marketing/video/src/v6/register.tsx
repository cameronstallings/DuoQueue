/**
 * The three directions register themselves, so Root.tsx carries one import and one element for
 * the set and dropping the experiment is deleting a directory.
 *
 * `render-day` selects the composition called `Post` by id and nothing else, so registering
 * here cannot change what `pnpm video:day` renders.
 *
 * ONE SCRIPT, ONE READ, ONE MIX, ONE BEAT TABLE, ONE SHOT PLAN, THREE LOOKS. Every composition
 * below is passed the same `V6` and the same `SHOTS`, and derives its beat boundaries from the
 * same measured WAV, so a difference between two of these files is a difference of look and
 * never of timing, copy or footage. The first cut let each direction carry its own plan and the
 * comparison stopped being a comparison. That is the whole reason there are three: Cameron has
 * picked correctly from rendered pairs three times and has never once been able to choose from
 * prose.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";

import { DirectionA } from "./a/DirectionA";
import { DirectionB } from "./b/DirectionB";
import { DirectionC } from "./c/DirectionC";
import { SHOTS } from "./plan";
import { V6 } from "./script";
import { v6Duration } from "./timing";

const FRAME = { width: VIDEO_W, height: VIDEO_H, fps: FPS } as const;

export const V6Compositions = () => (
  <>
    <Composition
      id="V6-A"
      component={DirectionA}
      {...FRAME}
      durationInFrames={v6Duration(V6)}
      defaultProps={{ script: V6, shots: SHOTS, cta: CTA.waitlist }}
      calculateMetadata={({ props }) => ({ durationInFrames: v6Duration(props.script) })}
    />
    <Composition
      id="V6-B"
      component={DirectionB}
      {...FRAME}
      durationInFrames={v6Duration(V6)}
      defaultProps={{ script: V6, shots: SHOTS, cta: CTA.waitlist }}
      calculateMetadata={({ props }) => ({ durationInFrames: v6Duration(props.script) })}
    />
    <Composition
      id="V6-C"
      component={DirectionC}
      {...FRAME}
      durationInFrames={v6Duration(V6)}
      defaultProps={{ script: V6, shots: SHOTS, cta: CTA.waitlist }}
      calculateMetadata={({ props }) => ({ durationInFrames: v6Duration(props.script) })}
    />
  </>
);
