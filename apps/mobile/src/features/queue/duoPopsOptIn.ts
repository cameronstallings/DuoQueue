import type { FlagStore } from "../tour/tourSeen";

/**
 * Who is offered the Duo Pops card, and when. Pure and tested (duoPopsOptIn.test.ts); the card
 * (DuoPopsOptInCard.tsx) only reads the stores and renders.
 *
 * WHY IT IS ASKED AT ALL. Duo Pops are opt-in (App Store 4.5.4: a push that is not about the
 * player's own account needs a yes first), and 0085 starts everyone at `queue_pop = false`, so
 * the only way a Duo Pop ever reaches anyone is this card or the Settings row. It is offered once
 * per account per phone, only to players a pop could reach (onboarded, in North America, where
 * 0085's recipient rule sends them), never while the setting is unknown or already on, and never
 * within a week of another notification ask (the deck shares one slot and one weekly cap with the
 * notification pre-ask: pushAskStore.ts).
 *
 * WHEN. Right after a like (the moment a player is thinking "I want someone to play with"), on a
 * later launch after a like ("focus", for the player whose like moment went to the pre-ask or
 * was missed), and on the empty deck, which is the other moment that pays off.
 */

export function duoPopsOfferKey(userId: string): string {
  return `duoqueue.duo-pops-offer.v1.${userId}`;
}

/** An unreadable store counts as SEEN: skipping the offer costs nothing, showing it twice is the
 * nag this flag exists to prevent. */
export async function hasSeenDuoPopsOffer(store: FlagStore, userId: string): Promise<boolean> {
  try {
    return (await store.getItem(duoPopsOfferKey(userId))) === "1";
  } catch {
    return true;
  }
}

export async function markDuoPopsOfferSeen(store: FlagStore, userId: string): Promise<void> {
  try {
    await store.setItem(duoPopsOfferKey(userId), "1");
  } catch {
    // A flag that did not stick means the card can show once more on this phone. Nothing else.
  }
}

/**
 * `notification_settings.queue_pop` from a fetched row, or undefined when the column is not
 * there: 0085 not applied (the select is `*`, so the key is simply absent), nothing loaded, or a
 * value that is not a boolean. Undefined hides the card; it never guesses "off".
 */
export function readQueuePop(settings: unknown): boolean | undefined {
  if (!settings || typeof settings !== "object") return undefined;
  const value = (settings as Record<string, unknown>).queue_pop;
  return typeof value === "boolean" ? value : undefined;
}

/** The server's NA group (`server_group(region) = 'na'`, 0071): east and west are one. Duo Pops
 * only go between NA players. */
export function isNaRegion(region: string | null | undefined): boolean {
  return region === "na_east" || region === "na_west";
}

/**
 * Whether this account should get the card at all: onboarded, in NA, the setting loaded and off,
 * and not offered on this phone before. Published to the push-ask store as `duoPopsWanted`, so the
 * notification pre-ask lets the deck's like moment go to Duo Pops.
 */
export function duoPopsWanted(input: {
  onboarded: boolean;
  inNa: boolean;
  queuePop: boolean | undefined;
  seen: boolean | undefined;
}): boolean {
  return input.onboarded && input.inNa && input.queuePop === false && input.seen === false;
}

export type DuoPopsTrigger = "like" | "focus" | "empty";

/**
 * Whether to show the card now. Never when not wanted, within a week of any notification ask, or
 * over the open Queue Up sheet (the sheet has its own notification row). A like or the empty deck
 * shows it; a deck focus only when the player liked someone in an EARLIER launch (`firstLikeAt <
 * launchStartedAt`), so the first visit of a brand-new player is never interrupted before they
 * have swiped at all.
 */
export function shouldOfferDuoPops(input: {
  wanted: boolean;
  trigger: DuoPopsTrigger;
  firstLikeAt: number | null;
  launchStartedAt: number;
  askedWithinWeek: boolean;
  queueSheetOpen: boolean;
}): boolean {
  if (!input.wanted || input.askedWithinWeek || input.queueSheetOpen) return false;
  if (input.trigger === "like" || input.trigger === "empty") return true;
  return input.firstLikeAt !== null && input.firstLikeAt < input.launchStartedAt;
}
