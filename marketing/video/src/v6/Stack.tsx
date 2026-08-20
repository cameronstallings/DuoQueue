/**
 * The type, and the ONE piece of the three directions that is genuinely shared.
 *
 * They differ in where the words sit, how big they are, what they sit on and what colour they
 * are. They must not differ in WHICH words, in when a word arrives, or in where a line breaks,
 * because the whole point of rendering three files is that the only variable is the look. So
 * the copy, the break and the choreography live here and each direction passes a size, an
 * alignment and two colours.
 *
 * THE CHOREOGRAPHY is the doctrine's waterfall cut, and it is the same gesture at both ends of
 * every seam. Words arrive from below on a mirrored ease with a decaying stagger, and the
 * outgoing beat's words leave upward on the matching accelerating ease, so a cut lands with the
 * old words still climbing and the new ones still rising. Nothing fades up from nothing and
 * nothing is composed and then held: the entry ignites at 0.35 opacity part way through its own
 * travel, and the exit begins before the beat is over.
 *
 * There is no idle motion of any kind between those two events. The doctrine bans it outright
 * as fake motion, and this film does not need it: something real is moving on every frame,
 * because the thing under the type is a screen recording or a firefight.
 */
import { interpolate, useCurrentFrame } from "remotion";

import { cascade, EASE, WATERFALL_CUT, WATERFALL_ENTRY } from "@/kinetic-native/motion";

import { DISPLAY, TRACKING, wordsOf } from "./type";

/** How long a word takes to arrive, and how far it travels to do it. Both under the doctrine's
 * 800ms entry ceiling with room to spare: 11 frames is 0.37s and the last word of the longest
 * line here starts 4 frames after the first. */
const ENTRY = WATERFALL_CUT.entry;
const LIFT = WATERFALL_ENTRY.normal.lift;

/**
 * Frames between one line beginning to arrive and the next one doing so.
 *
 * Flat rather than the decaying `cascade` the WORDS use, and that is the point of the two
 * being different functions. A decay is right inside a line, where the eye is following one
 * phrase and the later words should catch up; it is wrong between lines, where the reader is
 * moving down the stack at a steady rate. 4.3 frames is 0.14s, so a two line beat is fully
 * composed 0.51s after its first word starts, inside the doctrine's 800ms entry ceiling.
 */
const LINE_GAP = WATERFALL_CUT.entryGap * 2.2;

export interface StackProps {
  lines: string[];
  keyWord?: string;
  /** Beat length in frames, so the exit can be placed from the end. */
  frames: number;
  size: number;
  align: "left" | "center";
  color: string;
  accent: string;
  /** Multiple of the size. */
  leading?: number;
  /** Frames the whole block waits before it begins arriving. The directions use it to let a
   * plate land first on the opening beat. */
  delay?: number;
}

export const Stack = ({
  lines,
  keyWord,
  frames,
  size,
  align,
  color,
  accent,
  leading = 1.02,
  delay = 0,
}: StackProps) => {
  const frame = useCurrentFrame();
  const exitAt = frames - WATERFALL_CUT.exit;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "left" ? "flex-start" : "center",
      }}
    >
      {lines.map((line, lineIndex) => (
        <div
          key={line}
          style={{
            display: "flex",
            flexDirection: "row",
            gap: `${String(Math.round(size * 0.26))}px`,
            height: `${String(Math.round(size * leading))}px`,
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          {wordsOf(line, keyWord).map((word, wordIndex) => {
            // One clock per word. The line index is part of the entry delay so a two line stack
            // reads top to bottom rather than as two lines arriving together, and part of the
            // exit delay in the same order so the block leaves the way it came.
            const at =
              delay +
              lineIndex * LINE_GAP +
              cascade(wordIndex, WATERFALL_CUT.entryGap, WATERFALL_CUT.entryDecay);
            const enter = interpolate(frame, [at, at + ENTRY], [0, 1], {
              easing: EASE.power4Out,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const leaveAt = exitAt + lineIndex * WATERFALL_CUT.exitLineGap + wordIndex * WATERFALL_CUT.exitStagger;
            const leave = interpolate(frame, [leaveAt, leaveAt + WATERFALL_CUT.exit], [0, 1], {
              easing: EASE.power4In,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const y = (1 - enter) * LIFT - leave * LIFT;
            const opacity =
              Math.min(1, WATERFALL_CUT.ignite + enter * (1 - WATERFALL_CUT.ignite)) *
              (1 - leave) *
              (frame >= at ? 1 : 0);

            return (
              <span
                key={`${line}-${String(wordIndex)}`}
                style={{
                  fontFamily: DISPLAY,
                  fontSize: `${String(size)}px`,
                  lineHeight: `${String(Math.round(size * leading))}px`,
                  letterSpacing: TRACKING,
                  color: word.key ? accent : color,
                  transform: `translateY(${y.toFixed(2)}px)`,
                  opacity,
                  whiteSpace: "pre",
                }}
              >
                {word.text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
