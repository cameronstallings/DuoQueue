/**
 * The type, and the entire reason this direction exists.
 *
 * Every word is its own spring. They land in sequence about two and a half frames apart, each
 * overshooting past its final size and settling back, each rotated a degree or so off true and
 * unblurring as it arrives. That is the grammar short-form has trained people to read as "a
 * person made this", and the shipping formats have none of it: one opacity ramp, one six-frame
 * translate, everything moving together.
 *
 * The springs are underdamped on purpose. src/lib/enter.ts uses damping 200, which is
 * critically overdamped and settles without overshoot, and its comment says a bounce is a
 * motion-graphics tell this brand does not have. Correct for the app. Wrong for a feed.
 */
import { Fragment } from "react";

import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { K, LEADING, TRACKING } from "./palette";
import { DISPLAY_FACE } from "./type-fit";

/**
 * Frames between one word landing and the next, chosen against the word count rather than
 * fixed. Under two and the line arrives as a block, which is the shipping formats' problem.
 * Over four and a six-word statement takes a second to become readable, which is a second the
 * viewer spends deciding whether to scroll. So a two-word beat gets the roomier rhythm and a
 * six-word one gets the tighter, and every beat finishes landing well inside its own length.
 */
const staggerFor = (words: number): number => (words <= 3 ? 3 : words <= 5 ? 2.5 : 2);

/** How far into its own entrance the last word of an opening beat is at frame 0. Three frames
 * is past the opacity ramp and mid-overshoot: the frame is full of legible type and visibly
 * still moving, which is what scrolling into a video already in progress looks like. */
const LANDED_LEAD = 3;

export type WordInk = "bone" | "hot" | "ink";

const INK: Record<WordInk, string> = { bone: K.bone, hot: K.hot, ink: K.onHot };

interface WordProps {
  text: string;
  delay: number;
  /** Final resting tilt in degrees. It enters from several times this and settles onto it, so
   * the word is never straight and never obviously crooked. */
  tilt: number;
  color: string;
  /** Filled block behind the word, wiping in from the left under it. */
  slab?: string;
}

const Word = ({ text, delay, tilt, color, slab }: WordProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;

  // Underdamped: this crosses 1 at about frame 9 and settles by frame 20, peaking near 1.06.
  // spring() returns 0 for a negative frame, so a word whose turn has not come is simply not
  // there yet and needs no guard.
  const pop = spring({ fps, frame: local, config: { damping: 10.5, mass: 0.5, stiffness: 200 } });

  const opacity = interpolate(local, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(pop, [0, 1], [0.52, 1]);
  const lift = interpolate(pop, [0, 1], [0.18, 0]);
  const rotate = interpolate(pop, [0, 1], [tilt * 3.5, tilt]);
  const blur = interpolate(local, [0, 6], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The slab wipes rather than fades, and it finishes before the letters it sits under appear.
  // The order matters: a slabbed word is near-black, so for however long the slab is still
  // travelling, the part of the word past its edge is black on black. The first render of this
  // had "DUO" half missing for a quarter of a second for exactly that reason. So the slab
  // completes by frame three and the letters come up over it in the frame and a half after,
  // which is short enough that the bare slab never reads as a redaction.
  const wipe = interpolate(local, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slabInk = interpolate(local, [3, 4.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        opacity,
        // Below centre, so a word grows up out of the line rather than out of thin air.
        transformOrigin: "50% 62%",
        transform: `translateY(${lift}em) scale(${scale}) rotate(${rotate}deg)`,
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
        color,
      }}
    >
      {slab ? (
        // Absolutely positioned, so it paints behind the word without adding a pixel to the
        // line's layout width. A padded background would widen the line past the size fitText
        // measured, and the line would overhang the frame.
        <span
          style={{
            position: "absolute",
            inset: "0.06em -0.045em 0.1em -0.045em",
            backgroundColor: slab,
            transformOrigin: "0% 50%",
            transform: `scaleX(${wipe})`,
          }}
        />
      ) : null}
      <span style={{ position: "relative", opacity: slab ? slabInk : 1 }}>{text}</span>
    </span>
  );
};

export interface KineticWordsProps {
  /** House-voice copy, one entry per rendered line. Uppercased here. */
  lines: string[];
  /** One fitted size per line, from fitStack(). */
  sizes: number[];
  accent?: string[];
  slab?: string[];
  align?: "center" | "left";
  /** Base ink for words that are neither accented nor slabbed. */
  ink?: WordInk;
  /** Ink for accented words. */
  accentInk?: WordInk;
  /** Shifts every delay, so a beat can open with its statement already on screen. */
  landed?: boolean;
  /** Salts the per-word tilt, so two beats with the same word count are not tilted the same
   * way. Deterministic: `random()` is seeded, and a render that is not deterministic is a
   * render that cannot be resumed. */
  seed: string;
}

export const KineticWords = ({
  lines,
  sizes,
  accent = [],
  slab = [],
  align = "left",
  ink = "bone",
  accentInk = "hot",
  landed = false,
  seed,
}: KineticWordsProps) => {
  const upper = lines.map((line) => line.toUpperCase());
  const accentSet = new Set(accent.map((word) => word.toUpperCase()));
  const slabSet = new Set(slab.map((word) => word.toUpperCase()));

  const total = upper.reduce((count, line) => count + line.split(" ").length, 0);
  const stagger = staggerFor(total);
  const shift = landed ? (total - 1) * stagger + LANDED_LEAD : 0;

  let index = -1;

  return (
    <div style={{ width: "100%", textAlign: align }}>
      {upper.map((line, lineIndex) => {
        const fontSize = sizes[lineIndex] ?? 0;
        return (
          <div
            key={line + String(lineIndex)}
            style={{
              fontFamily: DISPLAY_FACE,
              fontSize: `${fontSize}px`,
              lineHeight: `${Math.round(fontSize * LEADING)}px`,
              letterSpacing: TRACKING,
              // The words are inline-blocks separated by real space characters, which is what
              // makes the rendered width equal the measured width. `pre` stops those spaces
              // collapsing across the JSX line breaks.
              whiteSpace: "pre",
            }}
          >
            {line.split(" ").map((word, wordIndex) => {
              index += 1;
              const isSlab = slabSet.has(word);
              const color = isSlab ? INK.ink : accentSet.has(word) ? INK[accentInk] : INK[ink];
              return (
                <Fragment key={word + String(wordIndex)}>
                  {wordIndex > 0 ? " " : null}
                  <Word
                    text={word}
                    delay={index * stagger - shift}
                    // Between about -1.4 and 1.4 degrees, never zero enough to look aligned.
                    tilt={(random(`${seed}-${String(index)}`) - 0.5) * 2.8}
                    color={color}
                    slab={isSlab ? K.hot : undefined}
                  />
                </Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
