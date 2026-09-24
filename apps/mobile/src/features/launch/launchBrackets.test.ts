import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { CY, LOGO_MARK_ASPECT, VB_H, VB_Y } from "../../theme/logo-geometry";
import { fonts } from "../../theme/tokens";
import { BRACKET_SIDE, BRACKET_SIZE, BRACKET_TRAVEL, MATCH_MARK_W } from "../match/matchMoment";

import {
  BRACKET_GLYPHS,
  BRACKET_UNITS_PER_EM,
  bracketInkPoints,
  bracketLayout,
  LAUNCH_BRACKET_SIDE,
  LAUNCH_BRACKET_SIZE,
  LAUNCH_BRACKET_TRAVEL,
} from "./launchBrackets";
import { LAUNCH_MARK_W } from "./launchTiming";

/**
 * Reads one glyph out of a TrueType file: the cmap (format 4), the advance (hmtx) and the outline
 * (a simple glyf entry). Enough for the two brackets, and nothing more.
 */
function readGlyph(font: Buffer, char: string): { unitsPerEm: number; advance: number; contours: { x: number; y: number; onCurve: boolean }[][] } {
  const tables = new Map<string, number>();
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const record = 12 + i * 16;
    tables.set(font.toString("ascii", record, record + 4), font.readUInt32BE(record + 8));
  }
  const table = (tag: string) => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`no ${tag} table`);
    return offset;
  };
  const head = table("head");
  const unitsPerEm = font.readUInt16BE(head + 18);
  const longLoca = font.readInt16BE(head + 50) === 1;

  const cmap = table("cmap");
  const code = char.charCodeAt(0);
  let glyphId = 0;
  for (let i = 0; i < font.readUInt16BE(cmap + 2) && glyphId === 0; i++) {
    const sub = cmap + font.readUInt32BE(cmap + 8 + i * 8);
    if (font.readUInt16BE(sub) !== 4) continue;
    const segX2 = font.readUInt16BE(sub + 6);
    const ends = sub + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const rangeOffsets = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const start = font.readUInt16BE(starts + 2 * s);
      if (code < start || code > font.readUInt16BE(ends + 2 * s)) continue;
      const delta = font.readInt16BE(deltas + 2 * s);
      const rangeOffset = font.readUInt16BE(rangeOffsets + 2 * s);
      if (rangeOffset === 0) glyphId = (code + delta) & 0xffff;
      else {
        const g = font.readUInt16BE(rangeOffsets + 2 * s + rangeOffset + 2 * (code - start));
        glyphId = g === 0 ? 0 : (g + delta) & 0xffff;
      }
      break;
    }
  }
  if (glyphId === 0) throw new Error(`no glyph for ${char}`);

  const hMetrics = font.readUInt16BE(table("hhea") + 34);
  const advance = font.readUInt16BE(table("hmtx") + 4 * Math.min(glyphId, hMetrics - 1));

  const loca = table("loca");
  let p = table("glyf") + (longLoca ? font.readUInt32BE(loca + 4 * glyphId) : font.readUInt16BE(loca + 2 * glyphId) * 2);
  const numberOfContours = font.readInt16BE(p);
  if (numberOfContours <= 0) throw new Error("not a simple glyph");
  p += 10;
  const endPts: number[] = [];
  for (let i = 0; i < numberOfContours; i++, p += 2) endPts.push(font.readUInt16BE(p));
  const numPoints = endPts[endPts.length - 1]! + 1;
  p += 2 + font.readUInt16BE(p);
  const flags: number[] = [];
  while (flags.length < numPoints) {
    const flag = font.readUInt8(p++);
    flags.push(flag);
    if (flag & 8) for (let repeat = font.readUInt8(p++); repeat > 0; repeat--) flags.push(flag);
  }
  const coords = (short: number, same: number) => {
    const out: number[] = [];
    let v = 0;
    for (const flag of flags) {
      if (flag & short) {
        const d = font.readUInt8(p++);
        v += flag & same ? d : -d;
      } else if (!(flag & same)) {
        v += font.readInt16BE(p);
        p += 2;
      }
      out.push(v);
    }
    return out;
  };
  const xs = coords(2, 16);
  const ys = coords(4, 32);
  const contours: { x: number; y: number; onCurve: boolean }[][] = [];
  let first = 0;
  for (const end of endPts) {
    const contour = [];
    for (let i = first; i <= end; i++) contour.push({ x: xs[i]!, y: ys[i]!, onCurve: (flags[i]! & 1) === 1 });
    contours.push(contour);
    first = end + 1;
  }
  return { unitsPerEm, advance, contours };
}

describe("the bracket glyphs", () => {
  it("are the match screen's font", () => {
    expect(fonts.monoSemibold).toBe("IBMPlexMono_600SemiBold");
  });

  it("are that font's [ and ], point for point", () => {
    const require = createRequire(import.meta.url);
    const font = readFileSync(require.resolve("@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf"));
    for (const glyph of ["[", "]"] as const) {
      const read = readGlyph(font, glyph);
      expect(read.unitsPerEm).toBe(BRACKET_UNITS_PER_EM);
      expect(read.advance).toBe(BRACKET_GLYPHS[glyph].advance);
      expect(read.contours).toHaveLength(1);
      expect(read.contours[0]!.every((pt) => pt.onCurve)).toBe(true);
      expect(read.contours[0]!.map((pt) => [pt.x, pt.y])).toEqual(BRACKET_GLYPHS[glyph].points);
    }
  });
});

describe("the brackets at launch", () => {
  it("are DUO LOCKED's, scaled to the launch mark (the preview's 95.62 / 51.79 / 39.84pt)", () => {
    const k = LAUNCH_MARK_W / MATCH_MARK_W;
    expect(LAUNCH_BRACKET_SIZE).toBeCloseTo(BRACKET_SIZE * k, 12);
    expect(LAUNCH_BRACKET_SIDE).toBeCloseTo(BRACKET_SIDE * k, 12);
    expect(LAUNCH_BRACKET_TRAVEL).toBeCloseTo(BRACKET_TRAVEL * k, 12);
    expect(LAUNCH_BRACKET_SIZE).toBeCloseTo(95.619, 3);
    expect(LAUNCH_BRACKET_SIDE).toBeCloseTo(51.794, 3);
    expect(LAUNCH_BRACKET_TRAVEL).toBeCloseTo(39.841, 3);
  });

  it("draw both in the lock box centred on the mark, the mark's height, at the font's size, unletterboxed", () => {
    for (const glyph of ["[", "]"] as const) {
      const layout = bracketLayout(glyph);
      expect(layout.left).toBeCloseTo(-LAUNCH_BRACKET_SIDE, 12);
      // Symmetric about the mark, so Yoga rounds both sides alike.
      expect(layout.left + layout.width / 2).toBeCloseTo(LAUNCH_MARK_W / 2, 12);
      expect(layout.width).toBeCloseTo(LAUNCH_MARK_W + 2 * LAUNCH_BRACKET_SIDE, 12);
      expect(layout.height).toBeCloseTo(LAUNCH_MARK_W * LOGO_MARK_ASPECT, 12);
      const [, , vbW, vbH] = layout.viewBox.split(" ").map(Number);
      expect(vbW! / vbH!).toBeCloseTo(layout.width / layout.height, 12);
      // One font unit is size / 1000 points: the glyph is drawn at LAUNCH_BRACKET_SIZE.
      expect(layout.width / vbW!).toBeCloseTo(LAUNCH_BRACKET_SIZE / BRACKET_UNITS_PER_EM, 12);
    }
    expect(bracketLayout("[").outX).toBeCloseTo(-LAUNCH_BRACKET_TRAVEL, 12);
    expect(bracketLayout("]").outX).toBeCloseTo(LAUNCH_BRACKET_TRAVEL, 12);
  });

  it("centre their ink on the mark, one the mirror of the other", () => {
    const left = bracketInkPoints("[");
    const right = bracketInkPoints("]");
    const ys = left.map(([, y]) => y);
    expect(Math.max(...ys) + Math.min(...ys)).toBeCloseTo(0, 9);
    const mirrored = right.map(([x, y]) => `${(-x).toFixed(6)},${y.toFixed(6)}`).sort();
    expect(mirrored).toEqual(left.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`).sort());
  });

  it("trace the outline as a closed path in y-down font units, the ] at the lock box's right edge", () => {
    expect(bracketLayout("[").path).toBe("M195 138L195 -760L506 -760L506 -672L299 -672L299 50L506 50L506 138Z");
    const [, , vbW] = bracketLayout("]").viewBox.split(" ").map(Number);
    const xs = [...bracketLayout("]").path.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
    expect(Math.max(...xs)).toBeCloseTo(vbW! - 600 + 405, 9);
    expect(Math.min(...xs)).toBeCloseTo(vbW! - 600 + 94, 9);
  });
});

describe("the brackets on DUO LOCKED", () => {
  const MARK_H = MATCH_MARK_W * LOGO_MARK_ASPECT;
  const LOCK_BOX_W = MATCH_MARK_W + 2 * BRACKET_SIDE;
  /** Font units to points at the match screen's size: 0.096. */
  const PT = BRACKET_SIZE / BRACKET_UNITS_PER_EM;

  it("are the match screen's numbers exactly: 96pt glyphs in the 272pt lock box, 40pt out", () => {
    for (const glyph of ["[", "]"] as const) {
      const layout = bracketLayout(glyph, MATCH_MARK_W);
      expect(layout.left).toBe(-BRACKET_SIDE);
      expect(layout.width).toBe(LOCK_BOX_W);
      expect(LOCK_BOX_W).toBe(272);
      expect(layout.height).toBeCloseTo(MARK_H, 12);
      const [, , vbW, vbH] = layout.viewBox.split(" ").map(Number);
      expect(vbW! / vbH!).toBeCloseTo(layout.width / layout.height, 12);
      expect(layout.width / vbW!).toBeCloseTo(PT, 12);
    }
    expect(bracketLayout("[", MATCH_MARK_W).outX).toBe(-BRACKET_TRAVEL);
    expect(bracketLayout("]", MATCH_MARK_W).outX).toBe(BRACKET_TRAVEL);
  });

  it("put each glyph's advance box where the old Text put it: the [ at the lock box's left edge, the ] at its right", () => {
    // From the mark's centre: the [ Text sat at left: 0, the ] at right: 0, each one advance (57.6pt) wide.
    const left = bracketInkPoints("[", MATCH_MARK_W).map(([x]) => x);
    expect(Math.min(...left)).toBeCloseTo(-LOCK_BOX_W / 2 + 195 * PT, 9);
    expect(Math.max(...left)).toBeCloseTo(-LOCK_BOX_W / 2 + 506 * PT, 9);
    const right = bracketInkPoints("]", MATCH_MARK_W).map(([x]) => x);
    expect(Math.max(...right)).toBeCloseTo(LOCK_BOX_W / 2 - (600 - 405) * PT, 9);
    expect(Math.min(...right)).toBeCloseTo(LOCK_BOX_W / 2 - (600 - 94) * PT, 9);
  });

  it("centre the ink on the rings, which are centred in the mark's box", () => {
    expect((CY - VB_Y) / VB_H).toBeCloseTo(0.5, 12);
    for (const glyph of ["[", "]"] as const) {
      const ys = bracketInkPoints(glyph, MATCH_MARK_W).map(([, y]) => y);
      expect(Math.max(...ys) + Math.min(...ys)).toBeCloseTo(0, 9);
      // 898 font units tall: 86.2pt of ink in the 105pt mark.
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(898 * PT, 9);
    }
  });
});

describe("nothing of a bracket can be clipped", () => {
  it("keeps every point of the ink inside its own Svg, at the match screen's size and the launch intro's", () => {
    for (const markWidth of [MATCH_MARK_W, LAUNCH_MARK_W]) {
      for (const glyph of ["[", "]"] as const) {
        const { width, height } = bracketLayout(glyph, markWidth);
        // The Svg is centred on the mark (and moves with its bracket), so its box is +-width/2 by +-height/2.
        for (const [x, y] of bracketInkPoints(glyph, markWidth)) {
          expect(Math.abs(x)).toBeLessThanOrEqual(width / 2);
          // At least 9pt of room above and below the ink.
          expect(height / 2 - Math.abs(y)).toBeGreaterThan(9);
        }
      }
    }
  });
});
