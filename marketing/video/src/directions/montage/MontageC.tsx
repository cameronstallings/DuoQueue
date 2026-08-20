/**
 * DIRECTION C: FAST MONTAGE.
 *
 * An experiment that runs beside the four daily formats rather than replacing any of them.
 * The brief was that the daily posts read as advertising: one clip, one static line, ten
 * seconds of nothing moving. This is the opposite reading of the same footage.
 *
 * Twenty shots in eleven and a half seconds. Nothing on screen for more than a second except
 * the two frames the whole thing is built around: DEFEAT at the end of act one and DUO LOCKED
 * at the end of act two, each one ramping from full speed down to a quarter of it so the
 * slowdown lands ON the word. Everything between them is 0.4 to 0.8 seconds long, whipping,
 * flashing and punching in, with three or four lowercase words at a time popping up and
 * vanishing.
 *
 * The stack, bottom to top: footage (shaken), captions (not shaken, because a shaking caption
 * is an unreadable one), the end beat, then flashes, vignette and grain over everything so
 * the phone recording and the game capture end up behind the same glass.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import type { Cta } from "@/config/phase";

import { CaptionBlock } from "./Captions";
import { BODY_FRAMES, captions, SHOT_STARTS, shots } from "./edit";
import { END_BEAT_FRAMES, EndBeat } from "./EndBeat";
import { type Flash, Flashes, Grain, type Hit, SHAKE_COVER, shakeAt, Vignette } from "./Fx";
import { ShotView } from "./Footage";
import { VOID } from "./palette";

export const MONTAGE_FRAMES = BODY_FRAMES + END_BEAT_FRAMES;

/** Both derived from the shot list rather than authored twice, so moving a shot moves its
 * flash and its hit with it. */
const FLASHES: Flash[] = shots.flatMap((shot, index) =>
  shot.flash ? [{ at: SHOT_STARTS[index]!, frames: shot.flash.frames, ink: shot.flash.ink }] : [],
);
const HITS: Hit[] = shots.flatMap((shot, index) =>
  shot.shake ? [{ at: SHOT_STARTS[index]!, power: shot.shake }] : [],
);

export const MontageC = ({ cta }: { cta: Cta }) => {
  const frame = useCurrentFrame();
  const shake = shakeAt(frame, HITS);

  return (
    <AbsoluteFill style={{ backgroundColor: VOID }}>
      <AbsoluteFill
        style={{
          transform: `translate(${shake.x}px, ${shake.y}px) rotate(${shake.rotate}deg) scale(${SHAKE_COVER})`,
        }}
      >
        {shots.map((shot, index) => (
          <Sequence
            key={`${shot.clip}-${index}`}
            from={SHOT_STARTS[index]}
            durationInFrames={shot.frames}
            name={`${index} ${shot.clip} @${shot.at}s`}
          >
            <ShotView shot={shot} />
          </Sequence>
        ))}
      </AbsoluteFill>

      {captions.map((caption, index) => (
        <Sequence
          key={`caption-${index}`}
          from={SHOT_STARTS[caption.shot]! + (caption.offset ?? 0)}
          durationInFrames={caption.hold}
          name={`cap "${caption.lines.join(" ")}"`}
        >
          <CaptionBlock caption={caption} />
        </Sequence>
      ))}

      <Sequence from={BODY_FRAMES} durationInFrames={END_BEAT_FRAMES} name="end beat">
        <EndBeat cta={cta} />
      </Sequence>

      <Flashes flashes={FLASHES} />
      <Vignette />
      <Grain />
    </AbsoluteFill>
  );
};
