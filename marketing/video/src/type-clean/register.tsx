/**
 * The direction registers itself, so Root.tsx carries one import and one element and dropping
 * it is deleting a directory.
 *
 * `render-day` selects the composition called `Post` by id and nothing else, so registering
 * here cannot change what `pnpm video:day` renders.
 *
 * ONE COMPOSITION, not a pair. The fragment ad renders twice because Cameron shot two
 * recordings to compare the app's dark and light themes on real footage, and that comparison
 * needs both. It has been made: this film draws the DARK fragments on the light ground, which
 * is the direction's own thesis, and rendering a light variant here would only re-ask a
 * question that already has an answer on disk.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";

import { SCRIPT } from "./plan";
import { TypeClean } from "./TypeClean";
import { v6Duration } from "../v6/timing";

export const TypeCleanCompositions = () => (
  <Composition
    id="Type-Clean"
    component={TypeClean}
    width={VIDEO_W}
    height={VIDEO_H}
    fps={FPS}
    durationInFrames={v6Duration(SCRIPT)}
    defaultProps={{ script: SCRIPT, cta: CTA.waitlist }}
    calculateMetadata={({ props }) => ({ durationInFrames: v6Duration(props.script) })}
  />
);
