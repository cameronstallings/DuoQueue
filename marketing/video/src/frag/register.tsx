/**
 * The two deliverables register themselves, so Root.tsx carries one import and one element for
 * the pair and dropping the direction is deleting a directory.
 *
 * `render-day` selects the composition called `Post` by id and nothing else, so registering here
 * cannot change what `pnpm video:day` renders.
 *
 * TWO COMPOSITIONS, ONE ARGUMENT. They are passed the same script, the same plan, the same mix
 * and the same duration, and they differ in one string: `theme`. Everything downstream of that
 * string is a table lookup in ./plan.ts, so there is no code path either film can take that the
 * other cannot. Cameron shot both recordings to compare the app's two themes on real footage
 * rather than in theory, and the only way to answer that question is to hold every other
 * variable still.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";

import { Frag } from "./Frag";
import { V6 } from "../v6/script";
import { v6Duration } from "../v6/timing";

const FRAME = { width: VIDEO_W, height: VIDEO_H, fps: FPS } as const;

export const FragCompositions = () => (
  <>
    <Composition
      id="Frag-Dark"
      component={Frag}
      {...FRAME}
      durationInFrames={v6Duration(V6)}
      defaultProps={{ script: V6, theme: "dark" as const, cta: CTA.waitlist }}
      calculateMetadata={({ props }) => ({ durationInFrames: v6Duration(props.script) })}
    />
    <Composition
      id="Frag-Light"
      component={Frag}
      {...FRAME}
      durationInFrames={v6Duration(V6)}
      defaultProps={{ script: V6, theme: "light" as const, cta: CTA.waitlist }}
      calculateMetadata={({ props }) => ({ durationInFrames: v6Duration(props.script) })}
    />
  </>
);
