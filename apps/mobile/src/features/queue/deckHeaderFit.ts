import { QUEUE_UP_PILL } from "./queueState";

/**
 * The deck header, measured rather than guessed: "Deck" on the left, and on the right the
 * Power-Up rocket (only with credits), the Queue up pill, Requests and Filters. Pure and tested
 * (deckHeaderFit.test.ts) at every iPhone width 1.0.2 installs on and every iOS text size.
 *
 * THE METHOD (14 Oct 2026). Each width is the sum of the glyph advances of its text, read with
 * fontTools from the font files the app bundles (@expo-google-fonts: Unbounded_600SemiBold,
 * Manrope_600SemiBold, IBMPlexMono_500Medium), `hmtx` advance / `unitsPerEm` x the font size,
 * plus the letter spacing per character where the style sets one:
 *   "Deck"       Unbounded 600, 22pt (type.screenTitle)       68.8
 *   "Requests"   Manrope 600, 13pt (type.caption)             59.3
 *   "Filters"    Manrope 600, 13pt                            38.8
 *   rocket       the 16pt icon alone; its count is a badge    16
 *   Queue up     the pill's fixed box (queueState.ts)         84
 * Gaps: spacing.tight (12) between the cluster's items and at least 12 between the title and the
 * cluster; the screen's side gutters are spacing.lg (24) each.
 *
 * WHY THE COUNTS ARE BADGES. "Requests (9+)" written out as text is 89.0pt, and with the rocket
 * and its number beside it the row overflows a 375pt phone (an SE, a 13 mini). As badges
 * (CountBadge, absolutely placed over the corner) neither count takes row width, so the header
 * fits, and Requests and Filters never move when a count changes or the pill's label does.
 *
 * WHY THERE IS A COMPACT HEADER. 1.0.2's floor is React Native 0.81's iOS 15.1, so it also
 * installs on the 320pt iPhone SE (1st gen) and iPod touch (7th gen), which run iOS 15.8. There
 * the text cluster is 206.1pt (234.1 with the rocket) against 203.2 of room, and React Native
 * text never shrinks, so Filters would be pushed off the screen. The compact header draws Requests
 * and Filters as 16pt icons (the rocket's size; their spoken labels keep the words), which is
 * 140pt (168 with the rocket). The same switch covers large text on a 375pt phone with the rocket.
 *
 * TEXT SIZE. The pill (84pt box) and the two links do not grow with Dynamic Type
 * (maxFontSizeMultiplier 1, as the deck strip's text): at the first larger size they alone would
 * eat the title's gap on a 375pt phone, and at the second the row overflows. The title grows up to
 * DECK_TITLE_MAX_FONT_SCALE, the most the compact header leaves it room for on a 320pt phone.
 */
export const DECK_TITLE_W = 68.8;
export const REQUESTS_W = 59.3;
export const FILTERS_W = 38.8;
export const ROCKET_W = 16;
export const QUEUE_PILL_W = QUEUE_UP_PILL.width;
/** Requests and Filters in the compact header: 16pt icons, as wide as the rocket. */
export const HEADER_ICON_W = 16;
export const CLUSTER_GAP = 12;
export const TITLE_MIN_GAP = 12;
export const SIDE_GUTTER = 24;

/** The most "Deck" grows with Dynamic Type (its maxFontSizeMultiplier). At 1.3 the compact
 * header with the rocket still fits a 320pt phone (89.4 + 12 + 168 of 272); at iOS's xxxL
 * (1.353) it would not. */
export const DECK_TITLE_MAX_FONT_SCALE = 1.3;

/** The most Requests and Filters grow with Dynamic Type (their maxFontSizeMultiplier): not at all.
 * The widths above are theirs at that size. */
export const HEADER_LINK_MAX_FONT_SCALE = 1;

interface ClusterShape {
  rocket: boolean;
  /** Requests and Filters as icons. */
  compact?: boolean;
}

/** The right-hand cluster's width: the pill, Requests and Filters (as text, or as icons when
 * compact), and the rocket when shown. */
export function clusterWidth({ rocket, compact = false }: ClusterShape): number {
  const links = compact ? [HEADER_ICON_W, HEADER_ICON_W] : [REQUESTS_W, FILTERS_W];
  const items = rocket ? [ROCKET_W, QUEUE_PILL_W, ...links] : [QUEUE_PILL_W, ...links];
  return items.reduce((sum, w) => sum + w, 0) + CLUSTER_GAP * (items.length - 1);
}

/** The width the cluster may take on a screen this wide: the row inside the gutters, less the
 * title (at the text size, up to its cap) and its minimum gap. */
export function headerBudget(screenWidth: number, fontScale = 1): number {
  const titleScale = Math.min(fontScale, DECK_TITLE_MAX_FONT_SCALE);
  return screenWidth - 2 * SIDE_GUTTER - DECK_TITLE_W * titleScale - TITLE_MIN_GAP;
}

export function headerFits(
  screenWidth: number,
  { rocket, compact = false, fontScale = 1 }: ClusterShape & { fontScale?: number },
): boolean {
  return clusterWidth({ rocket, compact }) <= headerBudget(screenWidth, fontScale);
}

/** Whether the header must draw Requests and Filters as icons: only when the text links do not
 * fit at this width and text size (`useWindowDimensions()`'s width and fontScale). */
export function deckHeaderCompact(screenWidth: number, { rocket, fontScale }: { rocket: boolean; fontScale: number }): boolean {
  return !headerFits(screenWidth, { rocket, fontScale });
}
