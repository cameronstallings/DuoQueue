/**
 * Fitting a stack of display lines to the frame, and the font gate that has to happen first.
 *
 * Two things here are not optional and both cost a render cycle to learn the hard way.
 *
 * fitText measures a real span in the DOM and @remotion/layout-utils memoises the measurement
 * for the life of the page. React mounts while the .ttf files are still being fetched, so a
 * measurement taken then caches a fallback-font width and every later frame reuses it. The
 * whole video would be typeset for a typeface it does not contain. So nothing measures until
 * `fontsReady` has resolved, and `validateFontIsLoaded` turns a slip into a failed render
 * rather than a wrong size. This is the same gate src/components/HookLine.tsx runs; it is
 * duplicated rather than exported from there because that file's copy is private to it.
 *
 * And the layout has to match the measurement. The words are separate spans so each can carry
 * its own transform, and a flex row with a gap would space them by something other than the
 * width of a space in the measured string. So the words are `inline-block` inside `pre`
 * whitespace with real space characters between them: transforms do not affect layout, so the
 * line lays out at exactly the width fitText measured.
 */
import { useEffect, useState } from "react";

import { fitText } from "@remotion/layout-utils";
import { continueRender, delayRender } from "remotion";

import { FONT_FAMILY, fontsReady } from "@/lib/fonts";

import { LEADING, TRACKING } from "./palette";

/** Manrope ExtraBold is the heaviest face in the app's own set, and the only one on disk that
 * holds up at 240px. Unbounded is wider and reads as a wordmark rather than as speech, so it
 * is kept for the end card where it is the wordmark. */
export const DISPLAY_FACE = FONT_FAMILY.extrabold;

/** fitText returns the size that fits exactly. Trailing letter-spacing and the sub-pixel
 * rounding of six separate inline-blocks can add back a pixel or two, and a line that
 * overhangs the frame edge by a pixel is the one thing in a kinetic cut that reads as broken.
 * Three percent is cheap insurance. */
const SAFETY = 0.97;

export const useKineticFonts = (): boolean => {
  const [loaded, setLoaded] = useState(false);
  const [handle] = useState(() => delayRender("Kinetic: waiting for faces before fitting type"));

  useEffect(() => {
    let live = true;
    void fontsReady.then(() => {
      if (live) {
        setLoaded(true);
      }
    });
    // A beat can leave the tree while the faces are still loading, and an orphaned handle
    // stalls the render until it times out. continueRender is a no-op on a clear handle.
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

/**
 * Every line fitted to the full width independently, then the whole stack shrunk together if
 * it is too tall for the box.
 *
 * Fitting each line to the same width is the entire visual signature of this direction: a
 * two-word line comes out enormous and a five-word line comes out smaller, so the block is
 * flush on both edges with no manual sizing anywhere in the data. It is also why the copy in
 * beats.ts is broken into short lines by hand. That is the authoring surface.
 */
export const fitStack = ({
  lines,
  width,
  height,
  cap,
}: {
  /** Already uppercased. Measuring the lowercase string and rendering caps is the same class
   * of bug as measuring in the wrong font. */
  lines: string[];
  width: number;
  height: number;
  /** Ceiling for any one line, so a single short word does not become a 700px slab that
   * pushes everything else off the frame. */
  cap: number;
}): number[] => {
  const fitted = lines.map((line) =>
    Math.min(
      cap,
      fitText({
        text: line,
        withinWidth: width,
        fontFamily: DISPLAY_FACE,
        letterSpacing: TRACKING,
        validateFontIsLoaded: true,
      }).fontSize * SAFETY,
    ),
  );

  const stack = fitted.reduce((total, size) => total + size * LEADING, 0);
  const shrink = stack > height ? height / stack : 1;

  return fitted.map((size) => Math.floor(size * shrink));
};
