import {
  formatLolRank,
  isLolDivisionalTier,
  parseLolRankText,
  type LolDivision,
  type LolTierChoice,
  type SkillLevel,
} from "@duoqueue/shared-types";

/**
 * The League rank picker's state, and the one function that turns a game into the row both
 * writers send. Pure on purpose (no React, no Supabase), so the rules the server depends on are
 * unit-tested here rather than living in two screens' JSX.
 *
 * `rankText` is the row's text as the client holds it. For the League game it is either the
 * canonical label of the picked rank (the picker writes it on every complete pick), the text the
 * row was loaded with, or "". The server rewrites it anyway whenever a tier is set; the client
 * keeping the label means optimistic UI and the server never disagree.
 */
export interface LeagueRankValue {
  lolTier: LolTierChoice | null;
  lolDivision: LolDivision | null;
  rankText: string;
}

export interface RankedGame extends LeagueRankValue {
  gameId: string;
  skillLevel: SkillLevel;
}

/** A type alias rather than an interface so it is assignable to the writers' `Record<string, unknown>[]`. */
export type ProfileGameWrite = {
  profile_id: string;
  game_id: string;
  skill_level: SkillLevel;
  rank_text: string | null;
  lol_tier: LolTierChoice | null;
  lol_division: LolDivision | null;
  priority: number;
};

export const LOL_DIVISION_REQUIRED_MESSAGE = "Pick a division for your League rank, or tap the tier again to clear it.";

function isComplete(value: LeagueRankValue): boolean {
  return value.lolTier !== null && formatLolRank({ tier: value.lolTier, division: value.lolDivision }) !== null;
}

/**
 * Tapping the selected tier clears the rank. Choosing a different tier clears the division.
 * Unranked, Master, Grandmaster and Challenger have no division, so choosing one completes the
 * rank on the spot.
 */
export function selectLolTier(value: LeagueRankValue, tier: LolTierChoice): LeagueRankValue {
  if (value.lolTier === tier) {
    return { ...value, lolTier: null, lolDivision: null };
  }
  const next: LeagueRankValue = { ...value, lolTier: tier, lolDivision: null };
  return isLolDivisionalTier(tier) ? next : { ...next, rankText: formatLolRank({ tier, division: null }) ?? value.rankText };
}

/** Only meaningful for Iron..Diamond. Tapping the selected division clears it. */
export function selectLolDivision(value: LeagueRankValue, division: LolDivision): LeagueRankValue {
  if (!isLolDivisionalTier(value.lolTier)) return value;
  if (value.lolDivision === division) return { ...value, lolDivision: null };
  const label = formatLolRank({ tier: value.lolTier, division });
  return { ...value, lolDivision: division, rankText: label ?? value.rankText };
}

/**
 * The text a row was loaded with that no rank can be read out of ("hardstuck"), shown in the
 * legacy note until the user picks a rank or taps Remove. Null when there is none, when a tier is
 * picked, or when the text parses (a parseable text is a rank, not a note).
 */
export function legacyLolRankText(value: LeagueRankValue): string | null {
  if (value.lolTier !== null) return null;
  const text = value.rankText.trim();
  if (text === "") return null;
  return parseLolRankText(text) === null ? value.rankText : null;
}

/** The legacy note's Remove button: the League card has no text field any more, so this is the
 * only way to delete old free text. */
export function removeLegacyRankText(value: LeagueRankValue): LeagueRankValue {
  return { ...value, rankText: "" };
}

/** Continue (onboarding) and Save (Edit details) run this for the League game. The rank itself
 * stays optional; only a half-picked one blocks. */
export function validateLolRank(value: LeagueRankValue): string | null {
  if (isLolDivisionalTier(value.lolTier) && value.lolDivision === null) return LOL_DIVISION_REQUIRED_MESSAGE;
  return null;
}

/**
 * A free-text rank field changed (every game but League, and League itself when the League id
 * could not be read). The structured fields follow the text, exactly as the server's trigger
 * would derive them, so the row reads the same whichever rule `toProfileGameRow` ends up
 * applying: if the League id resolves between this screen rendering a text field and the save,
 * a typed "Gold 2" is still sent as Gold II instead of being mistaken for a stale label and
 * dropped. On a non-League game these fields are never sent.
 */
export function withTypedRankText<T extends LeagueRankValue>(game: T, text: string): T {
  const parsed = parseLolRankText(text);
  return { ...game, rankText: text, lolTier: parsed?.tier ?? null, lolDivision: parsed?.division ?? null };
}

/**
 * The profile_games row both writers send (onboarding submit, Edit details save). The only place
 * lol_tier / lol_division are ever set, and it never sets them on a non-League row, which is the
 * only way to hit the server's `lol_rank_not_league`.
 *
 * rank_text for the League row, exactly (design section 6.3):
 *   - tier set: the canonical label.
 *   - no tier: the text only if it does NOT parse (genuine legacy text the note is showing),
 *     otherwise null.
 * The "otherwise null" is load-bearing. A structured row loads with rank_text "Gold II"; if
 * clearing the tier re-sent that text, the trigger would parse it straight back into Gold II and
 * the user could never clear their rank.
 *
 * Every other game passes its typed text through unchanged, as before 0069.
 */
export function toProfileGameRow(
  game: RankedGame,
  leagueGameId: string | null,
  { profileId, priority }: { profileId: string; priority: number },
): ProfileGameWrite {
  const base = { profile_id: profileId, game_id: game.gameId, skill_level: game.skillLevel, priority };

  if (leagueGameId === null || game.gameId !== leagueGameId) {
    return { ...base, rank_text: game.rankText || null, lol_tier: null, lol_division: null };
  }

  if (game.lolTier !== null && isComplete(game)) {
    return {
      ...base,
      rank_text: formatLolRank({ tier: game.lolTier, division: game.lolDivision }),
      lol_tier: game.lolTier,
      lol_division: isLolDivisionalTier(game.lolTier) ? game.lolDivision : null,
    };
  }

  const text = game.rankText.trim() === "" ? null : game.rankText;
  return {
    ...base,
    rank_text: text !== null && parseLolRankText(text) === null ? text : null,
    lol_tier: null,
    lol_division: null,
  };
}
