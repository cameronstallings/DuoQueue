/**
 * Captions that behave like the ones people actually post: three or four lowercase words,
 * each one popping in on its own two frames after the last, one word on a filled block, and
 * then gone. Nothing fades. Nothing waits.
 *
 * The one exception is the caption on the first shot, which is marked `instant` and skips the
 * entrance entirely. A word-by-word build is the right look everywhere except frame zero,
 * where it would mean the video opens on an empty frame and loses the half second that
 * decides whether anyone watches at all.
 *
 * Sizing goes through fitText rather than a fixed scale, so a two-word line comes out huge and
 * a four-word line comes out merely large, and neither one ever runs past the safe width.
 */
import { useEffect, useState } from "react";

import { fitText } from "@remotion/layout-utils";
import { continueRender, delayRender, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { FONT_FAMILY, fontsReady } from "@/lib/fonts";
import { VIDEO_W } from "@/lib/scale";

import type { Caption } from "./edit";
import { BLOCK_INK, HOT, INK, VOLT } from "./palette";

/** Wider than the daily formats' safe box on purpose: these captions are the subject of the
 * frame rather than a line sitting under one, and the platform chrome they have to clear is
 * at the bottom and the right, not at the sides. */
const SIDE = 84;
const FIT_WIDTH = VIDEO_W - SIDE * 2;
/** Above this a caption stops reading as a caption and starts reading as a title card. */
const MAX_SIZE = 124;
const LEADING = 1.06;
const TRACKING = "-0.02em";
/** Frames between one word arriving and the next. Two is fast enough that a four word line is
 * fully up in a quarter of a second. */
const WORD_STAGGER = 2;
const WIPE_FRAMES = 5;

/** Clears the platform's own furniture: the caption and button column at the bottom of a
 * TikTok or a Reel eats roughly the last fifth of the frame. */
const LOW_BOTTOM = 372;

/**
 * A soft ellipse of shade behind the words. Not a bar and not a gradient across the frame:
 * over the dark half of the footage it is invisible, and over the Paper screens, which are
 * near white, it is the only thing that keeps white type readable. The alternative, a scrim
 * along the bottom edge, is the piece of furniture that makes a video look like an advert.
 */
const PROTECT = [
  "radial-gradient(ellipse 54% 48% at 50% 50%,",
  "rgba(0,0,0,0.62) 0%,",
  "rgba(0,0,0,0.36) 52%,",
  "rgba(0,0,0,0) 76%)",
].join(" ");

const OUTLINE = [
  "0 0 26px rgba(0,0,0,0.92)",
  "0 5px 12px rgba(0,0,0,0.7)",
  "0 2px 0 rgba(0,0,0,0.55)",
  "0 -2px 0 rgba(0,0,0,0.4)",
  "2px 0 0 rgba(0,0,0,0.4)",
  "-2px 0 0 rgba(0,0,0,0.4)",
].join(", ");

/**
 * fitText measures a real span, and @remotion/layout-utils caches every measurement for the
 * life of the page, so a measurement taken before the .ttf files land would poison every
 * later frame with a fallback-font width. Same gate as HookLine uses, and for the same reason.
 */
const useFontsLoaded = (): boolean => {
  const [loaded, setLoaded] = useState(false);
  const [handle] = useState(() => delayRender("Waiting for the faces before fitting a montage caption"));

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

const Word = ({
  word,
  index,
  caption,
  fontSize,
}: {
  word: string;
  index: number;
  caption: Caption;
  fontSize: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isAccent =
    caption.accent !== undefined && word.toLowerCase() === caption.accent.toLowerCase();
  const block = caption.accentInk === "hot" ? HOT : VOLT;

  const local = frame - index * WORD_STAGGER;
  const entrance = caption.instant
    ? 1
    : spring({ frame: local, fps, config: { damping: 13, mass: 0.55, stiffness: 220 }, durationInFrames: 14 });
  const opacity = caption.instant ? 1 : interpolate(local, [0, 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(entrance, [0, 1], [0.62, 1]);
  const lift = interpolate(entrance, [0, 1], [26, 0]);
  const wipe = caption.instant
    ? 0
    : interpolate(local, [0, WIPE_FRAMES], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `translateY(${lift}px) scale(${scale})`,
      }}
    >
      {isAccent ? (
        <span
          style={{
            display: "inline-block",
            backgroundColor: block,
            color: BLOCK_INK,
            padding: `${fontSize * 0.04}px ${fontSize * 0.14}px`,
            borderRadius: fontSize * 0.09,
            transform: "rotate(-1.6deg)",
            clipPath: `inset(0 ${wipe}% 0 0)`,
            boxShadow: "0 10px 26px rgba(0,0,0,0.45)",
          }}
        >
          {word}
        </span>
      ) : (
        <span style={{ color: INK, textShadow: OUTLINE }}>{word}</span>
      )}
    </span>
  );
};

export const CaptionBlock = ({ caption }: { caption: Caption }) => {
  const loaded = useFontsLoaded();
  const frame = useCurrentFrame();
  if (!loaded) {
    return null;
  }

  const fontFamily = FONT_FAMILY.extrabold;
  // A filled block adds its own padding to the line it sits in, and fitText cannot know that,
  // so the accent captions are measured against a narrower box than they are drawn in.
  const withinWidth = FIT_WIDTH - (caption.accent ? 90 : 0);
  const fitted = caption.lines.map(
    (line) =>
      fitText({ text: line, withinWidth, fontFamily, letterSpacing: TRACKING, validateFontIsLoaded: true })
        .fontSize,
  );
  // One size for the whole caption. Sized per line, "you swipe on" would tower over
  // "playstyles" and the two would not read as one sentence.
  const fontSize = Math.min(MAX_SIZE, Math.floor(Math.min(...fitted)));

  // Words are staggered across the whole caption and not per line, so the second line carries
  // on from where the first one stopped instead of restarting the build.
  const words = caption.lines.map((line) => line.split(" "));
  const lineOffsets = words.map((_, index) =>
    words.slice(0, index).reduce((count, line) => count + line.length, 0),
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: caption.place === "mid" ? "center" : "flex-end",
        paddingBottom: caption.place === "mid" ? 0 : LOW_BOTTOM,
        paddingLeft: SIDE,
        paddingRight: SIDE,
        fontFamily,
        fontSize: `${fontSize}px`,
        lineHeight: `${Math.round(fontSize * LEADING)}px`,
        letterSpacing: TRACKING,
      }}
    >
      {/* The words and the shade behind them share a box that hugs the text, so the ellipse
          is centred on the caption wherever the caption happens to sit. */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            position: "absolute",
            inset: `${-fontSize * 1.15}px ${-fontSize * 2.4}px`,
            backgroundImage: PROTECT,
            opacity: caption.instant
              ? 1
              : interpolate(frame, [0, 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        />
        {words.map((line, lineIndex) => (
          <div
            key={lineIndex}
            style={{
              position: "relative",
              display: "flex",
              gap: `${fontSize * 0.22}px`,
              whiteSpace: "nowrap",
              justifyContent: "center",
              paddingTop: lineIndex === 0 ? 0 : `${fontSize * 0.12}px`,
            }}
          >
            {line.map((word, index) => (
              <Word
                key={`${lineIndex}-${index}-${word}`}
                word={word}
                index={lineOffsets[lineIndex]! + index}
                caption={caption}
                fontSize={fontSize}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
