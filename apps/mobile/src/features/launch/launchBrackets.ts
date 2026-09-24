import { LOGO_MARK_ASPECT } from "../../theme/logo-geometry";
import { BRACKET_SIDE, BRACKET_SIZE, BRACKET_TRAVEL, MATCH_MARK_W } from "../match/matchMoment";

import { LAUNCH_MARK_W } from "./launchTiming";

/**
 * DUO LOCKED's "[" and "]", drawn as the glyphs' own outlines rather than as Text, on the match
 * screen and in the launch intro alike (LockBrackets.tsx draws them from this). They are IBM Plex
 * Mono SemiBold's (fonts.monoSemibold) bracketleft and bracketright, point for point
 * (launchBrackets.test.ts reads them out of the .ttf the app loads). As paths they need no font,
 * which matters for the intro: it plays while the app's fonts are still loading, and a Text would
 * draw the system face until they arrive. And they land exactly where they are placed, with the
 * ink centred on the mark, where a Text's line box (1.3 em in this face) leaves the vertical
 * placement to the platform: iOS dropped the match screen's 96/96 Text to the box's floor and cut
 * the top of its arms off, through build 15.
 *
 * Pure, relative imports only: tested in node, and read by the launch preview's renderer.
 */

/** Font units per em (IBM Plex Mono). */
export const BRACKET_UNITS_PER_EM = 1000;

export type BracketGlyph = "[" | "]";

interface GlyphOutline {
  /** The glyph's name in the font. */
  name: string;
  /** Advance width, font units. */
  advance: number;
  /** One closed contour, font units, y UP from the baseline, in the font's own point order. */
  points: readonly (readonly [number, number])[];
}

export const BRACKET_GLYPHS: Record<BracketGlyph, GlyphOutline> = {
  "[": {
    name: "bracketleft",
    advance: 600,
    points: [
      [195, -138],
      [195, 760],
      [506, 760],
      [506, 672],
      [299, 672],
      [299, -50],
      [506, -50],
      [506, -138],
    ],
  },
  "]": {
    name: "bracketright",
    advance: 600,
    points: [
      [405, 760],
      [405, -138],
      [94, -138],
      [94, -50],
      [301, -50],
      [301, 672],
      [94, 672],
      [94, 760],
    ],
  },
};

/** The match screen's brackets scaled to the launch mark, as the preview draws them. */
export const LAUNCH_BRACKET_SCALE = LAUNCH_MARK_W / MATCH_MARK_W;
/** The glyphs' font size: ~95.62pt. */
export const LAUNCH_BRACKET_SIZE = BRACKET_SIZE * LAUNCH_BRACKET_SCALE;
/** Room each side of the mark, to the glyph's advance box: ~51.79pt. */
export const LAUNCH_BRACKET_SIDE = BRACKET_SIDE * LAUNCH_BRACKET_SCALE;
/** How far out each bracket starts: ~39.84pt. */
export const LAUNCH_BRACKET_TRAVEL = BRACKET_TRAVEL * LAUNCH_BRACKET_SCALE;

/** The ink's top and bottom, font units, y up. Both glyphs share them. */
function inkSpan(glyph: BracketGlyph): { top: number; bottom: number } {
  const ys = BRACKET_GLYPHS[glyph].points.map(([, y]) => y);
  return { top: Math.max(...ys), bottom: Math.min(...ys) };
}

/**
 * One bracket's Svg and drawing, in points, inside a box the size of the mark (at launch, the unit
 * the pop scales). The brackets sit in a lock box BRACKET_SIDE (scaled) wider than the mark on
 * each side, the "[" in its advance box at the lock box's left edge and the "]" at its right, where
 * the match screen's Texts were, and the ink is centred on the mark's centre, which is the rings'.
 *
 * Each bracket's Svg covers the WHOLE lock box, centred on the mark, rather than just its glyph:
 * Yoga rounds every view's position to the pixel grid relative to its parent, so a glyph-sized box
 * hung off one side of the mark lands up to a device pixel from where the preview put it, and not
 * by the same amount on both sides. A box symmetric about the mark is rounded symmetrically, and
 * the viewBox then places the glyphs inside it without rounding.
 */
export interface BracketLayout {
  /** The Svg's left edge from the mark box's left edge: -BRACKET_SIDE, scaled (-LAUNCH_BRACKET_SIDE at launch). */
  left: number;
  /** The lock box: the mark plus a side each way. */
  width: number;
  /** The mark's height. */
  height: number;
  /** The Svg viewBox: the lock box in font units, y down, the ink centred vertically. */
  viewBox: string;
  /** The glyph's outline in the lock box, font units, y down. */
  path: string;
  /** translateX, in points, with the bracket all the way out (progress 0); home is 0. */
  outX: number;
}

function scaled(markWidth: number) {
  const k = markWidth / MATCH_MARK_W;
  return { size: BRACKET_SIZE * k, side: BRACKET_SIDE * k, travel: BRACKET_TRAVEL * k };
}

export function bracketLayout(glyph: BracketGlyph, markWidth = LAUNCH_MARK_W): BracketLayout {
  const { size, side, travel } = scaled(markWidth);
  const { advance, points } = BRACKET_GLYPHS[glyph];
  const width = markWidth + 2 * side;
  const height = markWidth * LOGO_MARK_ASPECT;
  const unitsPerPt = BRACKET_UNITS_PER_EM / size;
  const widthUnits = width * unitsPerPt;
  const heightUnits = height * unitsPerPt;
  const ink = inkSpan(glyph);
  // y down: the ink's centre is at -(top + bottom) / 2.
  const inkMidDown = -(ink.top + ink.bottom) / 2;
  const dx = glyph === "[" ? 0 : widthUnits - advance;
  const path = `M${points.map(([x, y]) => `${x + dx} ${-y}`).join("L")}Z`;
  return {
    left: -side,
    width,
    height,
    viewBox: `0 ${inkMidDown - heightUnits / 2} ${widthUnits} ${heightUnits}`,
    path,
    outX: glyph === "[" ? -travel : travel,
  };
}

/**
 * Every corner of a bracket's ink at home, in points from the mark's centre (y down). For the
 * tests: how far the pop swings the brackets, and how close they come to the rings.
 */
export function bracketInkPoints(glyph: BracketGlyph, markWidth = LAUNCH_MARK_W): [number, number][] {
  const { size, side } = scaled(markWidth);
  const k = size / BRACKET_UNITS_PER_EM;
  const ink = inkSpan(glyph);
  const inkMid = (ink.top + ink.bottom) / 2;
  const advance = (BRACKET_GLYPHS[glyph].advance / BRACKET_UNITS_PER_EM) * size;
  // The glyph's advance box's left edge, from the mark's centre.
  const boxLeft = glyph === "[" ? -markWidth / 2 - side : markWidth / 2 + side - advance;
  return BRACKET_GLYPHS[glyph].points.map(([x, y]) => [boxLeft + x * k, -(y - inkMid) * k]);
}
