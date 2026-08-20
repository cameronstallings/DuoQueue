/**
 * The caption rail: direction A's treatment, composited over direction B's film.
 *
 * It is an OVERLAY and not a zone. The captions doctrine is unambiguous about this: the line
 * is a layer added on top of the whole film, the composition under it keeps its full frame and
 * centres on the true vertical centre, and nothing is shifted up to make room. There is no
 * keep out band anywhere in this direction, and the only concession the layout makes is the
 * doctrine's one soft courtesy rule, that small critical readable text should not be parked
 * exactly where the line sits. The display stack is fitted into a height budget that ends
 * above it, which is a size decision rather than a shifted centre.
 *
 * Four things make a rail read as native rather than as a title sequence, and all four are
 * load bearing:
 *
 *   1. It sits low, just above the band TikTok and Reels cover with their own chrome.
 *   2. It is white with a hard black keyline, so it stays legible over a flooded vermillion
 *      frame and over a black knockout without changing colour.
 *   3. Words arrive one at a time, from below, on a technique 6 waterfall entry: binary
 *      opacity set at the arrival rather than faded, power4.out, gaps shrinking across the
 *      cascade so it accelerates and the last word snaps. An arrival's opacity is binary and
 *      a seam's ignites at 0.35 mid path; those are different rules on purpose.
 *   4. The whole phrase reserves its layout before its words appear, so nothing reflows as
 *      they arrive. Word by word text that shoves the line around as it goes is the clearest
 *      sign a video was assembled by a machine.
 *
 * ONE keyword per line is picked out, and twice in the film that keyword gets the highlighter
 * instead. That is the doctrine's rail and embed model: the rail carries the words, the
 * promoted word is scarce, spaced and earned, and embedding everything is the default mistake.
 *
 * The rail rides on its own clock over the beats, which is the point of two tracks. A cue may
 * hold across a cut and a cut may land inside a cue; cue 5 in script.ts does exactly that.
 * And because it is an overlay it sits OUTSIDE every seam wrapper: when the film cuts left or
 * retracts on the inverse zoom, the rail does not move with it.
 */
import { fitText } from "@remotion/layout-utils";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { cascade, EASE, WATERFALL_ENTRY } from "./motion";
import type { Cue } from "./script";
import { K, RAIL, RAIL_TRACKING } from "./skin";
import { DISPLAY_FACE, useDisplayFonts } from "./type-fit";

const strip = (word: string): string => word.toLowerCase().replace(/[.,!?]/g, "");

/** The largest size at which the line still fits the box. The keyline is centred on the glyph
 * edge, so half of it sits outside the measured width and fitting to the full box would put
 * that half under the frame edge. */
const sizeFor = (line: string): number =>
  Math.min(
    RAIL.maxSize,
    Math.floor(
      fitText({
        text: line,
        withinWidth: RAIL.box * (1 - RAIL.outline / 2),
        fontFamily: DISPLAY_FACE,
        letterSpacing: RAIL_TRACKING,
        validateFontIsLoaded: true,
      }).fontSize,
    ),
  );

type Weight = "anchor" | "normal" | "light";

/** Velocity varies by weight, which is the difference between a cascade and a queue. The
 * marked word is the anchor and travels furthest; a three letter word snaps. */
const weigh = (word: string, marked: boolean): Weight =>
  marked ? "anchor" : strip(word).length <= 3 ? "light" : "normal";

interface WordProps {
  text: string;
  size: number;
  delay: number;
  weight: Weight;
  mark: "none" | "color" | "box";
  instant: boolean;
}

const RailWord = ({ text, size, delay, weight, mark, instant }: WordProps) => {
  const frame = useCurrentFrame();
  const { lift, frames } = WATERFALL_ENTRY[weight];

  const arrive = instant
    ? 1
    : interpolate(frame, [delay, delay + frames], [0, 1], {
        easing: EASE.power4Out,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // Binary, via a comparison rather than a ramp. A gradual fade on an arrival fights the snap;
  // the doctrine's anti pattern table names it directly.
  const visible = instant || frame >= delay;

  const outline = size * RAIL.outline;
  const boost = size * RAIL.weightBoost;
  const boxed = mark === "box";
  const fill = boxed ? K.onHot : mark === "color" ? K.hot : K.rail;

  const glyphs = {
    fontFamily: DISPLAY_FACE,
    fontSize: `${String(size)}px`,
    lineHeight: `${String(Math.round(size * RAIL.leading))}px`,
    letterSpacing: RAIL_TRACKING,
    whiteSpace: "nowrap" as const,
  };

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        opacity: visible ? 1 : 0,
        transform: `translateY(${String(((1 - arrive) * lift).toFixed(1))}px)`,
        ...glyphs,
      }}
    >
      {boxed ? (
        // The highlighter, and this direction's scarce promoted word. Sized in em so it tracks
        // the fitted size, and it REPLACES the black keyline rather than sitting under it: a
        // filled slab plus a keyline is two edges fighting each other.
        <span
          style={{
            position: "absolute",
            left: "-0.10em",
            right: "-0.10em",
            top: "0.03em",
            bottom: "0.07em",
            backgroundColor: K.hot,
            borderRadius: "0.10em",
          }}
        />
      ) : (
        // The keyline: a second copy of the word behind the first, stroked in black. The
        // stroke is centred on the glyph outline, so half of it lands outside and reads as an
        // edge. Two spans rather than paint-order, which Chromium honours on HTML text but
        // which is an SVG property nothing else in this pipeline relies on.
        <span
          aria-hidden
          style={{
            ...glyphs,
            display: "block",
            color: K.edge,
            WebkitTextStroke: `${outline.toFixed(2)}px ${K.edge}`,
          }}
        >
          {text}
        </span>
      )}
      <span
        style={{
          ...glyphs,
          display: "block",
          position: boxed ? "relative" : "absolute",
          left: boxed ? undefined : 0,
          top: boxed ? undefined : 0,
          color: fill,
          // Manrope ExtraBold is the heaviest face in this repo and it is still not a black.
          // A stroke in the fill colour fattens it into one.
          WebkitTextStroke: boxed ? undefined : `${boost.toFixed(2)}px ${fill}`,
        }}
      >
        {text}
      </span>
    </span>
  );
};

const Line = ({ cue }: { cue: Cue }) => {
  const size = sizeFor(cue.line);
  const accent = cue.accent?.toLowerCase();
  const words = cue.line.split(" ");
  let marked = false;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: RAIL.bottom,
        // One shadow for the whole line rather than one per word, so overlapping strokes
        // cannot stack into a grey halo.
        filter: `drop-shadow(0 ${String(Math.round(size * 0.08))}px ${String(Math.round(size * 0.16))}px rgba(0,0,0,0.55))`,
      }}
    >
      <div
        style={{
          width: RAIL.box,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          gap: `${String(Math.round(size * RAIL.gap))}px`,
        }}
      >
        {words.map((word, index) => {
          const isAccent = !marked && accent !== undefined && strip(word) === accent;
          if (isAccent) {
            marked = true;
          }
          return (
            <RailWord
              key={word + String(index)}
              text={word}
              size={size}
              delay={cascade(index, WATERFALL_ENTRY.gap, WATERFALL_ENTRY.decay)}
              weight={weigh(word, isAccent)}
              mark={isAccent ? (cue.mark ?? "color") : "none"}
              instant={cue.instant === true}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * The whole track. Cues run back to back from frame 0 of the body exactly as the beats do, so
 * a cue length and a beat length are the same unit: a caption is made to change on a cut by
 * giving it the same number, and made to hold across one by giving it a bigger number.
 *
 * A cue swaps hard, on one frame, with no transition. That is what a caption track in every
 * phone editor does, and it is correct here: the rail is not a scene, so it does not get a
 * scene's seam. The incoming line's first word arrives on the same frame the outgoing line
 * clears, so there is no gap.
 */
export const Rail = ({ cues }: { cues: readonly Cue[] }) => {
  const loaded = useDisplayFonts();
  if (!loaded) {
    return null;
  }

  let at = 0;
  return (
    <>
      {cues.map((cue, index) => {
        const from = at;
        at += cue.frames;
        return (
          <Sequence
            key={cue.line + String(index)}
            from={from}
            durationInFrames={cue.frames}
            name={`rail: ${cue.line}`}
            layout="none"
          >
            <Line cue={cue} />
          </Sequence>
        );
      })}
    </>
  );
};
