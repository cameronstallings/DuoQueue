import type { TextStyle } from "react-native";

/**
 * DuoQueue design tokens — "Volt".
 * Off-black with green warmth, solid panels split by 1px seams, ONE interactive
 * accent (volt chartreuse; olive ink on paper), amber strictly for money.
 * Depth = seams + edge-bars, never glow. Machine voice = IBM Plex Mono.
 * Paper rule: inks fill, chartreuse marks. See 2026-08-03-volt-restyle-design.md.
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
  /** IBM Plex Mono — the machine voice: labels, ticks, stats, statuses, indexes. */
  mono: "IBMPlexMono_500Medium",
  monoSemibold: "IBMPlexMono_600SemiBold",
} as const;

export const type = {
  screenTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: 0 },
  cardName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  title: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  quote: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23, letterSpacing: -0.1 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  /** The ONLY uppercase styles. label = section headers; tick = timestamps, statuses,
   * counters, index marks; chipText = chip labels. All Plex Mono. */
  label: { fontFamily: fonts.monoSemibold, fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase" },
  tick: { fontFamily: fonts.mono, fontSize: 9, lineHeight: 12, letterSpacing: 0.8, textTransform: "uppercase" },
  chipText: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, letterSpacing: 0.6, textTransform: "uppercase" },
} as const satisfies Record<string, TextStyle>;

export const radius = {
  chip: 3, sm: 4, window: 8, input: 6, button: 6, md: 8, card: 8, lg: 8,
  sheet: 16, round: 999,
} as const;

const OVERLAP_DARK = { none: "#8A927E", one: "#93B45C", two: "#B7DD3F", many: "#FFB627" } as const;
const OVERLAP_LIGHT = { none: "#66705C", one: "#4E7018", two: "#5A7A00", many: "#8F5E00" } as const;
const PLAYSTYLE_DARK = { casual: "#A8B096", intermediate: "#8FC46B", competitive: "#7FB7D9", ranked_grinder: "#E0A33E" } as const;
const PLAYSTYLE_LIGHT = { casual: "#5E6650", intermediate: "#3E6B1E", competitive: "#2F5E80", ranked_grinder: "#8A5E10" } as const;

// All pairs verified by scripts/audit-contrast.mjs (Task 12).
export const darkColors = {
  background: "#0A0B09",
  surface: "#12140F",
  surfaceSolid: "#12140F",
  surfaceAlt: "#1A1D15",
  border: "#232720",
  /** Own chat-bubble fill — a volt-tinted dark surface, distinct from surfaceAlt. */
  bubbleOwn: "#202817",
  text: "#EDF1E6",
  textMuted: "#98A18A",

  volt: "#CDFF3D",
  voltDim: "#94BC2C",
  voltSoft: "rgba(205,255,61,0.10)",
  /** Raw chartreuse. Same as volt on dark; on paper this is the ONLY chartreuse,
   * legal at ≤ chip scale with near-black text — volt itself becomes olive ink there. */
  voltRaw: "#CDFF3D",
  onVolt: "#0A0B09",

  amber: "#FFB627",
  onAmber: "#201400",
  amberSoft: "rgba(255,182,39,0.12)",

  danger: "#FF5A48",
  dangerDark: "#D8321F",
  success: "#3FD68C",
  warning: "#FFB627",
  info: "#6EC8FF",
  onFill: "#FFFFFF",
  successFill: "rgba(63,214,140,0.14)",
  warningFill: "rgba(255,182,39,0.14)",

  p1Line: "#CDFF3D",
  p2Line: "#F2F6EA",

  overlap: OVERLAP_DARK,
  playstyle: PLAYSTYLE_DARK,
} as const;

export const lightColors = {
  background: "#F2F4EB",
  surface: "#FFFFFF",
  surfaceSolid: "#FFFFFF",
  surfaceAlt: "#E7EBDB",
  border: "#C9CFBB",
  /** Own chat-bubble fill — a volt-tinted light surface, distinct from surfaceAlt. */
  bubbleOwn: "#E4EDC8",
  text: "#161A0F",
  textMuted: "#5C6450",

  volt: "#4A6B00",
  voltDim: "#3B5600",
  voltSoft: "rgba(205,255,61,0.35)",
  voltRaw: "#CDFF3D",
  onVolt: "#F7F9F0",

  amber: "#8F5E00",
  onAmber: "#FBF6EA",
  amberSoft: "rgba(143,94,0,0.12)",

  danger: "#C22E20",
  dangerDark: "#C22E20",
  success: "#17784C",
  warning: "#8F5E00",
  info: "#16688F",
  onFill: "#FFFFFF",
  successFill: "rgba(23,120,76,0.14)",
  warningFill: "rgba(143,94,0,0.14)",

  p1Line: "#4A6B00",
  p2Line: "#161A0F",

  overlap: OVERLAP_LIGHT,
  playstyle: PLAYSTYLE_LIGHT,
} as const;

// Union, not `typeof darkColors` alone: both palettes are `as const` literal types.
export type ThemeColors = typeof darkColors | typeof lightColors;

/** Photo scrim black — green-black, not #000. */
export const SCRIM_RGB = "6,8,4";

export const motion = { instant: 90, quick: 140, base: 200, deliberate: 260 } as const;

/** Border width for the 1px glass hairlines (colors.border). */
export const hairline = 1;
