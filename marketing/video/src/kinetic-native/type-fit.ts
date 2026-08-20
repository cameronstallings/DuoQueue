/**
 * Fitting a stack of display lines to the frame, and the font gate that has to happen first.
 *
 * Two things here are not optional and both cost a render cycle to learn the hard way.
 *
 * fitText measures a real span in the DOM and @remotion/layout-utils memoises the measurement
 * for the life of the page. React mounts while the .ttf files are still being fetched, so a
 * measurement taken then caches a fallback font width and every later frame reuses it. The
 * whole video would be typeset for a typeface it does not contain. So nothing measures until
 * `fontsReady` has resolved, and `validateFontIsLoaded` turns a slip into a failed render
 * rather than a wrong size.
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

import { LEADING, TRACKING } from "./skin";

/** Manrope ExtraBold is the heaviest face on disk and the only one that holds up at 340px.
 * Unbounded is wider and reads as a wordmark rather than as speech, so it is kept for the end
 * card where it IS the wordmark. */
export const DISPLAY_FACE = FONT_FAMILY.extrabold;

/** fitText returns the size that fits exactly. Trailing letter spacing and the sub pixel
 * rounding of several separate inline blocks can add back a pixel or two, and a line that
 * overhangs the frame edge by a pixel is the one thing in a kinetic cut that reads as broken. */
const SAFETY = 0.97;

/**
 * One delayRender handle for the whole direction rather than one per beat.
 *
 * A beat can leave the tree while the faces are still loading, and an orphaned handle stalls
 * the render until it times out. continueRender is a no-op on a handle that has already been
 * cleared, so the cleanup path is safe to run on every unmount.
 */
export const useDisplayFonts = (): boolean => {
  const [loaded, setLoaded] = useState(false);
  const [handle] = useState(() => delayRender("kinetic-native: waiting for faces before fitting"));

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

/**
 * Every line fitted to the full width independently, then the whole stack shrunk together if
 * it is taller than its budget.
 *
 * Fitting each line to the same width is the entire visual signature of this direction: a two
 * word line comes out enormous and a five word line comes out modest, so the block is flush on
 * both edges. It is also why the copy in script.ts is broken into short lines by hand.
 *
 * The shrink pass is what keeps a four line stack clear of the caption rail. It scales every
 * line by the same factor, so the flush edges survive it.
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
