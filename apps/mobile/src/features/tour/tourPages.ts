import {
  formatLolRank,
  isLolDivisionalTier,
  lolDuoRuleSummary,
  type LolDivision,
  type LolRank,
  type LolTierChoice,
  type Region,
} from "@duoqueue/shared-types";

import { PICTURE_TAG } from "../profile/pictureStatus";
import { LEAGUE_GAME_NAME } from "../swipe/cardChips";
import { FREE_DAILY_SWIPES } from "../swipe/deckStripCopy";
import type { DeckCard, DeckCardPrompt } from "../swipe/types";

/**
 * The tour after profile setup (build 17, option A): which pages it has, what they say, and Kai,
 * the example card. Pure, so every rule and sentence is unit-tested (tourPages.test.ts).
 */

export type TourPage = "card" | "canDuo" | "locked" | "yours";

export interface TourGame {
  lolTier: LolTierChoice | null;
  lolDivision: LolDivision | null;
}

export interface TourFacts {
  region: Region | null;
  games: readonly TourGame[];
}

const NA_REGIONS: readonly Region[] = ["na_east", "na_west"];

/** The player's League rank when it is one Can duo can light for: a divisional tier WITH its
 * division. Unranked, a tier without its division, and Master and above are null. */
export function tourRank(games: readonly TourGame[]): LolRank | null {
  for (const game of games) {
    if (isLolDivisionalTier(game.lolTier) && game.lolDivision !== null) {
      return { tier: game.lolTier, division: game.lolDivision };
    }
  }
  return null;
}

/** Page 2 only for a player the cell can light for: League with a rank, in NA (get_deck compares
 * ranks only between NA players, 0069_league_rank_duo.sql). */
export function showsCanDuoPage(facts: TourFacts): boolean {
  return facts.region !== null && NA_REGIONS.includes(facts.region) && tourRank(facts.games) !== null;
}

export function tourPages(facts: TourFacts): TourPage[] {
  return showsCanDuoPage(facts) ? ["card", "canDuo", "locked", "yours"] : ["card", "locked", "yours"];
}

export interface TourRankLine {
  /** Rendered uppercase: "YOU · GOLD II". */
  label: string;
  rule: string;
}

export function tourRankLine(rank: LolRank): TourRankLine {
  return { label: `You · ${formatLolRank(rank) ?? ""}`, rule: lolDuoRuleSummary(rank) ?? "" };
}

/** The caveat every Can duo claim carries (DUO_DETAIL_CAPTION's own words, shortened). */
export const CAN_DUO_CAVEAT = "Based on League's published duo rules. The League client has the final say.";

/** The status tag on Kai's picture, in the card's existing tag slot (rendered uppercase). */
export const EXAMPLE_TAG = "Example";

/**
 * Game-neutral, so they read true for both of Kai's variants (Rocket League has no minimap and
 * no picks), and every question is one a real player can pick from the prompt catalogue
 * (0010_prompts.sql, 0017_more_prompts.sql).
 */
export const KAI_PROMPTS: DeckCardPrompt[] = [
  { question: "The role I always end up playing is", answer: "Support. I cover, I call, and I type gg even when we lose." },
  { question: "A skill I'm weirdly proud of", answer: "Staying calm in comms when we're behind." },
  { question: "My comfort game is", answer: "Stardew Valley between ranked games." },
];

/**
 * Kai, an invented player with abstract art and an EXAMPLE tag. With the player's own League rank
 * (`rankLabel`, e.g. "Gold II") Kai is League in the same rank, which can always duo with itself,
 * so the lit Can duo cell is true for this player. Otherwise Kai plays Rocket League and nothing
 * lights. The age is never drawn: the tour's details line leaves it out.
 */
export function exampleCard(rankLabel: string | null): DeckCard {
  const league = rankLabel !== null;
  return {
    profile_id: "tour-example-kai",
    display_name: "Kai",
    age: 0,
    gender: "prefer_not_to_say",
    region: "na_east",
    bio: null,
    shared_games_count: 2,
    shared_shows_count: 0,
    score: 0,
    lol_duo_eligible: league,
    profilePhotoUrl: null,
    headerPhotoUrl: null,
    topGames: league
      ? [{ name: LEAGUE_GAME_NAME, skillLevel: "competitive", isLeague: true }]
      : [{ name: "Rocket League", skillLevel: "casual", isLeague: false }],
    topShows: [],
    languages: ["en"],
    platforms: league ? ["pc"] : ["pc", "switch"],
    playstyles: [],
    prompts: KAI_PROMPTS,
    isRecentlyActive: false,
    vibe: null,
    playWindowLabel: null,
    lolRank: rankLabel,
  };
}

export interface TourCopy {
  /** Rendered uppercase (type.label). */
  heading: string;
  title: string;
  body: string;
}

/** A no-break space, spelled by its code so it can be seen in source and never pasted in raw. */
const NBSP = String.fromCharCode(0xa0);

/**
 * Titles on pages 2 and 3 keep a no-break space (NBSP) so they break well. Page 3's limit is the
 * Deck's own constant, so the tour and the paywall's Deck page always name the same number.
 */
export const TOUR_COPY: Record<TourPage, TourCopy> = {
  card: {
    heading: "The card",
    title: "Tap for their prompts.",
    body: "Pictures first, then prompts. Tap the right side of a card for the next page and the left side to go back. Try it here.",
  },
  canDuo: {
    heading: "Can duo",
    title: `Lit up means you can${NBSP}queue.`,
    body: "Can duo lights up when the ranks you both listed can queue Ranked Solo/Duo together.",
  },
  locked: {
    heading: "Duo locked",
    title: `Both queue up. Duo${NBSP}locked.`,
    body: `Swipe the card or tap the bolt to queue up. When they queue up with you too, chat opens. Free accounts get ${FREE_DAILY_SWIPES} swipes a day.`,
  },
  yours: {
    heading: "Your card",
    title: "This is your card.",
    body: "It's what players see in their deck. Tap through it, and change anything later from Profile.",
  },
};

export const YOUR_CARD_BODY = {
  review: "It's what players see in their deck. Until your picture is approved, they see your initial.",
  add: "It's what players see in their deck. Add a picture any time from Profile.",
} as const;

/** Page 4's sentence follows the picture state the card shows (pictureStatus.ts). */
export function yourCardBody(pictureTag: string | null): string {
  if (pictureTag === PICTURE_TAG.review) return YOUR_CARD_BODY.review;
  if (pictureTag === PICTURE_TAG.add || pictureTag === PICTURE_TAG.rejected) return YOUR_CARD_BODY.add;
  return TOUR_COPY.yours.body;
}

export const LOCKED_COPY = {
  stamp: "DUO LOCKED",
  line: "You and Kai both queued up.",
  chatLabel: "Chat with Kai",
} as const;

export const TAP_HINT = { next: "Next page ›", back: "‹ Back" } as const;

export const TOUR_FOOT = { skip: "Skip", start: "Start swiping", dotsLabel: "Tour page" } as const;

/** A short, neutral chat: games, Discord, the lobby. Nothing that reads like a date (check.md #12). */
export const TOUR_CHAT: readonly { from: "kai" | "you"; text: string }[] = [
  { from: "kai", text: "Want to run a few ranked games later?" },
  { from: "you", text: "Sure, I'm on from 8. What's your Discord?" },
  { from: "kai", text: "Sent it. See you in the lobby." },
];

/**
 * Below this picture height the chat keeps its last two bubbles and the lock mark is drawn
 * smaller, so page 3 never overflows. Measured on the render: at 393pt wide the three bubbles
 * need a picture of 417pt, so 430 leaves a narrower phone room for one more wrapped line.
 */
export const TOUR_FULL_CHAT_HEIGHT = 430;

export function tourChat(pictureHeight: number): readonly { from: "kai" | "you"; text: string }[] {
  return pictureHeight < TOUR_FULL_CHAT_HEIGHT ? TOUR_CHAT.slice(1) : TOUR_CHAT;
}

/** The picture area: 458pt on a 393 x 852 phone (71pt down, text block at 549), never under 280. */
export const TOUR_PICTURE_MAX = 458;
export const TOUR_PICTURE_MIN = 280;
/**
 * Everything on a tour page but the picture and the safe area: 12 above the picture, 20 to the
 * text block, its 154, and the foot's dots, Skip slot and margin (138 less the 34 home-indicator
 * inset). 852 - 59 - 34 - 301 = 458. The insets are the phone's own, so an iPhone SE (20 / 0)
 * gets the 93pt its missing notch and home indicator leave, instead of a picture cut to 280 over
 * empty space (found by rendering at 375 x 667).
 */
const TOUR_CHROME = 301;

export function tourPictureHeight(windowHeight: number, insets: { top: number; bottom: number }): number {
  const room = windowHeight - insets.top - insets.bottom - TOUR_CHROME;
  return Math.max(TOUR_PICTURE_MIN, Math.min(TOUR_PICTURE_MAX, room));
}
