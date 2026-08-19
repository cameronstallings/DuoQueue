/** One line of hook text: the thing that has to stop a thumb. Sized to the safe box,
 * entering on the app's own motion timing. */
import { useEffect, useState } from "react";

import { fitText } from "@remotion/layout-utils";
import { continueRender, delayRender } from "remotion";

import { darkColors, type as typeScale } from "@app/theme/tokens";

import { useEnter } from "@/lib/enter";
import { FONT_FAMILY, fontsReady } from "@/lib/fonts";
import { display, DISPLAY_LEADING, SAFE, VIDEO_W } from "@/lib/scale";

export type HookSize = keyof typeof display;
/** `muted` is how a line that has been superseded steps back without leaving the frame: the
 * app's own textMuted, so a Pain stack stays readable to the last line. */
export type HookTone = "ink" | "volt" | "muted";

interface HookLineProps {
  text: string;
  size?: HookSize;
  tone?: HookTone;
  /** Frames to wait before this line enters, which is how a stack of them staggers. */
  delayFrames?: number;
  /** The width this line has to fit inside. Defaults to the full safe box, which is what a
   * hook line usually owns; a Spec row shares its line with an index column and passes what
   * is left, because fitting to the whole box there would push the text past SAFE.side. */
  withinWidth?: number;
}

const FIT_WIDTH = VIDEO_W - SAFE.side * 2;

/** Display type wants tighter tracking than body type. The ratio is the app's own, lifted
 * from `type.title` (Manrope ExtraBold, -0.2 at 17pt), and expressed in em so it stays
 * proportional whichever size a line ends up fitted to. */
const TRACKING = `${typeScale.title.letterSpacing / typeScale.title.fontSize}em`;

/** The app's weight ramp, applied to the video's display scale: the biggest type is
 * ExtraBold (as `type.title` is) and everything under it is Bold (as `type.bodyStrong` is). */
const FACE: Record<HookSize, string> = {
  hero: FONT_FAMILY.extrabold,
  sub: FONT_FAMILY.bold,
  item: FONT_FAMILY.bold,
};

const INK: Record<HookTone, string> = {
  ink: darkColors.text,
  volt: darkColors.volt,
  muted: darkColors.textMuted,
};

/**
 * fitText measures a real span in the DOM, and @remotion/layout-utils memoises every
 * measurement for the life of the page. React mounts the tree while the .ttf files are
 * still being fetched, so a measurement taken then would cache a fallback-font width and
 * every later frame would reuse it: the hook would be sized for a typeface that is not in
 * the finished video, and nothing would report it.
 *
 * So: hold a delayRender handle, render nothing until the faces are in, and clear the
 * handle from an effect that runs after the fitted line has committed. Clearing it from
 * `fontsReady.then()` instead would be a race, because that callback is queued behind the
 * one in fonts.ts that has already told Remotion the frame is ready.
 */
const useFontsLoaded = (): boolean => {
  const [loaded, setLoaded] = useState(false);
  const [handle] = useState(() => delayRender("Waiting for the brand faces before fitting hook text"));

  useEffect(() => {
    let live = true;
    void fontsReady.then(() => {
      if (live) {
        setLoaded(true);
      }
    });
    // A HookLine can leave the tree mid-Sequence while the faces are still loading, and an
    // orphaned handle stalls the whole render until it times out. continueRender is a no-op
    // on a handle that is already clear, so the two paths cannot fight.
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

export const HookLine = ({
  text,
  size = "hero",
  tone = "ink",
  delayFrames = 0,
  withinWidth = FIT_WIDTH,
}: HookLineProps) => {
  const loaded = useFontsLoaded();
  const entrance = useEnter(delayFrames);

  if (!loaded) {
    return null;
  }

  const fontFamily = FACE[size];
  // The requested size is a ceiling, not a target: a short line stays at the display scale
  // and a long one shrinks to the width it was given instead of running off it. Floor, because
  // fitText returns the size that fits exactly and a rounded-up pixel overflows.
  const fitted = fitText({
    text,
    withinWidth,
    fontFamily,
    letterSpacing: TRACKING,
    // Turns "the face had not loaded when this was measured" from a silently wrong size into
    // a failed render. The gate above should make it unreachable; this is what proves it.
    validateFontIsLoaded: true,
  });
  const fontSize = Math.min(display[size], Math.floor(fitted.fontSize));

  return (
    <div
      style={{
        fontFamily,
        fontSize: `${fontSize}px`,
        lineHeight: `${fontSize * DISPLAY_LEADING}px`,
        letterSpacing: TRACKING,
        color: INK[tone],
        whiteSpace: "nowrap",
        ...entrance,
      }}
    >
      {text}
    </div>
  );
};
