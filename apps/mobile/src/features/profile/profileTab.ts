import { lolDuoRuleSummary, type LolDivision, type LolTierChoice } from "@duoqueue/shared-types";

/** Your card on the Profile tab: the deck card's 345x483 at iPhone 15 width. */
export const OWN_CARD_HEIGHT = 483;

export const OWN_CARD_CAPTION = "Players who can queue with you also see Can duo and games in common.";

export const PAUSED_CARD_LINE = "Your profile is paused, so nobody sees your card.";

/**
 * The line under your card for a ranked League player: Riot's duo range for your rank, the same
 * sentence the rank picker shows. Unranked is skipped (its line asks you to pick a rank), and so
 * is a divisional tier without its division (lolDuoRuleSummary returns null).
 */
export function leagueRuleLine(games: { lolTier: LolTierChoice | null; lolDivision: LolDivision | null }[]): string | null {
  for (const game of games) {
    if (game.lolTier !== null && game.lolTier !== "unranked") {
      return lolDuoRuleSummary({ tier: game.lolTier, division: game.lolDivision });
    }
  }
  return null;
}
