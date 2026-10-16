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
import { duoPopsWanted, isNaRegion } from "../queue/duoPopsOptIn";
import { LEAGUE_GAME_NAME } from "../swipe/cardChips";
import { FREE_DAILY_SWIPES } from "../swipe/deckStripCopy";
import type { DeckCard, DeckCardPrompt } from "../swipe/types";

/**
 * The tour after profile setup (build 17, option A): which pages it has, what they say, and Kai,
 * the example card. Pure, so every rule and sentence is unit-tested (tourPages.test.ts).
 *
 * Build 22 adds the Queue up page ("queue"), so a new player hears about the deck's Queue up
 * button and Duo Pops before their first deck, not only from the header they have never tapped.
 */

export type TourPage = "card" | "canDuo" | "locked" | "queue" | "yours";

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

/**
 * Queue up is for every player (it works for every game, and the LFG post works anywhere), so it
 * is on every tour, after Duo locked (the like explained first, then the faster way to a duo) and
 * before the player's own card, which stays last so the tour still ends on Start swiping beside it.
 */
export function tourPages(facts: TourFacts): TourPage[] {
  return showsCanDuoPage(facts)
    ? ["card", "canDuo", "locked", "queue", "yours"]
    : ["card", "locked", "queue", "yours"];
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
    // Kai lists one game, so the "In common" cell can never honestly say more than one.
    shared_games_count: 1,
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
 * The Queue up page's body, by where the player is. Only true things, in the sheet's own words
 * (queueCopy.ts):
 *  - "na": a Duo Pop goes to players in your game who turned Duo Pops on (0085's recipient rule:
 *    the switch is opt-in and starts off), and the first to tap I'm in is the duo (0088, one duo
 *    per Queue up). Every Queue up also gets a call code, so the LFG post is always there.
 *  - "other": outside North America, and when the region is unknown, no pop is ever sent
 *    (0085's `outside_na`), so the page says what Queue up still does: Online Now for the hour,
 *    or until a duo is found ("up to an hour"), and the post with its code.
 * Neither promises a count or a time: how many hear depends on who is on.
 */
export const TOUR_QUEUE_BODY = {
  na: "Players in your game who turned on Duo Pops get a ping. The first to tap I'm in is your duo. Or share an LFG post with your code.",
  other:
    "You show in Online Now for up to an hour. Duo Pops reach North America for now. You can still share an LFG post with your code.",
} as const;

/** The Queue up page's body for the player's region (frozen with the tour's pages). */
export function queueTourBody(region: Region | null): string {
  return isNaRegion(region) ? TOUR_QUEUE_BODY.na : TOUR_QUEUE_BODY.other;
}

/**
 * Titles on pages 2, 3 and Queue up keep a no-break space (NBSP) so they break well. Duo locked's
 * limit is the Deck's own constant, so the tour and the paywall's Deck page always name the same
 * number.
 */
export const TOUR_COPY: Record<TourPage, TourCopy> = {
  card: {
    heading: "The card",
    title: "Tap for their prompts.",
    // A card has at most one picture (cardPages), as the store copy promises.
    body: "The picture first, then prompts. Tap the right side of a card for the next page and the left side to go back. Try it here.",
  },
  canDuo: {
    heading: "Can duo",
    title: `Lit up means you can${NBSP}queue.`,
    body: "Can duo lights up when the ranks you both listed can queue Ranked Solo/Duo together.",
  },
  locked: {
    heading: "Duo locked",
    title: `Both queue up. Duo${NBSP}locked.`,
    // "duo", not "queue up": from 1.0.2 "Queue up" is the deck's button for going online, so it
    // can no longer also mean a like. The title and DUO LOCKED keep "both queued up".
    body: `Swipe the card or tap the bolt to duo. When they duo you back, chat opens. Free accounts get ${FREE_DAILY_SWIPES} swipes a day.`,
  },
  queue: {
    heading: "Queue up",
    title: `Ready to play? Queue${NBSP}up.`,
    // The NA sentence; welcome.tsx picks by region through queueTourBody.
    body: TOUR_QUEUE_BODY.na,
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

/** The last page's sentence follows the picture state the card shows (pictureStatus.ts). */
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

/**
 * What VoiceOver calls the card whose pages a tour page's tap zones turn, so "Kai's card, next
 * page" is never mistaken for the tour's own dots ("Tour page, 1 of 5").
 */
export const TOUR_CARD_NAME = { kai: "Kai's card", yours: "Your card" } as const;

export const TOUR_FOOT = { skip: "Skip", start: "Start swiping", dotsLabel: "Tour page" } as const;

/** Leaving the tour needs the profile the wizard just finished; offline, the tour stays put. */
export const TOUR_OFFLINE = "Can't reach DuoQueue. Try again.";

/** A short, neutral chat: games, Discord, the lobby. Nothing that reads like a date (check.md #12). */
export const TOUR_CHAT: readonly { from: "kai" | "you"; text: string }[] = [
  { from: "kai", text: "Want to run a few ranked games later?" },
  { from: "you", text: "Sure, I'm on from 8. What's your Discord?" },
  { from: "kai", text: "Sent it. See you in the lobby." },
];

/** Who says a bubble, for VoiceOver: the picture tells it only by side and colour. */
export function tourChatSpoken(line: { from: "kai" | "you"; text: string }): string {
  return `${line.from === "you" ? "You" : "Kai"}: ${line.text}`;
}

/**
 * Below this picture height page 3 starts short: the lock mark is drawn smaller and the chat keeps
 * two bubbles. Measured on the render: at 393pt wide the three bubbles need a picture of 417pt,
 * so 430 leaves a narrower phone room for one more wrapped line.
 */
export const TOUR_FULL_CHAT_HEIGHT = 430;

/**
 * How far page 3 gives way to fit its picture area. 0: as designed. 1, short: the smaller mark and
 * two bubbles. 2, compact: short, and without the line under the mark ("You and Kai both queued
 * up.", which the heading below already says). A short phone starts at 1; every time the page
 * measures taller than its picture area (a larger text size wraps the bubbles onto more lines)
 * it takes one more step. Past 2 the page scrolls.
 */
export type LockedFit = 0 | 1 | 2;

export function tourLockedFit(pictureHeight: number, overflowSteps: number): LockedFit {
  const start = pictureHeight < TOUR_FULL_CHAT_HEIGHT ? 1 : 0;
  return Math.min(2, start + Math.max(0, overflowSteps)) as LockedFit;
}

/** Short keeps the first two bubbles: Kai's question and its answer, a whole exchange. */
export function tourChat(fit: LockedFit): readonly { from: "kai" | "you"; text: string }[] {
  return fit > 0 ? TOUR_CHAT.slice(0, 2) : TOUR_CHAT;
}

/** Who the example notice on the Queue up page is from, and when (rendered uppercase). */
export const TOUR_POP = { app: "DuoQueue", when: "now" } as const;

export interface TourPopPush {
  title: string;
  body: string;
}

/** "A" or "An" by the next word's first letter, as the server's push does ("An Emerald IV"). */
function article(next: string): "A" | "An" {
  return /^[aeiou]/i.test(next) ? "An" : "A";
}

/**
 * The Duo Pop push Kai's Queue up would send this player, word for word what send-push-notification
 * writes (supabase/functions/send-push-notification/duoPopCopy.ts; the test holds the two
 * together). It names nobody, as the real one never does.
 *
 * Kai is the same Kai as page 1 (exampleCard): with the player's own League rank (`rankLabel`,
 * NA and ranked only), League in that rank, which can always duo with itself, so the push is the
 * can-duo one and true for this player. Otherwise Rocket League, rank-less, the first of the three
 * rank-less bodies (the one that says I'm in).
 */
export function tourPopPush(rankLabel: string | null): TourPopPush {
  const game = exampleCard(rankLabel).topGames[0]?.name ?? LEAGUE_GAME_NAME;
  if (rankLabel !== null) {
    return {
      title: "Duo Pop",
      body: `${article(rankLabel)} ${rankLabel} player who can duo with you (by rank) is queueing ${game} now.`,
    };
  }
  return { title: "Duo Pop", body: `${article(game)} ${game} player is queueing now. First to tap I'm in gets the duo.` };
}

/** The notice for VoiceOver, as one element: "Duo Pop: A Rocket League player is queueing now...". */
export function tourPopSpoken(push: TourPopPush): string {
  return `${push.title}: ${push.body}`;
}

/**
 * Whether the Queue up page offers "Get Duo Pops?" (the deck's own opt-in card, same words, same
 * path). The deck card's rule (duoPopsWanted), with `onboarded` true because the tour is reached
 * only from the end of setup: in North America (no pop reaches anyone else), the setting known and
 * off (undefined means the column is not there or not loaded, and is never guessed), and not
 * answered on this phone before.
 */
export function tourOffersDuoPops(input: {
  region: Region | null;
  queuePop: boolean | undefined;
  seen: boolean | undefined;
}): boolean {
  return duoPopsWanted({ onboarded: true, inNa: isNaRegion(input.region), queuePop: input.queuePop, seen: input.seen });
}

/**
 * When the offer is decided: once the pager settles on the page before Queue up (or anywhere
 * after it), while the Queue up page is still off screen. Later than the tour's start, so the
 * settings read has had the first pages to land; never while the page is in view, so the card can
 * never arrive under the player's eyes and push the picture up. Decided once (welcome.tsx).
 */
export function tourDecidesDuoPops(settledPage: number, queueIndex: number): boolean {
  return queueIndex >= 0 && settledPage >= queueIndex - 1;
}

/**
 * How far the Queue up page gives way to fit its picture area. 0: the Queue up control, the seam
 * down to the notice, and the notice. 1, compact: the notice alone (the heading below names Queue
 * up). The page starts at 0 and takes the step when it measures taller than its picture area (a
 * short phone with the Duo Pops card, or a larger text size). Past 1 the page scrolls.
 */
export type QueueFit = 0 | 1;

export function tourQueueFit(overflowSteps: number): QueueFit {
  return Math.min(1, Math.max(0, overflowSteps)) as QueueFit;
}

/** The picture area: 458pt on a 393 x 852 phone at the default text size, never under 280. */
export const TOUR_PICTURE_MAX = 458;
export const TOUR_PICTURE_MIN = 280;
/**
 * A tour page's height, less the picture and the safe area, in two parts.
 *
 * Grows with the text size: the text block's lines (the label's 14, a two-line title's 56 and a
 * three-line body's 66, plus 2, so 138) and the Start swiping label's 21.
 *
 * Fixed: 12 above the picture, 20 to the text block, the text block's two 8pt gaps (16), the
 * dots (23), their 8pt gap to the button, the button's 36 of padding, the 16 margin under it, and
 * 11 of slack, kept so the design's 458pt picture on a 393 x 852 phone stays as drawn:
 * 12 + 20 + 16 + 23 + 8 + 36 + 16 + 11 = 142.
 *
 * At the default size 142 + 138 + 21 = 301, and 852 - 59 - 34 - 301 = 458. The insets are the
 * phone's own, so an iPhone SE (20 / 0) gets the 93pt its missing notch and home indicator leave
 * (found by rendering at 375 x 667). A title or body that wraps to more lines than this budget
 * is met by the measured bound in tourPictureHeight, and past the 280 floor every tour page
 * scrolls (welcome.tsx), so no line is ever cut off out of reach.
 */
const TOUR_CHROME_FIXED = 142;
const TOUR_TEXT_LINES = 138;
const TOUR_FOOT_LABEL_LINE = 21;
/** On a page, around the picture and its heading: 12 above the picture, 20 between, and the
 * page's 8 of bottom padding (welcome.tsx TourPageScroll). */
const TOUR_PAGE_CHROME = 40;

/** What the tour measured once its pages were laid out: the pager's height (the window less the
 * foot) and the tallest page heading. Zero until measured. */
export interface TourMeasured {
  pageHeight: number;
  tallestHeading: number;
}

/**
 * `fontScale` is useWindowDimensions().fontScale: a larger text size takes its lines from the
 * picture, down to the 280 floor, so the heading stays on screen.
 *
 * The budget above counts a three-line body, but a larger text size also wraps the body onto more
 * lines. Once the pages are measured, the picture is also never taller than the pager leaves
 * beside the tallest heading, so every heading fits at rest. The tallest one, so the headings
 * still line up from page to page. At the default size the measured bound is looser than the
 * budget (463 against 458 on a 393 x 852 phone), so it changes nothing there.
 */
export function tourPictureHeight(
  windowHeight: number,
  insets: { top: number; bottom: number },
  fontScale = 1,
  measured?: TourMeasured,
): number {
  const scaled = (TOUR_TEXT_LINES + TOUR_FOOT_LABEL_LINE) * fontScale;
  let room = Math.round(windowHeight - insets.top - insets.bottom - TOUR_CHROME_FIXED - scaled);
  if (measured && measured.pageHeight > 0 && measured.tallestHeading > 0) {
    room = Math.min(room, Math.floor(measured.pageHeight - insets.top - TOUR_PAGE_CHROME - measured.tallestHeading));
  }
  return Math.max(TOUR_PICTURE_MIN, Math.min(TOUR_PICTURE_MAX, room));
}

/**
 * The least picture a card page keeps when a larger text size grows the plate under it: room for
 * the tap hint's ring and tag (TapHint.tsx). Past it the card grows and the page scrolls.
 */
export const TOUR_CARD_PICTURE_MIN = 120;
/** Page 2 dims Kai's picture, so it only has to hold the EXAMPLE tag: 10 + 24 + 10. */
export const TOUR_CAN_DUO_PICTURE_MIN = 44;
