/**
 * SIZE IS SET BY MEASURE, NOT BY POINT SIZE.
 *
 * Measured across all three reels, a line's WIDTH is held roughly constant and its size falls out
 * of that:
 *
 *   "You have got options"     4 words   71.8% of frame width   ~54px  (720 space)
 *   "move your way"            3 words   63.3%                  ~86px
 *   "There's one platform"     3 words   74.4%                  ~63px  (ClickUp)
 *
 * SHORT LINES ARE BIG. The rejected direction's `TYPE_CAP = 76` was a ceiling on the wrong
 * variable: it made a three word clause the same size as a seven word sentence, which is the one
 * thing none of the references does.
 *
 * =====================================================================================
 * WHY THIS IS NOT THE FAILURE THE SIXTH DIRECTION FIXED
 * =====================================================================================
 *
 * A previous cut fitted EVERY LINE to the full frame width independently, and its size was
 * therefore decided by how many letters a word happens to contain: "APP", a three letter function
 * word, came out at roughly 500px and was the largest thing on the film's most important frame.
 * The fix at the time was one size for the whole film. That fix was right about the defect and
 * wrong about the cause, and it went too far: the defect was fitting to the BLEED with no margin
 * and no clamp, not fitting at all.
 *
 * So the rule here is narrower and it is the reference's rule. A GROUP of lines shown together
 * shares ONE size, the largest at which all of them fit the measure, clamped hard at both ends.
 * A group shown on its own gets its own size. The measure is a centred 745px column, 69% of the
 * frame, so there is 167px of air on both sides of every line in the film; the clamp stops a
 * two word clause from filling the frame edge to edge. Nothing is fitted to the bleed and nothing
 * is fitted per word.
 */
import { useEffect, useState } from "react";

import { fitText } from "@remotion/layout-utils";
import { continueRender, delayRender } from "remotion";

import { FONT_FAMILY, fontsReady } from "@/lib/fonts";

import { TYPE } from "./ground";

/** The display face. Manrope ExtraBold: the heaviest thing in the repo, and the face the end
 * card's call to action is already set in, so the film and its last frame are one typeface. */
export const DISPLAY = FONT_FAMILY.extrabold;

/** A percent off every fitted size. fitText measures to the pixel, and a pixel of overflow is a
 * wrapped line, which at this scale is a broken layout rather than a tight one. */
const SAFETY = 0.98;

/**
 * Blocks the render until the brand faces are in the document.
 *
 * fitText measures a real span in the DOM and @remotion/layout-utils memoises the result for the
 * life of the page, so a measurement taken while the .ttf files are still in flight caches
 * Chromium's fallback metrics and every later frame reuses them. The whole film would be typeset
 * for a typeface it does not contain, and it would look almost right.
 */
export const useFaces = (): boolean => {
  const [loaded, setLoaded] = useState(false);
  const [handle] = useState(() => delayRender("pro: waiting for the brand faces before fitting"));

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

const fitOne = (text: string, within: number): number =>
  fitText({
    text,
    withinWidth: within,
    fontFamily: DISPLAY,
    letterSpacing: TYPE.tracking,
    fontWeight: 800,
    validateFontIsLoaded: true,
  }).fontSize * SAFETY;

/**
 * The one size a group of lines shown together is set at: the largest that fits every one of them
 * inside the measure, clamped into the band the references measured.
 */
export const groupSize = (
  lines: readonly string[],
  measure: number = TYPE.measure,
  /**
   * The ceiling, which is TYPE.max for every caller in the three films and is a parameter only
   * because two callers in src/carousels/ need a DIFFERENT one and neither of them may change
   * this one. A display FIGURE is the picture on its card rather than a short headline, so its
   * ceiling is 412; and a three-line block is constrained by its line count rather than by its
   * width, so its ceiling is 107. Defaulted, so no existing call site changes by a pixel.
   */
  max: number = TYPE.max,
): number => {
  const smallest = lines.reduce(
    (size, line) => Math.min(size, fitOne(line, measure)),
    Number.POSITIVE_INFINITY,
  );
  // ONLY DOWNWARD. `Math.max(TYPE.min, ...)` used to sit inside this line and it is what put beat
  // one at 94.8% of the frame and ran beat three off the right edge: raising a fitted size makes
  // the line wider than the measure it was fitted to, so the clamp defeated the fit. See the TYPE
  // block in ground.ts for the measurements off the rendered frames.
  return Math.round(Math.min(max, smallest));
};

/** One word, and whether the script named it as this beat's accent. Matched whole-word and case
 * insensitively, with punctuation stripped, so "play" lights up in "and go play" and not inside
 * "playstyle", and "duo," carries the accent that "duo" was given. */
export interface Word {
  text: string;
  key: boolean;
  /** Its position in the whole group's reading order, which is what the build cadence runs on. */
  index: number;
}

export const wordsOf = (lines: readonly string[], key: string | undefined): Word[][] => {
  let index = 0;
  return lines.map((line) =>
    line.split(" ").map((text) => ({
      text,
      key:
        key !== undefined &&
        text.toLowerCase().replace(/[^a-z0-9+]/g, "") === key.toLowerCase(),
      index: index++,
    })),
  );
};

/**
 * Re-exported rather than defined here. The function is pure arithmetic on a string, but this
 * module reaches ../lib/fonts at import time and that opens a delayRender handle, so anything
 * that only wants to count words - ./cover.ts and `pnpm validate`, which both run in plain node -
 * cannot import this file. The definition moved to ./film.ts, beside `statementPlan`, which is
 * the only thing that consumes it.
 */
export { wordCount } from "./film";
