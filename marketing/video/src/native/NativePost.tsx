/**
 * DIRECTION A: "native". One composition, one script, ten cuts and a caption track.
 *
 * It sits beside `compositions/Post.tsx` rather than replacing it. Post renders the four
 * shipping formats in the Volt identity and `pnpm video:day` still renders exactly that; this
 * composition exists so the two can be watched back to back on a phone and one of them can be
 * chosen. Nothing here imports from a format and no format imports from here.
 *
 * What makes it native, in the order a viewer meets it:
 *
 *   frame 0     the hook is already on screen, at full size, over a DEFEAT screen. Nothing
 *               fades up, because the first half second is the only half second there is.
 *   every cut   1.1 to 1.6 seconds, ten of them in thirteen seconds, four of which are jump
 *               cuts inside a clip that was already playing.
 *   every shot  drifts. There is no frame in this video where the picture is still.
 *   the turn    two frames of white and a scale kick at 5.2 seconds, where the problem
 *               becomes the product.
 *   the end     the only branded frame in the video.
 */
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import type { Cta } from "@/config/phase";

import { Captions } from "./Captions";
import { BACKDROP, INK } from "./look";
import { NATIVE_END_FRAMES, NativeEndCard } from "./NativeEndCard";
import { nativeBodyFrames } from "./scripts";
import { Shot } from "./Shot";
import type { NativeScript } from "./types";

/** A type alias rather than an interface, for the same reason `PostProps` is one: Remotion
 * constrains composition props to `Record<string, unknown>`, which an interface has no
 * implicit index signature to satisfy. */
export type NativePostProps = { script: NativeScript; cta: Cta };

export const nativeDuration = (script: NativeScript): number =>
  nativeBodyFrames(script) + NATIVE_END_FRAMES;

/** Two frames at full and one on the way out. Any longer and it is a transition; this is
 * meant to read as the edit hitting something. */
const Flash = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: INK,
        opacity: interpolate(frame, [0, 1, 3], [0.92, 0.55, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    />
  );
};

const Body = ({ script }: { script: NativeScript }) => {
  let at = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: BACKDROP }}>
      {script.shots.map((shot, index) => {
        const from = at;
        at += shot.frames;
        return (
          <Sequence
            key={index}
            from={from}
            durationInFrames={shot.frames}
            name={`${index + 1} ${shot.clip} @${shot.start}s`}
          >
            <Shot shot={shot} />
            {shot.flash ? <Flash /> : null}
          </Sequence>
        );
      })}
      {/* Over every cut, because a caption that changed on every cut would be an edit
          following the text rather than text riding the edit. */}
      <Captions cues={script.cues} />
    </AbsoluteFill>
  );
};

export const NativePost = ({ script, cta }: NativePostProps) => {
  const body = nativeBodyFrames(script);

  return (
    <>
      {/* The body is its own Sequence for the reason PostShell documents: it unmounts the
          footage the moment the end card starts, so no frame of video is decoded under an
          opaque card, and it puts the body clock at zero so shots and cues can be authored in
          frames from the start of the video. */}
      <Sequence durationInFrames={body} name="body">
        <Body script={script} />
      </Sequence>
      <Sequence from={body} durationInFrames={NATIVE_END_FRAMES} name="end">
        <NativeEndCard cta={cta} />
      </Sequence>
    </>
  );
};
