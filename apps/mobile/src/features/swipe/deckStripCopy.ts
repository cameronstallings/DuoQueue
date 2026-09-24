import type { SwipeQuota } from "@duoqueue/shared-types";

export type StripQuota = Pick<SwipeQuota, "is_premium" | "swipes_limit" | "swipes_used">;

/** The free daily limit when get_swipe_quota sends none (the old Deck caption used the same). */
export const FREE_DAILY_SWIPES = 25;

/** The Highlights faces on the strip. Here, not in DeckStrip.tsx, so the fit test can add them up. */
export const STRIP_FACE_SIZE = 19;
export const STRIP_FACE_OVERLAP = 6;

/**
 * Below this window width the strip says "18 LEFT" / "UNLIMITED" instead of "18 SWIPES LEFT" /
 * "UNLIMITED SWIPES". Plex Mono is 0.6em a glyph and iOS adds the tracking after each one, so the
 * row with the full copy needs 345.4pt (faces 51, "HIGHLIGHTS" 72, "4 PICKED TODAY ›" 99.2,
 * "UNLIMITED SWIPES" 99.2, three 8pt gaps) and with the short copy 302. The row gets the window
 * less 66pt (24pt Deck margins, 1pt border and 8pt padding a side): 327 at 393, 336 at 402, 348
 * at 414. So the 6.1-inch phones get the short copy and 414 up the full one; otherwise the count
 * shrinks and its ›, the strip's only tap cue, is cut off. deckStripCopy.test.ts checks the sums.
 */
export const STRIP_COMPACT_BELOW = 410;

export function stripIsCompact(windowWidth: number): boolean {
  return windowWidth < STRIP_COMPACT_BELOW;
}

/** The strip's right-hand text, rendered uppercase. `compact` is for windows where the full copy
 * does not fit beside "4 PICKED TODAY ›" (see STRIP_COMPACT_BELOW). */
export function stripQuotaLabel(quota: StripQuota | undefined, compact: boolean): string {
  if (!quota) return "";
  if (quota.is_premium) return compact ? "Unlimited" : "Unlimited swipes";
  const left = Math.max((quota.swipes_limit ?? FREE_DAILY_SWIPES) - quota.swipes_used, 0);
  if (compact) return `${left} left`;
  return `${left} ${left === 1 ? "swipe" : "swipes"} left`;
}

export function highlightsCountLabel(count: number): string {
  return `${count} picked today`;
}
