/**
 * ONE SIZE FOR THE WHOLE FILM, and it is the answer to "the words are too big" and to "it looks
 * cheap" at the same time.
 *
 * Every previous cut of this film fitted type PER LINE or PER BEAT: each string was grown until
 * it touched a measure, so its size was decided by how many letters it happens to contain. Two
 * consequences, both visible in the delivered files. The film's least important word could be
 * its largest, because it was its shortest. And no two beats were ever the same size, so the
 * type had no identity of its own and read as an effect applied to copy rather than as a
 * typeface the film is set in.
 *
 * `filmSize` picks ONE size for the entire film: the largest that lets every line of every beat
 * fit the measure, capped. Nothing after that depends on spelling. Beat four is set at exactly
 * the same size as beat one, the way a page of a book is, and the emphasis in a beat is carried
 * by the accent on its key word rather than by making a word bigger than its neighbours.
 *
 * The cap is what actually binds in all three directions, which is the intended outcome: the
 * copy was written short enough that the measure never decides anything, so the size is a
 * decision each direction makes on purpose and states in one number.
 *
 * IT IS ALSO WHY THERE ARE NO ORPHANS. Cameron's note was that "SAME GAME / SAME / HOURS" left
 * an orphan SAME on its own line. Under per-line fitting a break is a fitting artefact, so an
 * orphan is inevitable eventually. Under one size the break is purely editorial, and the breaks
 * are authored in src/v6/script.ts and asserted by `pnpm validate`.
 */
import { useEffect, useState } from "react";

import { fitText } from "@remotion/layout-utils";
import { continueRender, delayRender } from "remotion";

import { FONT_FAMILY, fontsReady } from "@/lib/fonts";

import type { V6Script } from "./script";

/** The display face. Manrope ExtraBold is the heaviest thing in the repo and the face the end
 * card's call to action is already set in, so extending the end card backwards means using it
 * rather than choosing something. */
export const DISPLAY = FONT_FAMILY.extrabold;

/** Tracking for the display type at these sizes. Gentler than the previous direction's
 * -0.035em, which was tuned for 340px words and closes the counters up at 70. */
export const TRACKING = "-0.02em";

/** A percent off every fitted size. `fitText` measures to the pixel and a pixel of overflow is
 * a wrapped line, which at this scale is a broken layout rather than a tight one. */
const SAFETY = 0.98;

/** Blocks the render until the brand faces are in the document, because a size measured against
 * a fallback face is measured against the wrong glyph widths. Same handle discipline the
 * previous direction used. */
export const useFaces = (): boolean => {
  const [loaded, setLoaded] = useState(false);
  const [handle] = useState(() => delayRender("v6: waiting for the brand faces before fitting"));

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
    letterSpacing: TRACKING,
    validateFontIsLoaded: true,
  }).fontSize * SAFETY;

/**
 * The one size this film is set at, for a given measure and cap.
 *
 * Every line of every beat is measured and the smallest fit wins, so the longest line in the
 * script decides the size and every other line is set at it. Call it once per direction, never
 * per beat: calling it per beat is the per-beat fitting this function exists to replace.
 */
export const filmSize = (script: V6Script, measure: number, cap: number): number => {
  const smallest = script.beats
    .flatMap((beat) => beat.lines)
    .reduce((size, line) => Math.min(size, fitOne(line, measure)), Number.POSITIVE_INFINITY);
  return Math.floor(Math.min(cap, smallest));
};

/** Splits a line into words, marking the one the script named as this beat's key. Case
 * insensitive, and it matches whole words so "play" does not light up inside "playstyle". */
export interface Word {
  text: string;
  key: boolean;
}

export const wordsOf = (line: string, key: string | undefined): Word[] =>
  line.split(" ").map((text) => ({
    text,
    key: key !== undefined && text.toLowerCase().replace(/[^a-z0-9+]/g, "") === key.toLowerCase(),
  }));
