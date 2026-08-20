/**
 * Direction C's registration, kept in its own file so wiring it into Root.tsx is one import
 * and one line. The three direction experiments are being built in parallel and all of them
 * have to land in the same Root; a fragment each is what keeps that from being a merge.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";

import { MONTAGE_FRAMES, MontageC } from "./MontageC";

export const MontageCompositions = () => (
  <Composition
    id="Direction-C-Montage"
    component={MontageC}
    width={VIDEO_W}
    height={VIDEO_H}
    fps={FPS}
    durationInFrames={MONTAGE_FRAMES}
    defaultProps={{ cta: CTA.waitlist }}
  />
);
