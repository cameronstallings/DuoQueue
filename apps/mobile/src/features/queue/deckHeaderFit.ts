import { QUEUE_UP_PILL } from "./queueState";

/**
 * The deck header, measured rather than guessed: "Deck" on the left, and on the right the
 * Power-Up rocket (only with credits), the Queue up pill, Requests and Filters. Pure and tested
 * (deckHeaderFit.test.ts) at every iPhone width 1.0.2 ships on.
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
 */
export const DECK_TITLE_W = 68.8;
export const REQUESTS_W = 59.3;
export const FILTERS_W = 38.8;
export const ROCKET_W = 16;
export const QUEUE_PILL_W = QUEUE_UP_PILL.width;
export const CLUSTER_GAP = 12;
export const TITLE_MIN_GAP = 12;
export const SIDE_GUTTER = 24;

/** The right-hand cluster's width: the pill, Requests and Filters, and the rocket when shown. */
export function clusterWidth({ rocket }: { rocket: boolean }): number {
  const items = rocket ? [ROCKET_W, QUEUE_PILL_W, REQUESTS_W, FILTERS_W] : [QUEUE_PILL_W, REQUESTS_W, FILTERS_W];
  return items.reduce((sum, w) => sum + w, 0) + CLUSTER_GAP * (items.length - 1);
}

/** The width the cluster may take on a screen this wide: the row inside the gutters, less the
 * title and its minimum gap. */
export function headerBudget(screenWidth: number): number {
  return screenWidth - 2 * SIDE_GUTTER - DECK_TITLE_W - TITLE_MIN_GAP;
}

export function headerFits(screenWidth: number, { rocket }: { rocket: boolean }): boolean {
  return clusterWidth({ rocket }) <= headerBudget(screenWidth);
}
