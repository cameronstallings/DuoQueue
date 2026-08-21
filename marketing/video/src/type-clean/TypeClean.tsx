/**
 * THE FILM. One light ground, one enormous word a beat, one isolated fragment of the app under
 * it, and a clean wordmark close.
 *
 * =====================================================================================
 * WHAT IT SHARES WITH THE REST OF THE REPO, AND WHY THAT MATTERS
 * =====================================================================================
 *
 * The script, the read, the mix, the beat table and the shot plan are `v6-001` and
 * src/frag/plan.ts, unchanged and unrebuilt. That is a deliberate refusal to touch five things
 * that were expensive to get right:
 *
 *   THE DERIVED BEAT TIMING. Every boundary below comes from `beatFrames`, which computes it
 *   from the measured position of each phrase inside its own WAV. A beat begins a flat 6 frames
 *   before its phrase's audio, every phrase is fully contained by its own beat, and the lead
 *   never accumulates. Nothing here hand types a frame count, and `pnpm validate` asserts the
 *   property either way.
 *
 *   THE READ PACE. Rate 0.9 with about 0.75s between phrases. An earlier cut's opening line ran
 *   270 words a minute and Cameron called it rushed; broadcast narration is 150 to 170 and this
 *   read averages 164.
 *
 *   THE AUDIO CHAIN. Untouched, because this direction plays the existing v6-001 mix through
 *   the existing `Soundtrack`. No rebuild, so no chance of the master's loudnorm quietly
 *   reverting to dynamic normalisation and lifting the ducked gaps.
 *
 *   THE SCRIPT. Positive and experience ordered, and not one beat is a negation. Every word is
 *   the script's; only the line break moved, and ./plan.ts states why and `pnpm validate`
 *   asserts that the two rejoin to the spoken phrase exactly.
 *
 *   THE SHOT PLAN. src/frag/plan.ts, imported. A difference between this file's render and
 *   frag-dark.mp4 is a difference of TYPE and of nothing else, which is the comparison worth
 *   rendering a second film to make.
 *
 * =====================================================================================
 * THE SIX BEATS AS FRAMES
 * =====================================================================================
 *
 *   1  QUEUE UP WITH A / duo        the card and its action row                    70 frames
 *   2  YOU MATCH ON THE / game      the overlap chip, alone on the ground          68
 *   3  AND HOW / they play          the playstyle chip, alone on the ground        56
 *   4  DUO / locked                 DUO LOCKED, on the film's one reserved arrival 49
 *   5  SEND A / message             the Send button, then the message it produced  52
 *   6  THEN GO / play               daylight: the one fragment that is not the app 52
 *      then the brand, arriving where every object landed                          30
 *
 * The hierarchy and the break are in ./plan.ts, the two sizes in ./type.ts, and the grid, the
 * palette and the vertical band in ./ground.ts, which states the layout system before any of it
 * is used.
 */
import { AbsoluteFill, Sequence, staticFile } from "remotion";

import { Soundtrack } from "@/audio/Soundtrack";
import type { Cta } from "@/config/phase";
import { FragEnd } from "@/frag/FragEnd";
import type { FragBeat } from "@/frag/plan";

import { Exhibit } from "./Exhibit";
import { GROUND, POOL } from "./ground";
import { BEATS, shotFor } from "./plan";
import { filmSizes } from "./type";
import { Words } from "./Words";
import type { V6Script } from "../v6/script";
import { beatFrames, beatStarts, bodyFrames, END_FRAMES } from "../v6/timing";
import { useFaces } from "../v6/type";

/**
 * How far into their own arrival the opening picture and the opening words already are on frame
 * one, and they are two different numbers on purpose.
 *
 * The doctrine forbids fading up into an empty opening frame, and the first half second is the
 * only half second there is. But the two layers fail that rule differently. The OBJECT is a
 * solid card: 4 frames of lead puts it 30px right of home at 85% opacity and still travelling,
 * which is a picture that has already started. The WORDS are masked by a per line
 * `overflow: hidden`, so a word part way through its lift is a word cut off along a horizontal
 * line, and frame zero is what a platform grabs for a thumbnail.
 *
 * 14 covers the whole cascade with room. The last word of the support line starts 4.96 frames
 * after the first, the hero starts at 4.3, and an entry is 11 frames, so at a lead of 14 every
 * word on the opening frame is past 96% of its travel: under 3px of residual lift on the hero,
 * which is one thousandth of the frame. Composed.
 *
 * Both offset the ENTRY clock only, so the cruise and the exit stay on the true frame and the
 * beat still ends exactly where the read says it does.
 */
const OPENING_LEAD = 4;
const OPENING_TYPE_LEAD = 14;

const Beat = ({
  beat,
  support,
  hero,
  sizes,
  frames,
  lead,
  typeLead,
}: {
  beat: FragBeat;
  support: string;
  hero: string;
  sizes: ReturnType<typeof filmSizes>;
  frames: number;
  lead: number;
  typeLead: number;
}) => {
  // A beat's shots run back to back inside it. The last one takes whatever the read left, so a
  // beat's shots always sum to the beat and a change to the mix cannot desynchronise them.
  let cursor = 0;
  const windows = beat.shots.map((shot, index) => {
    const last = index === beat.shots.length - 1;
    const at = cursor;
    const length = last ? frames - at : (shot.frames ?? frames - at);
    cursor = at + length;
    return {
      shot,
      from: at,
      length,
      // Only the first shot inherits the beat's entry vector and only the last its exit. The
      // edges INSIDE a beat hold: both objects are already travelling on the same cruise, so a
      // straight cut there is a velocity match rather than an unmarked seam, and it gives each
      // object its whole window to be read in.
      enter: index === 0 ? beat.enter : ("hold" as const),
      exit: last ? beat.exit : ("hold" as const),
    };
  });

  return (
    <AbsoluteFill>
      {windows.map((window) => (
        <Sequence
          key={window.from}
          from={window.from}
          durationInFrames={window.length}
          layout="none"
        >
          <Exhibit
            shot={window.shot}
            frames={window.length}
            from={window.from}
            beatLength={frames}
            enter={window.enter}
            exit={window.exit}
            lead={window.from === 0 ? lead : 0}
          />
        </Sequence>
      ))}
      <Words support={support} hero={hero} sizes={sizes} frames={frames} delay={-typeLead} />
    </AbsoluteFill>
  );
};

/**
 * The grain, and it is not a stylistic filter.
 *
 * A 1080x1920 field of one near white value banded in every test render: H.264 quantises a slow
 * gradient into visible steps and a flat pale ground is the worst case for it. A whisper of
 * noise dithers the step away. At 0.06 under an overlay blend it is invisible as texture and
 * does the job.
 */
const Grain = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      backgroundImage: `url(${staticFile("noise.png")})`,
      backgroundRepeat: "repeat",
      mixBlendMode: "overlay",
      opacity: 0.06,
    }}
  />
);

export const TypeClean = ({ script, cta }: { script: V6Script; cta: Cta }) => {
  const loaded = useFaces();
  const frames = beatFrames(script);
  const starts = beatStarts(script);
  const body = bodyFrames(script);

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  // TWO sizes for the whole film, measured once, so no beat is larger than another because of
  // how it is spelled. See ./type.ts.
  const sizes = filmSizes();

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND.base }}>
      <Soundtrack id={script.id} />

      <AbsoluteFill style={{ backgroundImage: GROUND.sweep }} />
      <AbsoluteFill style={{ backgroundImage: POOL }} />

      {BEATS.map((beat, index) => (
        <Sequence
          key={beat.hero}
          from={starts[index] ?? 0}
          durationInFrames={frames[index] ?? 1}
          layout="none"
        >
          <Beat
            beat={shotFor(index)}
            support={beat.support.toUpperCase()}
            hero={beat.hero}
            sizes={sizes}
            frames={frames[index] ?? 1}
            lead={index === 0 ? OPENING_LEAD : 0}
            typeLead={index === 0 ? OPENING_TYPE_LEAD : 0}
          />
        </Sequence>
      ))}

      <Sequence from={body} durationInFrames={END_FRAMES} layout="none">
        {/* The end card is src/frag/FragEnd.tsx, imported and unmodified. It is the one element
            Cameron has consistently said he likes, and the three ads close identically on
            purpose: the mark, the wordmark, an off black slab carrying chartreuse "join the
            waitlist", and duoqueue.io under it. */}
        <FragEnd cta={cta} />
      </Sequence>

      <Grain />
    </AbsoluteFill>
  );
};
