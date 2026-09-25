import {
  PLAYSTYLE_TAGS,
  PROMPT_COUNT,
  type Platform,
  type PlaystyleTag,
  type Region,
  type SkillLevel,
} from "@duoqueue/shared-types";

import type { DeckCard, DeckCardPrompt } from "./types";

/**
 * What a card shows (its picture, pages and fact cells) and what the profile detail's Games
 * section lists. Pure, so the rules are unit-tested (cardChips.test.ts) rather than living in JSX.
 *
 * "Can duo with you" means exactly one thing: get_deck checked this pair against Riot's published
 * Solo/Duo table and said true (0069_league_rank_duo.sql). It never shows for false or null, never
 * for rows from Standouts, Online now, the party deck or the profile route (they carry no
 * lol_duo_eligible), and never without the League rank it is about. There is no negative label.
 */

export const LEAGUE_GAME_NAME = "League of Legends";
export const DUO_ACCESSIBILITY_LABEL = "Can duo with you in Ranked Solo/Duo";
export const DUO_DETAIL_CAPTION =
  "Can duo with you in Ranked Solo/Duo, based on the ranks you both listed and League's published duo rules. The League client has the final say.";

type CardFacts = Pick<DeckCard, "topGames" | "lolRank" | "lol_duo_eligible">;

/** True only when the server said this pair can duo AND the rank it is about can be shown. */
export function showsDuoLabel(card: CardFacts): boolean {
  return card.lol_duo_eligible === true && !!card.lolRank;
}

/**
 * The profile detail's Games section: League's detail is the rank when it is showable (a
 * verified stat still overrides it, as GamesSection does for every game); other games keep their
 * skill level and never show a rank. When the pair is eligible and League is not among the top
 * games, the League chip is prepended so the caption under the section has its rank on screen.
 */
export function detailGames(
  card: CardFacts,
  skillLabels: Record<SkillLevel, string>,
): { name: string; skillLevel?: string; rank?: string }[] {
  const games = card.topGames.map((g) => ({
    name: g.name,
    skillLevel: skillLabels[g.skillLevel],
    rank: g.isLeague && card.lolRank ? card.lolRank : undefined,
  }));
  if (showsDuoLabel(card) && card.lolRank && !card.topGames.some((g) => g.isLeague)) {
    return [{ name: LEAGUE_GAME_NAME, rank: card.lolRank }, ...games];
  }
  return games;
}

/**
 * The one picture a card, pager or avatar shows: the square `profile` picture, else an old
 * `header` cover (build 11 and earlier uploaded one; build 12 stops asking). Never a gallery
 * photo: build 12 shows none anywhere.
 */
export function cardPicture(card: Pick<DeckCard, "profilePhotoUrl" | "headerPhotoUrl">): string | null {
  return card.profilePhotoUrl ?? card.headerPhotoUrl ?? null;
}

// ---------------------------------------------------------------------------------------------
// Build 12: the card's three fact cells, its pages, and its details line.
// ---------------------------------------------------------------------------------------------

export interface CellLabels {
  skill: Record<SkillLevel, string>;
  platform: Record<Platform, string>;
  playstyle: Record<PlaystyleTag, string>;
}

/**
 * Where the card is shown decides what the pair cells may say:
 *   - deck: get_deck's rows. Can light, and shared_games_count is relative to you.
 *   - party: get_party_deck counts shared games against every party member, so it is not
 *     "games in common with you". No light, no IN COMMON.
 *   - own: your card on the Profile tab. Never lights ("Can duo" is a fact about a pair); the
 *     third cell is your game total.
 */
export type CardCellsMode = { kind: "deck"; sharedGames: number } | { kind: "party" } | { kind: "own"; totalGames: number };

export interface CardCell {
  key: "game" | "duo" | "platforms" | "style" | "common" | "games";
  /** Rendered uppercase (type.tick). */
  label: string;
  value: string;
  /** The Solo/Duo cell when the server said this pair can duo. The only chartreuse on a card. */
  lit: boolean;
  accessibilityLabel: string;
}

export const CELL_COPY = {
  leagueRank: "League rank",
  soloDuo: "Solo/Duo",
  canDuo: "Can duo",
  playsOn: "Plays on",
  style: "Style",
  inCommon: "In common",
  noneYet: "None yet",
  games: "Games",
} as const;

type CellFacts = Pick<DeckCard, "topGames" | "lolRank" | "lol_duo_eligible" | "platforms" | "playstyles">;

function gameCell(card: CellFacts, labels: CellLabels): CardCell | null {
  if (card.lolRank) {
    return {
      key: "game",
      label: CELL_COPY.leagueRank,
      value: card.lolRank,
      lit: false,
      accessibilityLabel: `League rank: ${card.lolRank}`,
    };
  }
  const top = card.topGames[0];
  if (!top) return null;
  const value = labels.skill[top.skillLevel];
  return { key: "game", label: top.name, value, lit: false, accessibilityLabel: `${top.name}: ${value}` };
}

/** Known playstyle tags in catalog order; unknown tags are dropped. */
function orderedPlaystyles(tags: string[]): PlaystyleTag[] {
  return PLAYSTYLE_TAGS.filter((tag) => tags.includes(tag));
}

function pairOrSetupCell(card: CellFacts, mode: CardCellsMode, labels: CellLabels): CardCell | null {
  if (mode.kind === "deck" && showsDuoLabel(card)) {
    return {
      key: "duo",
      label: CELL_COPY.soloDuo,
      value: CELL_COPY.canDuo,
      lit: true,
      accessibilityLabel: DUO_ACCESSIBILITY_LABEL,
    };
  }
  if (card.platforms.length > 0) {
    const names = card.platforms.map((p) => labels.platform[p]);
    return {
      key: "platforms",
      label: CELL_COPY.playsOn,
      value: names.slice(0, 2).join(" · "),
      lit: false,
      accessibilityLabel: `Plays on: ${names.join(", ")}`,
    };
  }
  const style = orderedPlaystyles(card.playstyles)[0];
  if (style) {
    const value = labels.playstyle[style];
    return { key: "style", label: CELL_COPY.style, value, lit: false, accessibilityLabel: `Style: ${value}` };
  }
  // Never a negative label: with nothing to say, the cell is left out.
  return null;
}

function thirdCell(mode: CardCellsMode): CardCell | null {
  if (mode.kind === "deck") {
    const n = Math.max(0, Math.trunc(mode.sharedGames));
    const value = n === 0 ? CELL_COPY.noneYet : n === 1 ? "1 game" : `${n} games`;
    return {
      key: "common",
      label: CELL_COPY.inCommon,
      value,
      lit: false,
      accessibilityLabel: n === 0 ? "No games in common yet" : `${value} in common`,
    };
  }
  if (mode.kind === "own") {
    return {
      key: "games",
      label: CELL_COPY.games,
      value: String(mode.totalGames),
      lit: false,
      accessibilityLabel: `${mode.totalGames} ${mode.totalGames === 1 ? "game" : "games"}`,
    };
  }
  return null;
}

/**
 * The card's fact cells, left to right:
 *   1. League rank when it can be shown ("League rank / Gold II"), else the top game and its
 *      skill ("Rocket League / Ranked Grinder").
 *   2. The lit Solo/Duo cell when showsDuoLabel() and the mode allows it; else "Plays on"; else
 *      "Style". Never a negative.
 *   3. "In common" on the deck; "Games / n" on your own card; nothing on the party deck.
 */
export function cardCells(card: CellFacts, mode: CardCellsMode, labels: CellLabels): CardCell[] {
  return [gameCell(card, labels), pairOrSetupCell(card, mode, labels), thirdCell(mode)].filter(
    (cell): cell is CardCell => cell !== null,
  );
}

export type CardPage =
  /** `url` is a number for a picture bundled with the app (require()); the tour's example card
   * is the only one. Everything from the server is a URL string. */
  | { kind: "picture"; url: string | number }
  | { kind: "prompt"; question: string; answer: string }
  | { kind: "blank" };

/**
 * The card's pages: [picture?, prompt 1, prompt 2, prompt 3]. With no picture the card opens on
 * the first prompt; with neither, one blank page that carries the player's initial. Never empty.
 */
export function cardPages(picture: string | null, prompts: DeckCardPrompt[]): CardPage[] {
  const pages: CardPage[] = [];
  if (picture) pages.push({ kind: "picture", url: picture });
  for (const prompt of prompts.slice(0, PROMPT_COUNT)) {
    if (prompt.answer.trim()) pages.push({ kind: "prompt", question: prompt.question, answer: prompt.answer });
  }
  return pages.length > 0 ? pages : [{ kind: "blank" }];
}

/**
 * Where a card's pages are, for VoiceOver: "Page 2 of 4". A card that sits on a pager of its own
 * (`onPager`, the tour) says "Card page 2 of 4", so its pages are never taken for the pager's.
 */
export function cardPagePosition(index: number, count: number, onPager = false): string {
  return `${onPager ? "Card page" : "Page"} ${index + 1} of ${count}`;
}

/**
 * What VoiceOver hears after a page turn: "Page 2 of 4. My comfort game is Stardew Valley."
 * The questions are sentence stems, so question and answer join with a space.
 */
export function cardPageSpoken(page: CardPage, name: string, index: number, count: number, onPager = false): string {
  const content =
    page.kind === "picture"
      ? `${name}'s picture`
      : page.kind === "prompt"
        ? [page.question.trim(), page.answer.trim()].filter(Boolean).join(" ")
        : name;
  return `${cardPagePosition(index, count, onPager)}. ${content}`;
}

/**
 * The tap zones' VoiceOver names. The Deck's card is the only paged thing on its screen, so it
 * keeps "Next page". The tour's cards sit on the tour's own pager ("Tour page, 1 of 4"), so they
 * name the card they turn: "Kai's card, next page".
 */
export function cardZoneLabels(cardName?: string | null): { previous: string; next: string } {
  if (!cardName) return { previous: "Previous page", next: "Next page" };
  return { previous: `${cardName}, previous page`, next: `${cardName}, next page` };
}

/** "27 · NA West · en fr". The card renders it uppercase (type.cardMeta). The tour passes
 * `withAge: false`: no ages on tour pages (build 17). */
export function cardDetailsLine(
  card: Pick<DeckCard, "age" | "region" | "languages">,
  regionLabels: Record<Region, string>,
  options: { withAge?: boolean } = {},
): string {
  const parts = options.withAge === false ? [] : [String(card.age)];
  parts.push(regionLabels[card.region] ?? card.region);
  if (card.languages.length > 0) parts.push(card.languages.join(" "));
  return parts.join(" · ");
}
