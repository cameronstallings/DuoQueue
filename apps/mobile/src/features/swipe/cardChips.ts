import type { SkillLevel } from "@duoqueue/shared-types";

import type { DeckCard } from "./types";

/**
 * Which chips a deck card shows, and what the profile detail's Games section lists. Pure, so the
 * rule is unit-tested (cardChips.test.ts) rather than living in JSX.
 *
 * "Can duo with you" means exactly one thing: get_deck checked this pair against Riot's published
 * Solo/Duo table and said true (0069_league_rank_duo.sql). It never shows for false or null, never
 * for rows from Standouts, Online now, the party deck or the profile route (they carry no
 * lol_duo_eligible), and never without the League rank it is about. There is no negative label.
 */

export const LEAGUE_GAME_NAME = "League of Legends";
export const DUO_LABEL = "Can duo with you";
export const DUO_ACCESSIBILITY_LABEL = "Can duo with you in Ranked Solo/Duo";
export const DUO_DETAIL_CAPTION =
  "Can duo with you in Ranked Solo/Duo, based on the ranks you both listed and League's published duo rules. The League client has the final say.";

type CardFacts = Pick<DeckCard, "topGames" | "lolRank" | "lol_duo_eligible">;

export interface CardChip {
  key: string;
  label: string;
  detail?: string;
  tone?: "success";
  /** The 13px Ionicon the chip carries, if any. */
  icon?: "people";
  accessibilityLabel?: string;
}

/** True only when the server said this pair can duo AND the rank it is about can be shown. */
export function showsDuoLabel(card: CardFacts): boolean {
  return card.lol_duo_eligible === true && !!card.lolRank;
}

function leagueName(card: CardFacts): string {
  return card.topGames.find((g) => g.isLeague)?.name ?? LEAGUE_GAME_NAME;
}

/**
 * The deck card's chip row.
 *   - Eligible (and the rank is showable): the League chip with the rank, then the label. League
 *     is promoted even when it is not the top game, so the label sits next to the rank it is about.
 *   - Otherwise: today's single chip for the top game. If that game is League and the rank is
 *     showable, the rank is its detail instead of the skill level.
 */
export function deckCardChips(card: CardFacts, skillLabels: Record<SkillLevel, string>): CardChip[] {
  if (showsDuoLabel(card) && card.lolRank) {
    return [
      { key: "league", label: leagueName(card), detail: card.lolRank },
      { key: "duo", label: DUO_LABEL, tone: "success", icon: "people", accessibilityLabel: DUO_ACCESSIBILITY_LABEL },
    ];
  }

  const top = card.topGames[0];
  if (!top) return [];
  const detail = top.isLeague && card.lolRank ? card.lolRank : skillLabels[top.skillLevel];
  return [{ key: top.name, label: top.name, detail }];
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
