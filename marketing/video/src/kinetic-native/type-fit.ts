/**
 * Fitting a statement to the frame, and the font gate that has to happen first.
 *
 * =====================================================================================
 * WHY THIS FILE WAS REWRITTEN
 * =====================================================================================
 *
 * The previous version fitted EVERY line of a beat to the full frame width independently and
 * called that the direction's visual signature. It has to be named plainly: that is not a
 * hierarchy, it is the absence of one, and it is what read as cheap.
 *
 * Two things were wrong with it and the second is worse than the first.
 *
 * NO MARGINS. Fitting every line to the full width means the block runs to the bleed on both
 * sides at every line. There is no negative space anywhere in the frame by construction. Type
 * at the bleed is a poster; type with air around it is a film.
 *
 * NO HIERARCHY, AND WORSE, ACCIDENTAL HIERARCHY. Because a fitted size is inversely
 * proportional to the length of the string, the size of a word was decided by how many
 * letters it has. In the opening beat "THIS IS / NOT A / DATING / APP" that put APP, a three
 * letter function word, at roughly 500px and THIS IS at roughly 215px: the largest thing on
 * the film's most important frame was its least meaningful word, and the word the whole film
 * turns on was smaller than it. Size was being assigned by orthography.
 *
 * =====================================================================================
 * WHAT REPLACED IT: TWO SIZES, ONE MEASURE
 * =====================================================================================
 *
 * Every beat has exactly one HERO line and the rest are SUPPORT. Size is now assigned by
 * meaning, once, in the script, as `hero: number`.
 *
 *   THE HERO      fitted to `measure`, which is a FRACTION of the safe box rather than all of
 *                 it, so there is real air at both edges of the frame. Manrope ExtraBold,
 *                 tight tracking. One per beat, never two.
 *   THE SUPPORT   NOT fitted to anything by default. It is a fixed fraction of the hero, so
 *                 the ratio between the two registers is a design decision and not a
 *                 byproduct of a word's spelling. Manrope Medium, wide positive tracking.
 *                 Every support line in a beat is the SAME size, because two support sizes in
 *                 one beat is the accidental hierarchy above, just smaller.
 *
 * The support is fitted only as a GUARD: a long support line is allowed to come DOWN so that
 * it fits, never to grow past the ratio. It is fitted to a measure slightly wider than the
 * hero's (SUPPORT_MEASURE, and see there for the one line in the film that needs it), because
 * a line at a third of the size in Medium does not press on the frame edge the way a heavy
 * line does. The block still has one governing measure and the margins still hold on every
 * line rather than on the shortest one.
 *
 * Three axes separate the registers, and that is what makes it read as designed rather than
 * as two sizes of the same thing: size (about 3x), weight (800 against 500), and tracking
 * (-0.035em against +0.08em). One axis alone is an accident; three is a system.
 *
 * =====================================================================================
 * THE FONT GATE, unchanged and still not optional
 * =====================================================================================
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

import {
  HERO_LEADING,
  REGISTER_GAP,
  SUPPORT_LEADING,
  SUPPORT_MEASURE,
  SUPPORT_RATIO,
  SUPPORT_TRACKING,
  TRACKING,
} from "./skin";

/** Manrope ExtraBold is the heaviest face on disk and the only one that holds up at 350px. */
export const DISPLAY_FACE = FONT_FAMILY.extrabold;

/**
 * The support face, and the cheapest polish available in the whole direction.
 *
 * Every line used to be ExtraBold. Uniform maximum weight is shouty, and a viewer reads it as
 * a template rather than as a decision, because nothing on the frame is subordinate to
 * anything else. Medium against ExtraBold is a three step jump on the weight axis, which is
 * unmistakable; Bold against ExtraBold would be one step and would read as a rendering
 * artefact rather than as an intent.
 */
export const SUPPORT_FACE = FONT_FAMILY.medium;

/** fitText returns the size that fits exactly. Trailing letter spacing and the sub pixel
 * rounding of several separate inline blocks can add back a pixel or two, and a line that
 * overhangs its measure by a pixel is the one thing in a kinetic cut that reads as broken. */
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

export type Role = "hero" | "support";

/** One typeset line: what size, in which register, and how much air sits above it. */
export interface FittedLine {
  size: number;
  role: Role;
  leading: number;
  /** Space above this line, in pixels. Non zero only where the register changes. */
  spaceAbove: number;
}

const fitOne = (text: string, within: number, role: Role): number =>
  fitText({
    text,
    withinWidth: within,
    fontFamily: role === "hero" ? DISPLAY_FACE : SUPPORT_FACE,
    letterSpacing: role === "hero" ? TRACKING : SUPPORT_TRACKING,
    validateFontIsLoaded: true,
  }).fontSize * SAFETY;

/**
 * Typeset one beat.
 *
 * `measure` is already the scaled width: the caller multiplies the safe box by the film's type
 * scale, and because a fitted size is exactly linear in the width it is fitted to, scaling the
 * measure scales the whole block by the same factor. That is the property the two delivered
 * cuts rest on: they differ in one number and in nothing else.
 *
 * The shrink pass at the end is the only thing that could break the hero to support ratio, and
 * it cannot, because it scales every size and every gap by ONE factor. It exists so an
 * anchored beat's block cannot grow into the product it is anchored away from.
 */
export const fitStack = ({
  lines,
  hero,
  measure,
  height,
  cap,
}: {
  /** Already uppercased. Measuring the lowercase string and rendering caps is the same class
   * of bug as measuring in the wrong font. */
  lines: string[];
  /** Index of the one line that carries this beat. */
  hero: number;
  /** Width the hero is fitted to, and the widest any line in the block may be. */
  measure: number;
  /** Height budget the whole block is shrunk into. */
  height: number;
  /** Ceiling on the hero, so a one or two letter hero cannot run away. */
  cap: number;
}): FittedLine[] => {
  const heroLine = lines[hero] ?? "";
  const heroSize = Math.min(cap, fitOne(heroLine, measure, "hero"));

  // Every support line in the beat shares one size, and the LONGEST of them governs it. The
  // ratio is the design; the fit is only there so a long line cannot reach the frame edge.
  const supportCeiling = lines
    .filter((_, index) => index !== hero)
    .reduce(
      (smallest, line) => Math.min(smallest, fitOne(line, measure * SUPPORT_MEASURE, "support")),
      Number.POSITIVE_INFINITY,
    );
  const supportSize = Math.min(heroSize * SUPPORT_RATIO, supportCeiling);

  const laid: FittedLine[] = lines.map((_, index) => {
    const role: Role = index === hero ? "hero" : "support";
    const previous: Role | undefined =
      index === 0 ? undefined : index - 1 === hero ? "hero" : "support";
    return {
      size: role === "hero" ? heroSize : supportSize,
      role,
      leading: role === "hero" ? HERO_LEADING : SUPPORT_LEADING,
      // Air appears only where the register CHANGES. Two adjacent support lines stay tight, so
      // they read as one quiet block stepping down into the hero rather than as three
      // unrelated lines evenly spaced, which is what a uniform gap would give.
      spaceAbove: previous !== undefined && previous !== role ? heroSize * REGISTER_GAP : 0,
    };
  });

  const stack = laid.reduce((total, line) => total + line.size * line.leading + line.spaceAbove, 0);
  const shrink = stack > height ? height / stack : 1;

  return laid.map((line) => ({
    ...line,
    size: Math.floor(line.size * shrink),
    spaceAbove: Math.round(line.spaceAbove * shrink),
  }));
};
