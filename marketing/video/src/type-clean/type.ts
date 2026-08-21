/**
 * TWO SIZES FOR THE WHOLE FILM, and that is the answer to both halves of Cameron's note.
 *
 * "the words on the screen are to big still i think, it feels cheap" is two complaints wearing
 * one coat, and they need different fixes.
 *
 *   CHEAP is the hierarchy. It is fixed in ./plan.ts, by naming one line per beat as the hero,
 *   and here, by setting the other line at a stated FRACTION of it rather than at whatever its
 *   own spelling fits to. The ratio between the registers is then a design decision instead of
 *   a byproduct of a word's length.
 *
 *   TOO BIG is the measure. Nothing in this film is grown until it touches an EDGE: the widest
 *   any line gets is the 844px measure, which is itself inset 118px a side, so the tightest
 *   right hand margin in the cut is 140px and the loosest is about 600. The rejected version
 *   fitted every line to the full safe box and left 72px on both sides of all of them.
 *
 * =====================================================================================
 * ONE HERO SIZE, NOT ONE PER BEAT
 * =====================================================================================
 *
 * `filmSizes` measures every hero line in the script and takes the SMALLEST fit, capped, then
 * sets all six at it. That is stronger than the approved kinetic-native rebuild, which kept a
 * family of six sizes running 340 down to 188 and defended the spread as "the longest hero
 * smallest". The spread was defensible there and it is still a spread decided by spelling, and
 * this film can afford to close it because ./plan.ts keeps every hero to one or two words.
 *
 * The consequence is the sentence worth being able to say out loud about this direction: BEAT
 * FOUR IS EXACTLY AS LARGE AS BEAT ONE. The emphasis in a beat is carried by which line is the
 * hero, never by making one hero bigger than another, and a viewer who pauses on any two frames
 * finds the same face at the same size in the same place.
 *
 * It is the same rule src/v6/type.ts states for the fragment ad, applied to a two register
 * stack instead of a one register one. The difference is which constraint binds. There the cap
 * binds and the measure never decides anything; here the MEASURE binds, through the longest
 * hero, and the cap is the guard that stops a future two letter hero from running away.
 *
 * =====================================================================================
 * THE SUPPORT IS A RATIO FIRST AND A FIT SECOND
 * =====================================================================================
 *
 * SUPPORT_RATIO, 0.32, is imported from the direction it was tuned in. Its own file states the
 * argument and the range: much under 3x and nothing on the frame is dominant, much past 4x and
 * the support stops being readable at feed size and becomes decoration.
 *
 * The fit is a GUARD and only a guard. A support line is allowed to come DOWN so that it fits
 * inside the measure, never to grow past the ratio, and like the hero it is one size for the
 * whole film: the longest support line governs, and the other five are set at it. Two support
 * sizes in one film is the accidental hierarchy this module exists to remove, just quieter.
 *
 * =====================================================================================
 * WHAT IT MEASURED, READ OFF THE RENDER RATHER THAN PREDICTED
 * =====================================================================================
 *
 * Every hero line fitted to the 844px measure, in Manrope ExtraBold at -0.03em:
 *
 *   duo 455    play 426    game 315    locked 264    message 194    they play 194
 *
 * That is the number this whole module exists for, stated plainly: left to fit, the film's
 * heroes would span 2.35 to 1 and the ranking would be alphabetical rather than editorial. The
 * biggest word in the film would be "duo" and the smallest would be "message", for no reason a
 * viewer could name and no reason connected to what the film is saying.
 *
 * The smallest fit is 193, and it is a tie: "they play" and "message" both land there, which is
 * a good sign rather than a coincidence, because it means the constraint binds twice and the
 * copy is evenly cut. So the film is set at 193 and the support at 61, a ratio of 3.16 to 1.
 * The block that builds is 347px tall: a 59px support box, 29px of register gap, a 259px hero
 * box whose bottom is TYPE_BASE on every beat.
 *
 * HERO_CAP does not bind, at 240 against a 193 that the measure decides. That is the right way
 * round: a cap that binds is a cap doing the measure's job, and the measure is the honest
 * constraint because it is the frame.
 *
 * Every support line fitted at the same measure in Manrope Medium at +0.08em:
 *
 *   DUO 347    SEND A 210    THEN GO 172    AND HOW 160    QUEUE UP WITH A 86
 *   YOU MATCH ON THE 77
 *
 * The smallest is 77 against a ratio target of 61.8, so the RATIO binds on all six and the
 * guard is never reached, with 25% of headroom on the tightest line. The support's size is a
 * design decision on every beat and a fit on none of them, which is what it was supposed to be.
 */
import { fitText } from "@remotion/layout-utils";

import { FONT_FAMILY } from "@/lib/fonts";

import {
  HERO_CAP,
  HERO_LEADING,
  HERO_TRACKING,
  MEASURE,
  REGISTER_GAP,
  SUPPORT_LEADING,
  SUPPORT_RATIO,
  SUPPORT_TRACKING,
} from "./ground";
import { heroLines, supportLines } from "./plan";

/** The display face. Manrope ExtraBold is the heaviest thing on disk, the face the end card's
 * call to action is already set in, and the one the other two ads set their headlines in. */
export const HERO_FACE = FONT_FAMILY.extrabold;

/** The label face. Medium against ExtraBold is a three step jump on the weight axis, which is
 * unmistakable; Bold against ExtraBold would be one step and would read as a rendering
 * artefact rather than as an intent. kinetic-native's choice, and its reasoning. */
export const SUPPORT_FACE = FONT_FAMILY.medium;

/** A percent off every fitted size. `fitText` measures to the pixel, several separate inline
 * blocks round independently, and a line that overhangs its measure by one pixel is the single
 * thing in a type cut that reads as broken. */
const SAFETY = 0.97;

const fitOne = (text: string, within: number, role: "hero" | "support"): number =>
  fitText({
    text,
    withinWidth: within,
    fontFamily: role === "hero" ? HERO_FACE : SUPPORT_FACE,
    letterSpacing: role === "hero" ? HERO_TRACKING : SUPPORT_TRACKING,
    validateFontIsLoaded: true,
  }).fontSize * SAFETY;

export interface FilmType {
  hero: number;
  support: number;
  /** Height of the whole two line block, which is what TYPE_BASE is subtracted from. */
  block: number;
  /** Height of the support's line box, and the top edge of the register gap under it. */
  supportBox: number;
  /** Air between the registers, which appears nowhere else in the block. */
  gap: number;
  /** Height of the hero's line box. Its BOTTOM is TYPE_BASE, on every beat. */
  heroBox: number;
}

/**
 * The film's two sizes and the block they build, measured once.
 *
 * Call it once per render, never per beat. Calling it per beat would be the per beat fitting
 * this module exists to replace, and it would also cost six DOM measurements a frame.
 */
export const filmSizes = (): FilmType => {
  const hero = Math.floor(
    Math.min(
      HERO_CAP,
      heroLines().reduce((size, line) => Math.min(size, fitOne(line, MEASURE, "hero")), HERO_CAP),
    ),
  );
  const support = Math.floor(
    supportLines().reduce(
      (size, line) => Math.min(size, fitOne(line, MEASURE, "support")),
      hero * SUPPORT_RATIO,
    ),
  );

  const supportBox = Math.round(support * SUPPORT_LEADING);
  const gap = Math.round(hero * REGISTER_GAP);
  const heroBox = Math.round(hero * HERO_LEADING);

  return { hero, support, supportBox, gap, heroBox, block: supportBox + gap + heroBox };
};
