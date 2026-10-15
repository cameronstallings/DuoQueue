import type { SwipeQuota } from "@duoqueue/shared-types";

export type StripQuota = Pick<SwipeQuota, "is_premium" | "swipes_limit" | "swipes_used">;

/** The free daily limit when get_swipe_quota sends none (the old Deck caption used the same). */
export const FREE_DAILY_SWIPES = 25;

/** The Highlights faces on the strip. Here, not in DeckStrip.tsx, so the fit test can add them up. */
export const STRIP_FACE_SIZE = 19;
export const STRIP_FACE_OVERLAP = 6;

/**
 * Below this window width, and only while "4 PICKED TODAY ›" is on the row, the strip says
 * "18 LEFT" / "UNLIMITED" instead of "18 SWIPES LEFT" / "UNLIMITED SWIPES". Plex Mono is 0.6em a
 * glyph and iOS adds the tracking after each one, so the row with the full copy needs 345.4pt
 * (faces 51, "HIGHLIGHTS" 72, "4 PICKED TODAY ›" 99.2, "UNLIMITED SWIPES" 99.2, three 8pt gaps)
 * and with the short copy 302. The row gets the window less 66pt (24pt Deck margins, 1pt border
 * and 8pt padding a side): 309 at 375, 327 at 393, 336 at 402, 348 at 414. So the 6.1-inch phones
 * get the short copy and 414 up the full one; otherwise the count shrinks and its ›, the strip's
 * only tap cue, is cut off. Without the count the full copy always fits (loading: skeleton 45,
 * "HIGHLIGHTS" 72, 99.2 and two gaps is 232.2). deckStripCopy.test.ts checks the sums.
 */
export const STRIP_COMPACT_BELOW = 410;

/**
 * The most the strip's text grows with Dynamic Type: none. The sums above hold only at 1x; at the
 * first step up (XL, about 1.12x) the short row needs 329pt of 327 at 393 and the › is cut again,
 * and the strip is a fixed 32pt tall. VoiceOver still gets the full copy from the strip's label.
 */
export const STRIP_MAX_FONT_SCALE = 1;

/** Whether the strip uses the short swipes copy: only on a narrow window with the count beside it. */
export function stripIsCompact(windowWidth: number, hasCount: boolean): boolean {
  return hasCount && windowWidth < STRIP_COMPACT_BELOW;
}

/** The strip's right-hand text, rendered uppercase. `compact` is for windows where the full copy
 * does not fit beside "4 PICKED TODAY ›" (see stripIsCompact). */
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

/**
 * Whether the deck may let a swipe go, from the quota it has cached. False only when the cache
 * says a free account has spent every swipe today, which is when the card bounces back with a
 * warning tap and the paywall opens, instead of flying off and then being restored when
 * perform_swipe refuses it a moment later. Undefined (not loaded yet) lets it go: the server is
 * still the one that decides, and a refusal still restores the card.
 */
export function canCommitSwipe(quota: StripQuota | undefined): boolean {
  if (!quota || quota.is_premium) return true;
  return (quota.swipes_limit ?? FREE_DAILY_SWIPES) - quota.swipes_used > 0;
}

/**
 * The quota as it will be once the swipe in flight lands, so the strip's "swipes left" moves the
 * moment a card is decided instead of a round trip later. perform_swipe counts likes and passes
 * alike (0055), so every swipe adds one. DuoQueue+ is returned as the same object (nothing to
 * count, and no needless re-render); a free quota is copied, never changed in place, because it
 * is react-query's cached object and the error path puts the previous one back.
 */
export function optimisticQuota<Q extends StripQuota>(quota: Q | undefined): Q | undefined {
  if (!quota) return undefined;
  if (quota.is_premium) return quota;
  return { ...quota, swipes_used: quota.swipes_used + 1 };
}
