import type { TextStyle } from "react-native";

/**
 * DuoQueue design tokens — "Cartridge".
 *
 * The premise: a profile is a physical object. Printed cardstock with a hard black
 * keyline, a spot-ink palette, and screen-print shadows with no blur. The previous
 * system was a competent template — pill buttons, a purple gradient, six type sizes
 * that all read at the same weight — and read as any app rather than this one.
 *
 * Three rules the whole system hangs on:
 *   1. Nothing is a pill. Radius is small and deliberate; `round` is for actual circles.
 *   2. Shadows never blur. Depth is a hard offset plate, like a misregistered print run.
 *   3. If you see a gradient, it is a photo scrim or it costs money.
 */

/* ============================================================================
 * SPACING — tighter inside surfaces, more generous between them. Printed cards
 * are dense internally and float in whitespace. `md` 16→12 and `lg` 24→16 retune
 * every existing call site on purpose: the old rhythm was uniformly loose.
 * ========================================================================== */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

/* ============================================================================
 * TYPOGRAPHY
 *
 * Three voices, and the distinction is absolute:
 *   A NAME     → Archivo Black    (people, screens, the things you look for)
 *   A SENTENCE → Archivo M/SB/B   (anything a human wrote or reads as prose)
 *   DATA       → Martian Mono     (counts, quotas, ranks, timestamps, stats)
 *   A MARQUEE  → Bungee           (the wordmark and the match moment only)
 *
 * `fontWeight` is never set alongside a named `fontFamily`. On Android that
 * synthesises bold on top of an already-bold file and smears it; on iOS it is
 * silently ignored. Weight lives in the file name.
 * ========================================================================== */
export const fonts = {
  medium: "Archivo_500Medium",
  semibold: "Archivo_600SemiBold",
  bold: "Archivo_700Bold",
  black: "Archivo_900Black",
  mono: "MartianMono_400Regular",
  monoBold: "MartianMono_700Bold",
  marquee: "Bungee_400Regular",
} as const;

/**
 * Steps: 34 → 30 → 26 → 19 → 17 → 15 → 13 → 11.
 *
 * Deliberately nothing at 16, 20, 24 or 28. Those were the sizes that made the
 * old scale collapse — 15 and 13 body text with a 20pt title reads as one
 * undifferentiated grey. The gaps here are wide enough that hierarchy is legible
 * at a glance rather than on inspection.
 *
 * 11pt only ever appears uppercase-tracked or monospaced. Type over a photo is
 * never below 13pt.
 */
export const type = {
  marquee: {
    fontFamily: fonts.marquee,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },
  screenTitle: { fontFamily: fonts.black, fontSize: 30, lineHeight: 32, letterSpacing: -0.9 },
  cardName: { fontFamily: fonts.black, fontSize: 26, lineHeight: 28, letterSpacing: -0.7 },
  title: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  quote: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, letterSpacing: 0 },
  label: {
    fontFamily: fonts.black,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  /** Numbers and machine facts. Monospace so digits do not jitter as they change. */
  stat: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  statSm: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  /** @deprecated Alias of `label`, kept so existing imports keep compiling. */
  micro: {
    fontFamily: fonts.black,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TextStyle>;

/* ============================================================================
 * RADII — the pill is dead. `round` is reserved for things that are literally
 * circular: avatars and the three deck action buttons. Nothing else.
 * ========================================================================== */
export const radius = {
  chip: 4,
  sm: 6,
  /** The photo window inside the deck card. */
  window: 8,
  md: 10,
  /** Deck card outer edge, sheets, modals. */
  lg: 14,
  round: 999,
  /** @deprecated Was 999 everywhere. Migrate to `chip` or `md`. */
  pill: 999,
} as const;

/* ============================================================================
 * PALETTE
 * ========================================================================== */

/**
 * The two brand inks — identical hex in both schemes, because a spot ink is a
 * spot ink. Red and cyan are the anaglyph pair: two plates, one image, neither
 * complete alone. That is the whole idea of the app in two colours.
 *
 * p1 owns brand, attention, unread, active tab, errors.
 * p2 owns LIKE, meter fills, your own message bubble, links.
 */
const P1 = "#FF4632"; // vermilion — 5.58:1 on dark bg. Graphic-only on light.
const P2 = "#0AD9CE"; // phosphor  — 10.69:1 on dark bg. NEVER on a light surface.

/** Darkened variants, required wherever the ink carries text on light surfaces. */
const P1_INK = "#C0231A"; // 6.01:1 on white
const P2_INK = "#00706A"; // 5.96:1 on white

/** The label ink used on every saturated fill. Warm, not #000. */
const NEAR_BLACK = "#14110D";

/**
 * OVERLAP INKS — the deck card's frame colour, encoding how many games you and
 * this person BOTH play.
 *
 * Deliberately not a rarity ladder keyed to skill level. Skill is self-declared
 * and freely editable, so a visible cosmetic reward for the top rung is a
 * standing incentive to lie — which corrupts the exact field the matching sorts
 * on. Worse, a per-person quality tier tells casual players their card is
 * trash-tier in a product about finding people to play with.
 *
 * Overlap is a property of the *pair*: the same profile is a 3-game edge to one
 * viewer and a 1-game edge to another, so it never appears on your own profile
 * and there is nothing to farm. It is always accompanied by a word label on the
 * card, so the meaning is never carried by colour alone.
 */
const OVERLAP_LIGHT = {
  none: "#7F7668",
  one: "#3E7D4E",
  two: "#2B62B8",
  many: "#9A5B10",
} as const;
const OVERLAP_DARK = {
  none: "#9A9080",
  one: "#4FCB77",
  two: "#5FA3FF",
  many: "#FFB13D",
} as const;

/**
 * PLAYSTYLE INKS — the skill chip. Four categories, not four rungs.
 *
 * Chosen at matched relative luminance (0.536–0.582, a spread of 0.046) so the
 * set reads as a legend rather than a heat ramp. A ramp would reintroduce the
 * rank ladder through the back door. All four carry NEAR_BLACK text above 10:1.
 */
const PLAYSTYLE = {
  casual: "#C9C2B4",
  intermediate: "#8FD6A6",
  competitive: "#9CC5F5",
  ranked_grinder: "#F5C06B",
} as const;

/**
 * FOIL — premium only: Power-Up, Legendary Like, subscription.
 *
 * The only gradient in the app besides photo scrims, which makes it mean
 * something: if you see a gradient, it is a photo scrim or it costs money.
 * Foil never carries white text — NEAR_BLACK clears 4.5:1 on all six stops.
 * The old brand purple survives here and nowhere else.
 */
export const foil = {
  colors: ["#FFD75E", "#FF7A3D", "#FF4632", "#B14BFF", "#3C8DFF", "#0AD9CE", "#FFD75E"] as const,
  start: { x: 0, y: 1 },
  end: { x: 1, y: 0 },
  onFoil: NEAR_BLACK,
} as const;

/** The photo scrim black — the app's own warm black, not #000000. */
export const SCRIM_RGB = "18,16,14";

export const lightColors = {
  background: "#F0EDE6",
  surface: "#FFFFFF",
  surfaceAlt: "#E6E2D9",
  border: "#D9D4C9",
  /** THE KEYLINE — a hard stroke on every raised surface. 18.16:1 on surface. */
  ink: "#191510",
  text: "#14110D",
  textMuted: "#635D53",

  brand: P1,
  brandInk: P1_INK,
  /** @deprecated Was the second stop of the Button gradient. */
  brandDark: P1_INK,
  brandSoft: "#FCE4E0",
  accent: P2,
  accentInk: P2_INK,
  accentSoft: "#D7F5F2",

  /** Non-text elements that carry meaning need 3:1 (WCAG 1.4.11). */
  p1Line: P1_INK,
  p2Line: P2_INK,

  danger: P1_INK,
  success: "#186B41",
  warning: "#8A5A00",
  info: P2_INK,
  onFill: NEAR_BLACK,

  successFill: "#7ED9A0",
  warningFill: "#FFC24D",

  overlap: OVERLAP_LIGHT,
  playstyle: PLAYSTYLE,
} as const;

export const darkColors = {
  background: "#12100E",
  surface: "#1C1A16",
  surfaceAlt: "#26231D",
  border: "#332F27",
  /** The keyline inverts in dark: the pale stock edge is what reads, not the black. */
  ink: "#7A7060",
  text: "#F5F1E8",
  textMuted: "#A69D8C",

  brand: P1,
  brandInk: P1,
  brandDark: P1,
  brandSoft: "#3A1C18",
  accent: P2,
  accentInk: P2,
  accentSoft: "#0C2E2C",

  p1Line: P1,
  p2Line: P2,

  danger: P1,
  success: "#4FCB77",
  warning: "#FFB13D",
  info: P2,
  onFill: NEAR_BLACK,

  successFill: "#4FCB77",
  warningFill: "#FFB13D",

  overlap: OVERLAP_DARK,
  playstyle: PLAYSTYLE,
} as const;

export type ThemeColors = typeof lightColors;

/* ============================================================================
 * DEPTH — screen-print, not soft elevation.
 *
 * `boxShadow` (New Architecture, which reanimated 4 already requires) renders
 * coloured zero-blur shadows identically on both platforms. The old `shadow()`
 * used shadowRadius, which blurs — and blur is what made every surface read as
 * generic Material elevation.
 *
 * Light: the plate is the near-black keyline colour, offset down-right.
 * Dark:  the same geometry in true black, since a pale plate would glow.
 * ========================================================================== */
export function shadow(scheme: "light" | "dark") {
  const plate = scheme === "light" ? "rgba(25,21,16,1)" : "rgba(0,0,0,0.9)";
  return { boxShadow: `3px 3px 0 0 ${plate}` } as const;
}

/** A deeper plate for the hero surfaces — the deck card and the match sheet. */
export function shadowLifted(scheme: "light" | "dark") {
  const plate = scheme === "light" ? "rgba(25,21,16,1)" : "rgba(0,0,0,0.9)";
  return { boxShadow: `5px 5px 0 0 ${plate}` } as const;
}

/** The pressed state: the plate collapses and the surface moves into it. */
export const pressedOffset = { transform: [{ translateX: 2 }, { translateY: 2 }] } as const;

/* ============================================================================
 * MOTION — fast and mechanical. A physical object either moves or it does not;
 * it does not ease luxuriously. Nothing here is longer than 260ms.
 * ========================================================================== */
export const motion = {
  instant: 90,
  quick: 140,
  base: 200,
  deliberate: 260,
} as const;
