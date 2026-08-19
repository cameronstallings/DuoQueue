/**
 * The mark's geometry, lifted out of components/Logo.tsx so the two trees that draw it
 * share one source of truth: the app's <Logo/> (react-native-svg) and the marketing
 * video project's Mark.tsx (DOM <svg>, rendered by Remotion in Chromium). Keep this
 * file at ZERO imports — a browser bundle has to be able to take it exactly as it is.
 *
 * Two further copies of these numbers exist and cannot consume this module, so they
 * stay hand-synced when the mark is tuned:
 *   - scripts/generate-app-icons.mjs (ringGeometry/ringsMark) recomputes them for the
 *     iOS icon set; it is a standalone node script with no TypeScript step.
 *   - site/index.html carries them as precomputed literals (cx 660.992, r 215.04,
 *     stroke-width 98.9184, nub cx 842.425508224487), baked in by scripts/build-site.mjs.
 */

/**
 * The brand mark: an O-ring and a Q-ring — the duo, locked. The Q is a
 * round-capped arc opening toward the O; one ink at two strengths, so the
 * mark sits on any surface and any colorway. Geometry mirrors
 * scripts/generate-app-icons.mjs (the icon set's source of truth) — keep the
 * constants in sync when tuning either.
 */
export const CANVAS = 1024;
export const R = CANVAS * 0.21;
export const W = R * 0.46;
export const D = R * 1.5;
export const NUDGE = CANVAS * 0.012;
export const CY = CANVAS / 2;
export const CXA = CY - NUDGE - D / 2;
export const CXB = CY - NUDGE + D / 2;
export const NUB_DIST = R + W * 0.42;
export const NUB = {
  cx: CXB + NUB_DIST * Math.SQRT1_2,
  cy: CY + NUB_DIST * Math.SQRT1_2,
  r: W * 0.56,
};
// True chain interlock: full Q circle under the O, then the Q's
// bottom-crossing segment repainted on top (butt caps — the ends land on the
// visible Q band in the same color, so the joins are seamless). Crossings sit
// at ±acos(-D/2R) = ±138.6° off the Q's leftward axis; the overlay spans ±27.5° (full band width of the lens, not just centerline).
export const SEG_S = ((138.59 - 27.5) * Math.PI) / 180;
export const SEG_E = ((138.59 + 27.5) * Math.PI) / 180;
export const SEG_PATH = `M ${CXB + R * Math.cos(SEG_S)} ${CY + R * Math.sin(SEG_S)} A ${R} ${R} 0 0 1 ${CXB + R * Math.cos(SEG_E)} ${CY + R * Math.sin(SEG_E)}`;

/** Solid 58% blend of ink toward the field — the weave paints the Q OVER the O
 * at one crossing, so translucency would tint instead of cover. */
export function mix(fg: string, bg: string, t: number) {
  const c = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const ch = (i: number) => Math.round(c(fg, i) * t + c(bg, i) * (1 - t));
  return `rgb(${ch(1)},${ch(3)},${ch(5)})`;
}
export const PAD = 4;
export const VB_X = CXA - R - W / 2 - PAD;
export const VB_Y = CY - R - W / 2 - PAD;
export const VB_W = Math.max(CXB + R + W / 2, NUB.cx + NUB.r) - VB_X + PAD;
export const VB_H = CY + R + W / 2 - VB_Y + PAD;
/** Height-per-width of the cropped mark. */
export const LOGO_MARK_ASPECT = VB_H / VB_W;
