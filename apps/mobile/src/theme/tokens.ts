import type { TextStyle } from "react-native";

/**
 * DuoQueue design tokens — "Aurora".
 * Dark violet night, glass surfaces, one hero gradient (pink→violet), gold for money.
 * Depth = glow, never borders-and-plates. Texture = grain + aurora washes (see
 * components/GrainOverlay and components/AuroraBackground).
 */

export const spacing = {
  xs: 4, sm: 8, tight: 12, md: 16, lg: 24, xl: 32, xxl: 48, huge: 64,
} as const;

export const fonts = {
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
  /** Unbounded — names, screen titles, hero moments ONLY. */
  display: "Unbounded_600SemiBold",
  displayBold: "Unbounded_700Bold",
} as const;

export const type = {
  screenTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: 0 },
  cardName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  title: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  quote: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23, letterSpacing: -0.1 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  /** The ONLY uppercase style. Section labels, sparingly. */
  label: { fontFamily: fonts.extrabold, fontSize: 11, lineHeight: 14, letterSpacing: 1, textTransform: "uppercase" },
} as const satisfies Record<string, TextStyle>;

export const radius = {
  chip: 999, sm: 10, window: 16, input: 14, button: 16, md: 16, card: 20, lg: 20,
  sheet: 28, round: 999,
} as const;

/* Categorical inks — same anti-rarity-ladder rationale as before (word label always
 * accompanies; a property of the PAIR, not the person), re-hued for Aurora. */
const OVERLAP_DARK = { none: "#8E86A3", one: "#7BC7A8", two: "#8FA7E8", many: "#E8B36B" } as const;
const OVERLAP_LIGHT = { none: "#736A8C", one: "#2E7D5B", two: "#3B5BA8", many: "#A8690F" } as const;
const PLAYSTYLE_DARK = { casual: "#B9B3CC", intermediate: "#9ED4B4", competitive: "#A6BCE8", ranked_grinder: "#E4C08E" } as const;
const PLAYSTYLE_LIGHT = { casual: "#5E5878", intermediate: "#1F6E48", competitive: "#33518F", ranked_grinder: "#8F5E14" } as const;

export const darkColors = {
  background: "#14101F",
  surface: "rgba(255,255,255,0.06)",
  surfaceSolid: "#1C1728",
  surfaceAlt: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.09)",
  text: "#F0ECF7",
  textMuted: "#9C92B8",

  // heroB (and brand, which mirrors it) is darkened one notch from the original
  // hue-true violet so `onFill` (white) button/icon labels clear 4.5:1 against every
  // point in the gradient — see contrast audit, task 23. heroA was ALSO darkened by
  // that audit, but past the point of hue-true: #E00089 sits at 100% saturation,
  // which reads as hot magenta rather than pink. Retuned to hue ~334°/74% sat — still
  // clears 4.5:1 at the gradient midpoint (#B349BE, 4.55:1) but reads as pink again.
  heroA: "#E24087", heroB: "#8452F5",
  pink: "#FF6EC7",
  brand: "#8452F5",
  brandInk: "#C9B4FF",
  brandDark: "#7C3AED",
  brandSoft: "rgba(139,92,246,0.16)",
  accent: "#A78BFA",
  accentInk: "#B79CFF",
  accentSoft: "rgba(167,139,250,0.14)",
  p1Line: "#FF6EC7",
  p2Line: "#A78BFA",

  solarA: "#FFD98A", solarB: "#FF9D5C", onSolar: "#4A2A00",

  danger: "#FF5C7A",
  /** Fill-only variant for `onFill`-on-danger surfaces (ReportModal, OfflineBanner).
   * `danger` itself has to stay light enough to read as TEXT on this dark background —
   * that and "dark enough for white text to read on top of it" are contradictory for a
   * single value, so the fill gets its own darker shade of the same hue. */
  dangerDark: "#E8002B",
  success: "#4ADE9C",
  warning: "#FFC864",
  info: "#7FD4FF",
  onFill: "#FFFFFF",
  successFill: "rgba(74,222,156,0.18)",
  warningFill: "rgba(255,200,100,0.18)",

  glowViolet: "rgba(139,92,246,0.45)",
  glowPink: "rgba(255,110,199,0.45)",
  glowSolar: "rgba(255,157,92,0.35)",
  glowSuccess: "rgba(74,222,156,0.6)",

  overlap: OVERLAP_DARK,
  playstyle: PLAYSTYLE_DARK,
} as const;

export const lightColors = {
  background: "#F7F4FC",
  surface: "#FFFFFF",
  surfaceSolid: "#FFFFFF",
  surfaceAlt: "#EFEAF8",
  border: "rgba(76,58,130,0.14)",
  text: "#241A3D",
  textMuted: "#6E6390",

  // heroA darkened one notch (same hue) so `onFill` white text/icons clear 4.5:1 at
  // that end of the gradient — see contrast audit, task 23. heroB already passed.
  // Like the dark scheme, that darkening drifted the hue toward magenta (~326°);
  // retuned to hue ~333°/75% sat to read as pink, still clears 4.5:1 at the gradient
  // midpoint (#B03FBD, 4.90:1) with room to spare.
  heroA: "#E4448C", heroB: "#7C3AED",
  pink: "#C93A8C",
  brand: "#7C3AED",
  brandInk: "#6D28D9",
  brandDark: "#5B21B6",
  brandSoft: "rgba(124,58,237,0.10)",
  accent: "#7C3AED",
  accentInk: "#6D28D9",
  accentSoft: "rgba(124,58,237,0.08)",
  p1Line: "#C93A8C",
  p2Line: "#7C3AED",

  // solarA/B darkened so `onSolar` (white, in light mode) clears 4.5:1 on the gold
  // gradient, and so the Chip "solar" tone's text (solarA/solarB) clears 4.5:1 against
  // `warningFill`. danger/success/warning/info darkened so each clears 4.5:1 as plain
  // text on `background` (the stricter of background/surface) — see contrast audit.
  solarA: "#AB6314", solarB: "#9D5604", onSolar: "#FFFFFF",

  danger: "#D02A57",
  /** No fill/text conflict in light mode (darkening helps both uses), so this can
   * just equal `danger` — kept as a separate token for parity with dark mode, where
   * the fill and text values genuinely have to diverge. */
  dangerDark: "#D02A57",
  // Darkened one notch past the "plain text on background" minimum — Toast renders
  // `success` text directly on `successFill` composited over `background` (not
  // `surface`, which is the easier case Chip.tsx uses), and that composite is the
  // real bottleneck: it only clears 4.5:1 once `success` itself is dark enough.
  success: "#1A704C",
  warning: "#906400",
  info: "#1B779D",
  onFill: "#FFFFFF",
  successFill: "rgba(26,112,76,0.14)",
  warningFill: "rgba(144,100,0,0.14)",

  // Same hues as the dark-mode glows, opacity brought down to match — a colored
  // blur this strong reads as a soft accent on near-black; over white it just
  // looks muddy. See contrast audit, task 23.
  glowViolet: "rgba(124,58,237,0.25)",
  glowPink: "rgba(224,71,158,0.25)",
  glowSolar: "rgba(255,157,92,0.20)",
  glowSuccess: "rgba(74,222,156,0.33)",

  overlap: OVERLAP_LIGHT,
  playstyle: PLAYSTYLE_LIGHT,
} as const;

// Union, not `typeof darkColors` alone: both palettes are `as const` literal types,
// and the gradient helpers below take whichever one the active scheme resolved.
export type ThemeColors = typeof darkColors | typeof lightColors;

/** Colored soft glow — the ONLY depth/emphasis channel. See Global Constraints for
 * the short list of things allowed to glow. */
export function glow(color: string, r = 20) {
  return { boxShadow: `0 0 ${r}px 0 ${color}` } as const;
}

export function heroGradient(c: ThemeColors) {
  return { colors: [c.heroA, c.heroB] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
}
export function solarGradient(c: ThemeColors) {
  return { colors: [c.solarA, c.solarB] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
}

/** Photo scrim black — violet-tinted, not #000. */
export const SCRIM_RGB = "10,7,18";

export const motion = { instant: 90, quick: 140, base: 200, deliberate: 260 } as const;

/** Border width for the 1px glass hairlines (colors.border). */
export const hairline = 1;
