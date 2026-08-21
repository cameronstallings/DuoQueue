import { Composition } from "remotion";

import { CarouselCompositions } from "@/carousel/register";
import { BrandSheet } from "@/compositions/BrandSheet";
import { Normalize, NORMALIZE_DEFAULTS } from "@/compositions/Normalize";
import { Post } from "@/compositions/Post";
import { CTA } from "@/config/phase";
import { hooks } from "@/data/hooks";
// The direction experiments each register themselves, so adding or dropping one is a line.
import { MontageCompositions } from "@/directions/montage/register";
import { FragCompositions } from "@/frag/register";
import { kineticSample } from "@/kinetic/beats";
import { KineticPost, kineticDuration } from "@/kinetic/KineticPost";
import { KineticNativeCompositions } from "@/kinetic-native/register";
import { postDuration } from "@/lib/duration";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";
import { NativeCompositions } from "@/native/register";
import { ProCompositions } from "@/pro/register";
import type { Hook } from "@/types";
import { TypeCleanCompositions } from "@/type-clean/register";
import { V6Compositions } from "@/v6/register";

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
    {/* The sixth script, in three genuinely different looks. Cameron's note on the fifth was
        that he does not like how it looks at all besides the end card, so these are three
        approaches rather than three settings of one: the app as the hero, the end card's own
        language extended backwards through the whole film, and a gameplay led trailer. They
        render from src/v6/ and register themselves there. */}
    <V6Compositions />
    {/* The seventh direction, and the first built from reference rather than from a note.
        Cameron sent three reels he wants to look like; all three hold ONE light ground, none of
        them ever shows a phone, and every one of them pulls a single UI element out and lets it
        own the frame on empty space. So: warm off-white ground, the DARK app as isolated
        fragments floating on it, 58px type, one shadow, one camera. Same script, same read, same
        mix as V6-A/B/C. It renders from src/frag/ as a PAIR that differs only in which app theme
        was recorded, because that is the comparison Cameron shot both recordings to make. */}
    <FragCompositions />
    {/* The same direction in the one format that is not a film: a 1080x1350 swipeable
        carousel, six cards, rendered as stills by scripts/render-carousel.ts. It imports the
        ground, the inks, the grid, the tilt, the shadow and the type cap from src/frag/ rather
        than restating them, so it cannot drift away from the finished ads. It registers ONE
        composition and the script drives it six times by index. */}
    <CarouselCompositions />
    {/* The third of the three ads, and the one Cameron asked for as "the type that we
        originally started". It is a rebuild rather than a tune: the original fitted every line
        to the full frame width, which assigned size by spelling and left no margin anywhere, so
        this one names ONE hero line a beat and sets everything else three times smaller in the
        opposite tracking, the opposite case and the app's own paper volt. Same ground, same
        inks, same script, same read, same mix, same shot plan and the same end card as the
        fragment ad; the type and the absence of the tilt are the whole difference. It renders
        from src/type-clean/ and registers itself there. */}
    <TypeCleanCompositions />
    {/* The tenth direction, and the first built from a frame-by-frame MEASUREMENT of the three
        reels Cameron sent rather than from an impression of them. Nine were rejected for looking
        cheap; the measurement says why, in numbers, in src/pro/motion.ts. Three genuinely
        different films on one script, one read and one mix: a device in studio light, a card in
        space, and a scrolling editorial line. They render from src/pro/ and register themselves
        there. */}
    <ProCompositions />
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
