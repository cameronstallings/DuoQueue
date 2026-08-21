/**
 * THE FILM. One light ground, one isolated fragment of the app at a time, small type, and a
 * clean wordmark close.
 *
 * =====================================================================================
 * WHAT IT SHARES WITH EVERYTHING ELSE IN THE REPO, AND WHY THAT MATTERS
 * =====================================================================================
 *
 * The script, the read, the mix and the beat table are `v6-001`, unchanged and unrebuilt. That
 * is a deliberate refusal to touch four things that were expensive to get right:
 *
 *   THE DERIVED BEAT TIMING. Every boundary below comes from `beatFrames`, which computes it
 *   from the measured position of each phrase inside its own WAV. A beat begins a flat 6 frames
 *   before its phrase's audio, every phrase is fully contained by its own beat, and the lead
 *   never accumulates. Nothing in this direction hand-types a frame count, and `pnpm validate`
 *   asserts the property either way.
 *
 *   THE READ PACE. Rate 0.9 with about 0.75s between phrases. The opening line of an earlier cut
 *   ran 270 words a minute and Cameron called it rushed; broadcast narration is 150 to 170 and
 *   this read averages 164.
 *
 *   THE AUDIO CHAIN. Untouched, because this direction plays the existing v6-001 mix through
 *   the existing `Soundtrack`. No rebuild, so no chance of the master's loudnorm quietly
 *   reverting to dynamic normalisation and lifting the ducked gaps.
 *
 *   THE SCRIPT. Positive and experience-ordered, and not one beat is a negation. The brief
 *   quoted the opening line as "your next duo is in here"; the repo's approved line is "queue
 *   up with a duo" and it stayed, because rewording it would rebuild the read, re-time the
 *   three v6 directions that share it, and buy nothing: there is no phone in this film, so
 *   "in here" would have had no container to refer to.
 *
 * =====================================================================================
 * THE SIX BEATS AS PICTURES
 * =====================================================================================
 *
 *   1  the card, from its top edge to under the playstyle chip           70 frames
 *   2  the overlap chip, alone on the ground                             68
 *   3  the playstyle chip, alone on the ground                           56
 *   4  DUO LOCKED, arriving on the film's one reserved gesture           49
 *   5  the Send a message button, then the message it produced           52
 *   6  daylight: the one fragment that is not the app                    52
 *      then the brand, arriving where every object landed                30
 *
 * The plan and the reasoning for each are in ./plan.ts; the grid, the palette and the motion
 * constants are in ./ground.ts, which states the layout system before any of it is used.
 */
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";

import { Soundtrack } from "@/audio/Soundtrack";
import type { Cta } from "@/config/phase";

import { FragEnd } from "./FragEnd";
import {
  CRUISE,
  GROUND,
  INK,
  MEASURE,
  TYPE_BASE,
  TYPE_CAP,
  TYPE_LEADING,
  X0,
} from "./ground";
import { Shot } from "./Fragment";
import { PLAN, type FragBeat, type Theme } from "./plan";
import { Stack } from "../v6/Stack";
import type { V6Script } from "../v6/script";
import { beatFrames, beatStarts, bodyFrames, END_FRAMES } from "../v6/timing";
import { filmSize, useFaces } from "../v6/type";

/**
 * How far into their own arrival the opening picture and the opening words already are on frame
 * one, and they are two different numbers on purpose.
 *
 * The doctrine's rule is that a film may not fade up into an empty opening frame, and the first
 * half second is the only half second there is. But the two layers fail that rule differently.
 * The CARD is a solid object: 4 frames of lead puts it 30px right of home at 85% opacity and
 * still travelling, which is a picture that has already started. The WORDS are masked by Stack's
 * per-line `overflow: hidden`, so a word part way through its lift is a word cut off along a
 * horizontal line, and the first render of this direction opened on "queue" complete beside a
 * half-height sliver of "up". Mid-motion is the rule; a bisected letterform is not what it
 * means, and frame zero is also what a platform grabs for a thumbnail.
 *
 * The type's lead is 14 and not 8, and the difference is Stack's cascade. A word's clock is the
 * block's delay plus 4.3 frames per LINE plus a decaying per-word gap, so the LAST word of the
 * SECOND line starts 7.9 frames after the first word of the first. At a lead of 8 that word was
 * still at frame -0.1 of its own entry on frame zero, and the render opened on "queue up / with
 * a" beside a 0.38-opacity sliver of "duo". 14 puts every word of the opening stack past 96% of
 * its travel, which is under 2px of residual lift: composed.
 *
 * Both offset the ENTRY clock only, so the cruise and the exit stay on the true frame and the
 * beat still ends exactly where the read says it does.
 */
const OPENING_LEAD = 4;
const OPENING_TYPE_LEAD = 14;

/** The type, in its band, carried on the same current as the objects.
 *
 * The band is anchored at its BOTTOM, so a one line beat and a two line beat share a baseline
 * rather than a top edge, and the eye has one line to come back to across six cuts. The block
 * drifts left at CRUISE exactly as the fragment below it does, so the whole frame is one camera
 * move; what the words do on top of that is Stack's waterfall, which is a word-level texture and
 * not a second seam. */
const TypeBand = ({
  lines,
  keyWord,
  frames,
  size,
  lead,
}: {
  lines: string[];
  keyWord: string | undefined;
  frames: number;
  size: number;
  lead: number;
}) => {
  const frame = useCurrentFrame();
  const x = CRUISE * (frames / 2 - frame);

  return (
    <div
      style={{
        position: "absolute",
        left: X0,
        top: 0,
        width: MEASURE,
        height: TYPE_BASE,
        display: "flex",
        alignItems: "flex-end",
        transform: `translateX(${x.toFixed(2)}px)`,
      }}
    >
      <Stack
        lines={lines}
        keyWord={keyWord}
        frames={frames}
        size={size}
        align="left"
        color={INK.type}
        accent={INK.accent}
        leading={TYPE_LEADING}
        delay={-lead}
      />
    </div>
  );
};

const Beat = ({
  beat,
  lines,
  keyWord,
  theme,
  frames,
  size,
  lead,
  typeLead,
}: {
  beat: FragBeat;
  lines: string[];
  keyWord: string | undefined;
  theme: Theme;
  frames: number;
  size: number;
  lead: number;
  typeLead: number;
}) => {
  // A beat's shots run back to back inside it. The last one takes whatever the read left, so a
  // beat's shots always sum to the beat and a change to the mix cannot desynchronise them.
  let cursor = 0;
  const windows = beat.shots.map((shot, index) => {
    const last = index === beat.shots.length - 1;
    const from = cursor;
    const length = last ? frames - from : (shot.frames ?? frames - from);
    cursor = from + length;
    return {
      shot,
      from,
      length,
      // Only the first shot inherits the beat's entry vector and only the last its exit. The
      // edges INSIDE a beat hold: both objects are already travelling on the same cruise, so a
      // straight cut there is a velocity match rather than an unmarked seam, and it gives each
      // object its whole window to be read in. See the note on "hold" in ./plan.ts.
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
          <Shot
            shot={window.shot}
            theme={theme}
            frames={window.length}
            from={window.from}
            beatLength={frames}
            enter={window.enter}
            exit={window.exit}
            lead={window.from === 0 ? lead : 0}
          />
        </Sequence>
      ))}
      <TypeBand lines={lines} keyWord={keyWord} frames={frames} size={size} lead={typeLead} />
    </AbsoluteFill>
  );
};

/**
 * The grain, and it is not a stylistic filter.
 *
 * A 1080x1920 field of one near-white value banded in every test render: H.264 quantises a slow
 * gradient into visible steps and a flat pale ground is the worst case for it. A whisper of
 * noise dithers the step away. At 0.06 under an overlay blend it is invisible as texture and
 * does the job; the scanline half of the kinetic-native Texture is deliberately not here,
 * because a CRT line on a paper ground reads as a mistake.
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

export const Frag = ({
  script,
  theme,
  cta,
}: {
  script: V6Script;
  theme: Theme;
  cta: Cta;
}) => {
  const loaded = useFaces();
  const frames = beatFrames(script);
  const starts = beatStarts(script);
  const body = bodyFrames(script);

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  // ONE size for the whole film, capped, so no beat is larger than another because of how it is
  // spelled. The cap binds: the longest line measures 471px inside an 844px measure.
  const size = filmSize(script, MEASURE, TYPE_CAP);

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND.base }}>
      <Soundtrack id={script.id} />

      <AbsoluteFill style={{ backgroundImage: GROUND.sweep }} />
      <AbsoluteFill style={{ backgroundImage: GROUND.pool }} />

      {script.beats.map((beat, index) => (
        <Sequence
          key={beat.phrase}
          from={starts[index] ?? 0}
          durationInFrames={frames[index] ?? 1}
          layout="none"
        >
          <Beat
            beat={PLAN[index] ?? { shots: [], enter: "curve", exit: "curve" }}
            lines={beat.lines}
            keyWord={beat.key}
            theme={theme}
            frames={frames[index] ?? 1}
            size={size}
            lead={index === 0 ? OPENING_LEAD : 0}
            typeLead={index === 0 ? OPENING_TYPE_LEAD : 0}
          />
        </Sequence>
      ))}

      <Sequence from={body} durationInFrames={END_FRAMES} layout="none">
        <FragEnd cta={cta} />
      </Sequence>

      <Grain />
    </AbsoluteFill>
  );
};
