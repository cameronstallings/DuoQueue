import { isCanonicalLolRankLabel, type Platform, type PlaystyleTag, type SkillLevel } from "@duoqueue/shared-types";

import { LEAGUE_GAME_NAME } from "../../swipe/cardChips";

/**
 * Everything the paywall's three pages say, and which page comes first. Pure, so every sentence
 * is unit-tested (paywallCopy.test.ts): no price on pages 1 and 2, no em dash, no dating cue,
 * and the free limits the server enforces.
 */

/** Why the player opened the paywall. Every entry point passes one (paywallHref); a deep link or
 * anything unknown is "settings", the App Review path. */
export const PAYWALL_FROM = ["settings", "limit", "filters", "requests", "superping", "powerup", "chat"] as const;
export type PaywallFrom = (typeof PAYWALL_FROM)[number];

export function parsePaywallFrom(raw: string | string[] | undefined): PaywallFrom {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (PAYWALL_FROM as readonly string[]).includes(value ?? "") ? (value as PaywallFrom) : "settings";
}

/** The one way into the paywall: `router.push(paywallHref("limit"))`. */
export function paywallHref(from: PaywallFrom) {
  return { pathname: "/paywall", params: { from } } as const;
}

export type PaywallPage = "deck" | "people" | "plans";

/** Page one is the page about why the player came; the plans are always last. The paywall
 * always opens on page one (spec §1). */
export function paywallPageOrder(from: PaywallFrom): readonly PaywallPage[] {
  return from === "requests" || from === "superping" || from === "chat"
    ? ["people", "deck", "plans"]
    : ["deck", "people", "plans"];
}

export interface HeadingCopy {
  /** Rendered uppercase (type.label). */
  label: string;
  /** Explicit line breaks keep one word from ending up alone on the last line. */
  title: string;
  body: string;
}

/** The server's free limits: 3 requests a day (0059:730-731), 10 active conversations
 * (is_conversation_unlocked, raised from 5 for 1.0.2 by the chat-cap migration S1, 0084;
 * 0004_chat.sql:111 had 5). */
export const FREE_REQUESTS_PER_DAY = 3;
export const FREE_ACTIVE_CONVERSATIONS = 10;

const DECK_BODY_TAIL = "DuoQueue+ has no daily limit, and filters that fill your deck with players you'd actually queue with.";

export function deckPageHeading(from: PaywallFrom, swipesLimit: number): HeadingCopy {
  switch (from) {
    case "limit":
      return {
        label: `${swipesLimit} of ${swipesLimit} swipes used`,
        title: "Out of swipes\nfor today.",
        // "Tomorrow" is true: the counter resets on the profile's local day (0055:167).
        body: `Free swipes come back tomorrow. ${DECK_BODY_TAIL}`,
      };
    case "filters":
      return {
        label: "DuoQueue+ filters",
        title: "Choose who\nshows up.",
        body: "Filter by game or show, platform, skill level, playstyle and recent activity, and swipe with no daily limit.",
      };
    case "powerup":
      return {
        label: "Power-Ups",
        title: "Out of\nPower-Ups.",
        body: "A Power-Up puts you near the top of other players' decks for 30 minutes. It's a one-time purchase on the last page, next to the plans.",
      };
    default:
      return {
        label: "Your deck",
        title: "Keep swiping.\nChoose who shows up.",
        body: `Free stops at ${swipesLimit} swipes a day. ${DECK_BODY_TAIL}`,
      };
  }
}

export function peoplePageHeading(from: PaywallFrom, total: number): HeadingCopy {
  if (from === "superping") {
    return {
      label: "Super Ping",
      title: "Send a Super Ping\nevery day.",
      body: "It duos their card and sends them a notification that you want to play. DuoQueue+ also shows everyone who wants to duo with you.",
    };
  }
  if (from === "chat") {
    return {
      label: "Conversations",
      title: "Keep every\nconversation open.",
      // Every chat entry is a locked conversation (the send and ping alerts, the locked banner).
      // The rule itself is the Conversations panel right below, so it is not said twice.
      body: "The conversation you opened is locked. DuoQueue+ keeps every conversation open, and shows everyone who wants to duo with you.",
    };
  }
  return {
    label: "Who wants to duo",
    title: total > FREE_REQUESTS_PER_DAY ? `${total} players want to duo with you.` : "See everyone who wants to duo.",
    body: `Free shows you ${FREE_REQUESTS_PER_DAY} a day. DuoQueue+ shows all of them now, adds a daily Super Ping, and keeps every conversation open.`,
  };
}

/** Page 3's heading. The body is "what the user will get for the price" (Guideline 3.1.2(c)). */
export const PLANS_HEADING: HeadingCopy = {
  label: "DuoQueue+",
  title: "Choose your plan.",
  body: "Unlimited swipes and conversations, every filter, everyone who wants to duo, and a Super Ping every day.",
};

export type PeoplePanel = "requests" | "superPing" | "conversations";

export function peoplePanelOrder(from: PaywallFrom): readonly PeoplePanel[] {
  if (from === "chat") return ["conversations", "requests", "superPing"];
  if (from === "superping") return ["superPing", "requests", "conversations"];
  return ["requests", "superPing", "conversations"];
}

/**
 * The panel that IS the page's topic (Conversations from a chat, Super Ping from a Super Ping)
 * sits right under the heading that already names it, so it drops its own section label and
 * title and keeps only its line: "Keep every conversation open." is never followed by
 * CONVERSATIONS and "Every conversation open".
 */
export function peoplePanelIsTopic(from: PaywallFrom, panel: PeoplePanel): boolean {
  return (from === "chat" && panel === "conversations") || (from === "superping" && panel === "superPing");
}

/** How many want to duo, as page 2 counts them: the count, or the list if it has run ahead. */
export function requestsTotal(count: number | undefined, listed: number): number {
  return Math.max(count ?? 0, Math.min(listed, FREE_REQUESTS_PER_DAY));
}

/** Each page's title, in page order: the dots' VoiceOver value names the page it turned to. */
export function paywallPageTitles(
  order: readonly PaywallPage[],
  from: PaywallFrom,
  swipesLimit: number,
  total: number,
): string[] {
  return order.map((page) =>
    page === "deck"
      ? deckPageHeading(from, swipesLimit).title
      : page === "people"
        ? peoplePageHeading(from, total).title
        : PLANS_HEADING.title,
  );
}

export type RequestsState = { kind: "none" } | { kind: "allShown" } | { kind: "hidden"; hidden: number };

/** Which honest state the requests panel draws, decided by the data. */
export function requestsState(total: number, shown: number): RequestsState {
  if (total <= 0 && shown <= 0) return { kind: "none" };
  const hidden = Math.max(total - shown, 0);
  return hidden > 0 ? { kind: "hidden", hidden } : { kind: "allShown" };
}

export function hiddenCountLabel(hidden: number): string {
  return `${hidden} more`;
}

export const REQUESTS_COPY = {
  label: "Requests",
  today: "Today",
  withPlus: "With DuoQueue+",
  hiddenLine: "want to duo with you",
  none: `No requests yet. When they come, Free shows ${FREE_REQUESTS_PER_DAY} a day and DuoQueue+ shows all of them.`,
  allShown: `Anyone past ${FREE_REQUESTS_PER_DAY} a day shows here with DuoQueue+.`,
  unknown: `Free shows ${FREE_REQUESTS_PER_DAY} requests a day. DuoQueue+ shows all of them.`,
  loading: "Loading requests",
} as const;

export function requestsIllustrationLabel(state: RequestsState, shown: number): string {
  const noun = shown === 1 ? "request" : "requests";
  switch (state.kind) {
    case "none":
      return REQUESTS_COPY.none;
    case "allShown":
      return `${shown} ${noun} today, all shown. ${REQUESTS_COPY.allShown}`;
    case "hidden":
      return `${shown} ${noun} you can see today, and ${state.hidden} more with DuoQueue+.`;
  }
}

/** Page 2's two benefit panels. Super Ping matches send_super_ping: a like plus a push. */
export const PEOPLE_EXTRAS = {
  superPingLabel: "Super Ping",
  superPingTitle: "One every day",
  superPingBody: "Duo someone and send them a notification that you want to play.",
  conversationsLabel: "Conversations",
  conversationsTitle: "Every conversation open",
  conversationsBody: `Free can message in your ${FREE_ACTIVE_CONVERSATIONS} most recently active matches. Older ones lock until you unmatch one or upgrade.`,
} as const;

export const DECK_COPY = {
  swipesToday: "Swipes today",
  free: "Free",
  withPlus: "With DuoQueue+",
  unlimited: "Unlimited",
  left: (n: number) => `${n} left`,
  filters: "DuoQueue+ filters",
  preview: "Preview from your profile",
} as const;

export function deckIllustrationLabel(left: number, limit: number): string {
  return `Free: ${left} of ${limit} swipes left today. DuoQueue+: unlimited swipes, and filters for game, platform, skill level, playstyle and recent activity.`;
}

/** What an empty filter row says. */
export const FILTER_ANY = "Any";

export interface FilterPreviewFacts {
  games: readonly { name: string; skillLevel: SkillLevel }[];
  platforms: readonly Platform[];
  playstyles: readonly PlaystyleTag[];
}

export interface FilterPreviewLabels {
  skill: Record<SkillLevel, string>;
  platform: Record<Platform, string>;
  playstyle: Record<PlaystyleTag, string>;
}

export interface FilterPreviewRow {
  key: "game" | "platform" | "skill" | "playstyle" | "active";
  label: string;
  /** Null draws FILTER_ANY. */
  value: string | null;
}

/** The DuoQueue+ filters as a picture, prefilled from the player's own profile. */
export function filterPreviewRows(facts: FilterPreviewFacts | undefined, labels: FilterPreviewLabels): FilterPreviewRow[] {
  const game = facts?.games[0];
  const platform = facts?.platforms[0];
  const playstyle = facts?.playstyles[0];
  return [
    { key: "game", label: "Game", value: game?.name ?? null },
    { key: "platform", label: "Platform", value: platform ? labels.platform[platform] : null },
    { key: "skill", label: "Skill level", value: game ? labels.skill[game.skillLevel] : null },
    { key: "playstyle", label: "Playstyle", value: playstyle ? labels.playstyle[playstyle] : null },
    { key: "active", label: "Recently active only", value: "On" },
  ];
}

/** A public_profile_games row (the view the deck reads). */
export interface RequestGameRow {
  profile_id: string;
  game_id: string;
  game_name: string;
  rank_text: string | null;
  priority: number;
}

/**
 * The line under a request on page 2: a showable League rank, else the main game, else the
 * region. Never an age (check.md #6), and never a free-text rank (only canonical League labels
 * reach strangers, as on the card).
 */
export function requestLine(
  profileId: string,
  games: readonly RequestGameRow[],
  leagueGameId: string | null,
  fallback: string,
): string {
  const own = games.filter((g) => g.profile_id === profileId).sort((a, b) => a.priority - b.priority);
  const league = leagueGameId ? own.find((g) => g.game_id === leagueGameId) : undefined;
  const rank = league?.rank_text ?? null;
  if (rank && isCanonicalLolRankLabel(rank)) return `${LEAGUE_GAME_NAME} · ${rank}`;
  return own[0]?.game_name ?? fallback;
}

export function purchaseAlert(active: boolean): { title: string; message: string } {
  return active
    ? { title: "You're on DuoQueue+", message: "Everything in DuoQueue+ is unlocked." }
    : { title: "Purchase complete", message: "DuoQueue+ turns on as soon as the App Store confirms it. That can take a minute." };
}

export function restoreAlert(active: boolean): { title: string; message: string } {
  return active
    ? { title: "Restored", message: "DuoQueue+ is active again." }
    : { title: "Nothing to restore", message: "This Apple Account has no DuoQueue+ purchase to restore." };
}

// Consumable (non-subscription) store product identifier: see README's RevenueCat setup section
// for the matching App Store Connect product. duoqueue_roses_3 is intentionally absent:
// Legendary Likes are not sold in 1.0. send_rose spends a credit and then performs an ordinary
// like, so the purchase would buy an outcome identical to a free swipe, a Guideline 3.1.1
// problem. The RPC, the credits column and the RevenueCat mapping stay put; re-adding the tile is
// the only client change needed once the like has a real effect.
export const POWER_UP_PRODUCT_ID = "duoqueue_boost_1";

export const POWER_UP_COPY = {
  description: "30 minutes near the top of other players' decks. One-time purchase, not a subscription.",
} as const;

export const POWER_UP_BOUGHT = { title: "Purchase complete", message: "Your Power-Up will appear in a moment." } as const;

export function powerUpTitle(left: number): string {
  return `Power-Up · ${left} left`;
}

export function powerUpButtonLabel(price: string | null): string {
  return price ? `Buy a Power-Up for ${price}, a one-time purchase` : "Power-Up not available";
}

export const PLANS_UNAVAILABLE = "Plans aren't available right now. Check your connection and try again shortly.";

export const SUBSCRIBER_BODY =
  "Unlimited swipes and conversations, advanced filters, everyone who wants to duo, and a daily Super Ping are all unlocked.";

export const LEGAL_LINKS = {
  restore: "Restore purchases",
  restoring: "Restoring",
  terms: "Terms of Use",
  privacy: "Privacy Policy",
} as const;

export const CONTINUE_FREE = "Continue with Free";
