/**
 * The captions, which are the video.
 *
 * Four things make these read as native rather than as a title sequence, and all four are
 * load bearing:
 *
 *   1. They sit low, just above the band TikTok and Reels cover with their own chrome.
 *   2. They are white with a hard black edge, so they stay legible over a bright Breeze
 *      skybox and over a black app screen without changing colour.
 *   3. Words pop in on a spring that overshoots. A fade is a brand tell.
 *   4. The whole phrase reserves its layout before its words appear, so nothing reflows as
 *      they arrive. Word-by-word text that shoves the line around as it goes is the clearest
 *      sign that a video was assembled by a machine.
 */
import { useEffect, useState } from "react";

import { fitText } from "@remotion/layout-utils";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { fontsReady } from "@/lib/fonts";

import { ACCENT, ACCENT_INK, CAPTION, EDGE, FACE, INK } from "./look";
import type { Cue } from "./types";

/** Tighter than the face's own default. Heavy display type at 100px wants the letters to
 * touch; at body size the same tracking would close the counters up. */
const TRACKING = "-0.015em";
/** Word gap, as a fraction of the font size. */
const GAP = 0.26;

/**
 * fitText measures a real span and @remotion/layout-utils caches every measurement for the
 * life of the page, so a measurement taken before the .ttf lands is a fallback-font width that
 * every later frame reuses. Same trap components/HookLine.tsx documents, same fix, held once
 * here for the whole caption track rather than per cue so that cues mounting and unmounting
 * under a Sequence cannot churn delayRender handles.
 */
const useFontsLoaded = (): boolean => {
  const [loaded, setLoaded] = useState(false);
  const [handle] = useState(() => delayRender("Direction A is waiting for the caption face"));

  useEffect(() => {
    let live = true;
    void fontsReady.then(() => {
      if (live) {
        setLoaded(true);
      }
    });
    return () => {
      live = false;
      continueRender(handle);
    };
  }, [handle]);

  useEffect(() => {
    if (loaded) {
      continueRender(handle);
    }
  }, [loaded, handle]);

  return loaded;
};

/** The largest size at which every line of a cue still fits the box. Per cue and not per line:
 * two lines of one phrase at two different sizes read as two captions. */
const sizeFor = (lines: readonly string[], max: number): number =>
  lines.reduce((size, line) => {
    const fitted = fitText({
      text: line,
      // The outline is centred on the glyph edge, so half of it sits outside the measured
      // width. Fitting to the full box would put that half under the frame edge.
      withinWidth: CAPTION.box * (1 - CAPTION.outline / 2),
      fontFamily: FACE,
      letterSpacing: TRACKING,
      validateFontIsLoaded: true,
    });
    return Math.min(size, Math.floor(fitted.fontSize));
  }, Math.min(max, CAPTION.maxSize));

type WordStyle = "plain" | "color" | "box";

interface WordProps {
  text: string;
  size: number;
  /** Frames after the cue starts that this word arrives. */
  delay: number;
  style: WordStyle;
  instant: boolean;
}

const Word = ({ text, size, delay, style, instant }: WordProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // damping 11 is under critical on purpose: it overshoots by about a tenth and comes back,
  // which is the pop every caption preset in every phone editor ships with.
  const pop = spring({
    fps,
    frame: frame - delay,
    config: { damping: 11, stiffness: 240, mass: 0.6 },
  });

  // The opening cue is already on screen at frame 0, because frame 0 is the whole hook. It
  // still moves: a hair of scale coming off, so the first half second is not a freeze frame.
  const scale = instant
    ? interpolate(frame, [0, 7], [1.05, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0.62 + 0.38 * pop;
  const opacity = instant
    ? 1
    : interpolate(pop, [0, 0.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const outline = size * CAPTION.outline;
  const boost = size * CAPTION.weightBoost;
  const boxed = style === "box";
  const fill = boxed ? ACCENT_INK : style === "color" ? ACCENT : INK;

  const glyphs = {
    fontFamily: FACE,
    fontSize: `${size}px`,
    lineHeight: `${size * CAPTION.leading}px`,
    letterSpacing: TRACKING,
    whiteSpace: "nowrap" as const,
  };

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        transform: `scale(${scale.toFixed(4)})`,
        opacity,
        ...glyphs,
      }}
    >
      {boxed ? (
        // The highlighter. Sized in em so it tracks the fitted size, and it replaces the black
        // edge rather than sitting under it: a yellow slab plus a keyline is two edges fighting.
        <span
          style={{
            position: "absolute",
            left: "-0.10em",
            right: "-0.10em",
            top: "0.03em",
            bottom: "0.07em",
            backgroundColor: ACCENT,
            borderRadius: "0.10em",
          }}
        />
      ) : (
        // The edge: a second copy of the word behind the first, stroked in black. The stroke is
        // centred on the glyph outline, so half of it lands outside and reads as a keyline. Two
        // spans rather than paint-order, which Chromium honours on HTML text but which is an
        // SVG property nothing else in this pipeline is relying on.
        <span
          aria-hidden
          style={{
            ...glyphs,
            display: "block",
            color: EDGE,
            WebkitTextStroke: `${outline.toFixed(2)}px ${EDGE}`,
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

const strip = (word: string): string => word.toLowerCase().replace(/[.,!?]/g, "");

const CueBlock = ({ cue }: { cue: Cue }) => {
  const size = sizeFor(cue.lines, cue.max ?? CAPTION.maxSize);
  const accent = cue.accent?.toLowerCase();
  const accentStyle: WordStyle = cue.accentStyle === "box" ? "box" : "color";
  let index = 0;
  let accented = false;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: CAPTION.bottom,
        // One shadow for the block rather than one per word, so overlapping strokes cannot
        // stack into a grey halo.
        filter: `drop-shadow(0 ${(size * 0.08).toFixed(0)}px ${(size * 0.16).toFixed(0)}px rgba(0,0,0,0.55))`,
      }}
    >
      <div
        style={{
          width: CAPTION.box,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {cue.lines.map((line, lineIndex) => (
          <div
            key={lineIndex}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: `${size * GAP}px`,
            }}
          >
            {line.split(" ").map((word, wordIndex) => {
              const delay = index * CAPTION.stagger;
              index += 1;
              const isAccent = !accented && accent !== undefined && strip(word) === accent;
              if (isAccent) {
                accented = true;
              }
              return (
                <Word
                  key={`${lineIndex}-${wordIndex}`}
                  text={word}
                  size={size}
                  delay={delay}
                  style={isAccent ? accentStyle : "plain"}
                  instant={cue.instant === true}
                />
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/**
 * The whole track. Cues run back to back from frame 0 of the body exactly as the shots do, so
 * a cue length and a shot length are the same unit: a caption is made to change on a cut by
 * giving it the same number, and made to hold across one by giving it a bigger number.
 */
export const Captions = ({ cues }: { cues: readonly Cue[] }) => {
  const loaded = useFontsLoaded();
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
            key={index}
            from={from}
            durationInFrames={cue.frames}
            name={cue.lines.join(" ")}
            layout="none"
          >
            <CueBlock cue={cue} />
          </Sequence>
        );
      })}
    </>
  );
};
