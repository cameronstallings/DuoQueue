import type { SwipeQuota } from "@duoqueue/shared-types";

export type StripQuota = Pick<SwipeQuota, "is_premium" | "swipes_limit" | "swipes_used">;

/** The free daily limit when get_swipe_quota sends none (the old Deck caption used the same). */
export const FREE_DAILY_SWIPES = 25;

/** The strip's right-hand text, rendered uppercase. `compact` is for phones narrower than 380pt,
 * where "4 PICKED TODAY" and "18 SWIPES LEFT" do not both fit. */
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
