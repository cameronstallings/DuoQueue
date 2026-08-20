import { Composition } from "remotion";

import { BrandSheet } from "@/compositions/BrandSheet";
import { Normalize, NORMALIZE_DEFAULTS } from "@/compositions/Normalize";
import { Post } from "@/compositions/Post";
import { CTA } from "@/config/phase";
import { hooks } from "@/data/hooks";
// The direction experiments each register themselves, so adding or dropping one is a line.
import { MontageCompositions } from "@/directions/montage/register";
import { kineticSample } from "@/kinetic/beats";
import { KineticPost, kineticDuration } from "@/kinetic/KineticPost";
import { KineticNativeCompositions } from "@/kinetic-native/register";
import { postDuration } from "@/lib/duration";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";
import { NativeCompositions } from "@/native/register";
import type { Hook } from "@/types";

/** 1080x1920 at 30fps is the shape every post shares, and the one Instagram, TikTok and
 * Shorts all take without reframing. */
const FRAME = { width: VIDEO_W, height: VIDEO_H, fps: FPS } as const;

/** The duration rule moved to @/lib/duration, because the audio path needs the same answer
 * from a node script and a node script cannot import a component. See that file for why. */
const durationOf = postDuration;

/** Previews name their hook rather than indexing into the queue, so reordering hooks.ts
 * cannot quietly repoint one at a different video, and a renamed id fails when Studio loads
 * instead of showing an empty composition with nothing to explain it. */
const previewHook = (id: string): Hook => {
  const found = hooks.find((hook) => hook.id === id);
  if (!found) {
    throw new Error(`Root.tsx previews hook "${id}", which is not in src/data/hooks.ts.`);
  }
  return found;
};

/**
 * One per format, so Studio has four clickable entries and Cameron never hand-types props to
 * look at something. They are not the render targets: the batch renders `Post` with real
 * inputProps, and the `Preview-` prefix is what keeps these out of it.
 */
const PREVIEWS = [
  { id: "Preview-Reframe", hook: previewHook("reframe-001") },
  // Its b-roll does not exist yet, so this one shows the missing-clip panel until Task 9.
  // That is the point of having it in the list: the gap is visible from the sidebar.
  { id: "Preview-Pain", hook: previewHook("pain-001") },
  { id: "Preview-Demo", hook: previewHook("demo-001") },
  { id: "Preview-Spec", hook: previewHook("spec-001") },
] as const;

/** Smoke has been deleted. It existed only to prove the toolchain rendered a frame, and `Post`
 * proves that every day now. BrandSheet is not a post and never ships, but it is the reference
 * sheet the ported primitives get compared against, so it survives the cleanup. */
export const RemotionRoot = () => (
  <>
    <Composition
      id="Post"
      component={Post}
      {...FRAME}
      // Overwritten by calculateMetadata before a frame is drawn. Remotion wants a static
      // number here regardless, and this one is only ever seen if the props fail to resolve.
      durationInFrames={300}
      defaultProps={{ hook: hooks[0]!, cta: CTA.waitlist }}
      calculateMetadata={({ props }) => ({ durationInFrames: durationOf(props.hook) })}
    />
    {PREVIEWS.map(({ id, hook }) => (
      <Composition
        key={id}
        id={id}
        component={Post}
        {...FRAME}
        durationInFrames={durationOf(hook)}
        defaultProps={{ hook, cta: CTA.waitlist }}
        calculateMetadata={({ props }) => ({ durationInFrames: durationOf(props.hook) })}
      />
    ))}
    {/* Direction B, "kinetic type": an exploration registered beside the four shipping
        formats, not in place of them. It renders from src/kinetic/ and shares only the clip
        table, the frame scale, the font loader and the brand mark. `render-day` selects the
        composition called `Post` by id, so nothing about `pnpm video:day` changes. */}
    <Composition
      id="Kinetic"
      component={KineticPost}
      {...FRAME}
      durationInFrames={kineticDuration(kineticSample)}
      defaultProps={{ post: kineticSample, cta: CTA.waitlist }}
      calculateMetadata={({ props }) => ({ durationInFrames: kineticDuration(props.post) })}
    />
    <MontageCompositions />
    {/* Direction A, "native": the CapCut read. Same footage, same clip table, none of the
        Volt furniture, because Cameron lifted that constraint for these experiments. It
        renders from src/native/ and registers itself there. */}
    <NativeCompositions />
    {/* The combined direction Cameron chose: B's kinetic type as the base with A's caption
        rail composited over it, and every seam rebuilt under the motion doctrine. Its seam
        plan is the comment at the top of src/kinetic-native/KineticNative.tsx. This is the
        one to watch; B and A stay registered so the three can be compared. */}
    <KineticNativeCompositions />
    <Composition id="BrandSheet" component={BrandSheet} {...FRAME} durationInFrames={30} />
    {/* Registered because a composition that is not registered cannot be rendered, not
        because anyone should open it. See the header of Normalize.tsx for when it is used. */}
    <Composition
      id="Normalize"
      component={Normalize}
      {...FRAME}
      durationInFrames={Math.round(NORMALIZE_DEFAULTS.seconds * FPS)}
      defaultProps={NORMALIZE_DEFAULTS}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.round(props.seconds * FPS),
      })}
    />
  </>
);
