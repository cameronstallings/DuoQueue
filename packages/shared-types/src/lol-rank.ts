/**
 * League of Legends Ranked Solo/Duo ranks, and Riot's published duo table.
 *
 * THIS FILE HAS A SQL TWIN, AND THE TWO MUST CHANGE TOGETHER:
 * supabase/migrations/0069_league_rank_duo.sql (lol_rank_ordinal, lol_rank_label,
 * lol_parse_rank_text, lol_solo_duo_eligible). The server is the authority: get_deck computes
 * the "Can duo with you" label, and the sync trigger turns whatever text a client sends into
 * the canonical label. This mirror exists for the rank picker's copy and for the cross-language
 * checksum in lol-rank.test.ts (306 true / 636 false / 82 null over all 32 x 32 choices), which
 * is the drift alarm: if one side changes and the other does not, a suite goes red.
 *
 * Riot's rule this is built around (Developer Policies, General): products may not create
 * alternatives to official skill ranking systems, and MMR or ELO calculators are named as
 * examples. So there is no score here, no rank distance, and no exported "rank to number"
 * helper. The ordinal below is an index into Riot's own rows and nothing else, which is why it
 * is module-private: a public one is exactly what later UI code would reach for to sort or
 * compare players by a DuoQueue-computed number.
 */

export const LEAGUE_RIOT_QUEUE = "RANKED_SOLO_5x5";

/** Riot's ladder, lowest to highest. Mirrors profile_games.lol_tier_valid (minus "unranked"). */
export const LOL_TIERS = [
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "emerald",
  "diamond",
  "master",
  "grandmaster",
  "challenger",
] as const;

/** The tiers that have divisions IV (lowest) to I (highest). */
export const LOL_DIVISIONAL_TIERS = ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond"] as const;

export type LolTier = (typeof LOL_TIERS)[number];
export type LolDivisionalTier = (typeof LOL_DIVISIONAL_TIERS)[number];
/** Mirrors profile_games.lol_tier_valid exactly. */
export type LolTierChoice = LolTier | "unranked";
/** 1 = I (highest) .. 4 = IV (lowest), as Riot numbers them. */
export type LolDivision = 1 | 2 | 3 | 4;

export interface LolRank {
  tier: LolTierChoice;
  division: LolDivision | null;
}

/** Every value the tier column accepts, in the order the picker shows them. */
export const LOL_TIER_CHOICES = ["unranked", ...LOL_TIERS] as const;

/** Division choices in the order the League client lists them: IV, III, II, I. */
export const LOL_DIVISIONS_LOW_TO_HIGH: readonly LolDivision[] = [4, 3, 2, 1];

export const LOL_TIER_LABELS: Record<LolTierChoice, string> = {
  unranked: "Unranked",
  iron: "Iron",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  emerald: "Emerald",
  diamond: "Diamond",
  master: "Master",
  grandmaster: "Grandmaster",
  challenger: "Challenger",
};

export const LOL_DIVISION_LABELS: Record<LolDivision, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

export const LOL_DUO_RULES_SOURCE = {
  url: "https://support.riotgames.com/en-us/league-of-legends/gameplay/ranked-tiers-divisions-and-queues",
  checked: "2026-09-23",
} as const;

export function isLolDivisionalTier(tier: string | null | undefined): tier is LolDivisionalTier {
  return (LOL_DIVISIONAL_TIERS as readonly string[]).includes(tier ?? "");
}

function isLolDivision(value: number | null | undefined): value is LolDivision {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/**
 * Mirrors lol_rank_ordinal. NOT EXPORTED, on purpose (see the header). Iron IV = 0 ...
 * Diamond I = 27, Master = 28, Grandmaster = 29, Challenger = 30; Unranked, null or anything
 * malformed has no ordinal.
 */
function lolRankOrdinal(rank: LolRank | null | undefined): number | null {
  if (!rank) return null;
  const { tier, division } = rank;
  if (isLolDivisionalTier(tier)) {
    if (!isLolDivision(division)) return null;
    return LOL_DIVISIONAL_TIERS.indexOf(tier) * 4 + (4 - division);
  }
  if (division !== null && division !== undefined) return null;
  if (tier === "master") return 28;
  if (tier === "grandmaster") return 29;
  if (tier === "challenger") return 30;
  return null;
}

/** Mirrors lol_rank_label: "Gold II", "Master", "Unranked", or null for an incomplete or
 * malformed rank. This string is what the server stores in rank_text for a structured rank. */
export function formatLolRank(rank: LolRank): string | null {
  if (rank.tier === "unranked" && rank.division === null) return LOL_TIER_LABELS.unranked;
  if (lolRankOrdinal(rank) === null) return null;
  if (rank.division === null) return LOL_TIER_LABELS[rank.tier];
  return `${LOL_TIER_LABELS[rank.tier]} ${LOL_DIVISION_LABELS[rank.division]}`;
}

/**
 * Mirrors lol_parse_rank_text: the same normalisation and the same regex. The pattern is
 * anchored at both ends, so every accepted string has exactly one parse, which is why
 * JavaScript's backtracking and Postgres's leftmost-longest matching agree on the groups.
 */
const LOL_RANK_TEXT_PATTERN =
  /^(iron|bronze|silver|gold|plat|platinum|emerald|diamond|master|masters|grandmaster|grand master|gm|challenger|unranked) ?(iv|iii|ii|i|4|3|2|1)?$/;

const TIER_ALIASES: Record<string, LolTierChoice> = {
  plat: "platinum",
  masters: "master",
  "grand master": "grandmaster",
  gm: "grandmaster",
};

const DIVISION_TOKENS: Record<string, LolDivision> = {
  i: 1,
  "1": 1,
  ii: 2,
  "2": 2,
  iii: 3,
  "3": 3,
  iv: 4,
  "4": 4,
};

/**
 * Accepts only: a divisional tier WITH a division; Master/Grandmaster/Challenger with no
 * division or with I/1 (Riot's API reports apex ranks as "I"), returned with division null;
 * "unranked" with no division. Anything else is null: "Diamond" (no division), "Gold V",
 * "Immortal 1", "Master 400 LP", "", null. A partial parse is no parse.
 */
export function parseLolRankText(text: string | null | undefined): LolRank | null {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const match = LOL_RANK_TEXT_PATTERN.exec(normalized);
  if (!match) return null;

  const tierToken = match[1] ?? "";
  const tier = (TIER_ALIASES[tierToken] ?? tierToken) as LolTierChoice;
  const division = match[2] ? (DIVISION_TOKENS[match[2]] ?? null) : null;

  if (isLolDivisionalTier(tier)) {
    return division === null ? null : { tier, division };
  }
  if (tier === "master" || tier === "grandmaster" || tier === "challenger") {
    return division === null || division === 1 ? { tier, division: null } : null;
  }
  if (tier === "unranked") {
    return division === null ? { tier, division: null } : null;
  }
  return null;
}

/** True only for one of the 32 labels the server writes (parse, then format, gives the same
 * string back). Free text is never shown to strangers; this is the gate for that. */
export function isCanonicalLolRankLabel(text: string | null | undefined): boolean {
  if (!text) return false;
  const parsed = parseLolRankText(text);
  return parsed !== null && formatLolRank(parsed) === text;
}

/**
 * Riot's row for a player, as an inclusive ordinal range over Iron IV (0) .. Diamond I (27).
 * Mirrors the lo/hi CASE expressions in lol_solo_duo_eligible. Master and above are decided
 * before this is read.
 */
function riotRow(ordinal: number): { lo: number; hi: number } {
  if (ordinal <= 7) return { lo: 0, hi: 11 }; // Iron, Bronze: Iron to Silver
  if (ordinal <= 11) return { lo: 0, hi: 15 }; // Silver: Iron to Gold
  if (ordinal <= 15) return { lo: 8, hi: 19 }; // Gold: Silver to Platinum
  if (ordinal <= 19) return { lo: 12, hi: 23 }; // Platinum: Gold to Emerald
  if (ordinal <= 23) return { lo: 16, hi: 25 }; // Emerald: Platinum to Diamond III
  if (ordinal <= 26) return { lo: 22, hi: 26 }; // Diamond IV..II: Emerald II to Diamond II
  return { lo: 25, hi: 27 }; // Diamond I: Diamond III to Diamond I (Master part decided earlier)
}

/**
 * Mirrors lol_solo_duo_eligible: true, false, or null (unknown, never claimed).
 *
 * 1. Either rank missing, Unranked or malformed: null.
 * 2. Either Grandmaster or Challenger: false.
 * 3. Either Master: null when the other is Master or Diamond I (depends on LP, which DuoQueue
 *    does not collect), otherwise false.
 * 4. Otherwise both players' Riot rows must allow the pair for true; exactly one allowing it
 *    is null (Riot's table disagrees with itself there); neither is false.
 *
 * The client uses this only in tests. Labels come from the server.
 */
export function lolSoloDuoEligible(a: LolRank | null, b: LolRank | null): boolean | null {
  const oa = lolRankOrdinal(a);
  const ob = lolRankOrdinal(b);
  if (oa === null || ob === null) return null;
  if (oa >= 29 || ob >= 29) return false;
  if (oa === 28 || ob === 28) return Math.min(oa, ob) >= 27 ? null : false;

  const ra = riotRow(oa);
  const rb = riotRow(ob);
  const aAllows = ob >= ra.lo && ob <= ra.hi;
  const bAllows = oa >= rb.lo && oa <= rb.hi;
  if (aAllows && bAllows) return true;
  if (aAllows || bAllows) return null;
  return false;
}

/**
 * The picker's helper line: Riot's row for this rank, restated as plain text. Null for an
 * incomplete rank (a divisional tier with no division yet), so the picker shows nothing until
 * the rank is complete.
 */
export function lolDuoRuleSummary(rank: LolRank): string | null {
  switch (rank.tier) {
    case "unranked":
      return "Not placed yet? Pick your rank after placements to see who you can duo with.";
    case "iron":
    case "bronze":
      return rank.division === null ? null : "In Solo/Duo you can duo with Iron to Silver.";
    case "silver":
      return rank.division === null ? null : "In Solo/Duo you can duo with Iron to Gold.";
    case "gold":
      return rank.division === null ? null : "In Solo/Duo you can duo with Silver to Platinum.";
    case "platinum":
      return rank.division === null ? null : "In Solo/Duo you can duo with Gold to Emerald.";
    case "emerald":
      return rank.division === null ? null : "In Solo/Duo you can duo with Platinum to Diamond III.";
    case "diamond":
      if (rank.division === null) return null;
      return rank.division === 1
        ? "In Solo/Duo you can duo with Diamond III to Master (under 200 LP)."
        : "In Solo/Duo you can duo with Emerald II to Diamond II.";
    case "master":
      return "Under 200 LP you can duo with Diamond I, and you can duo with Master players within 400 LP of you. DuoQueue doesn't track LP, so Master duos aren't labeled.";
    case "grandmaster":
    case "challenger":
      return "Duo isn't available at Grandmaster or Challenger.";
  }
}

/**
 * Riot's row for a player, as the short range a Duo Call post prints after the rank: "Gold II.
 * Can duo Silver to Platinum (by rank)." The same rows as `lolDuoRuleSummary` (and its SQL twin,
 * the lo/hi CASE in lol_solo_duo_eligible, 0069_league_rank_duo.sql), cut down to the range alone;
 * lol-rank.test.ts checks every divisional rank's label against the picker's sentence, so the two
 * cannot drift apart.
 *
 * Null wherever there is no row to restate: no rank, Unranked, a divisional tier with no division
 * yet, and Master and above (whose duo rules turn on LP, which DuoQueue does not collect).
 *
 * Diamond I is the one place this says less than the picker: "Diamond III to Diamond I", not "to
 * Master (under 200 LP)". A post goes to strangers, and a Master player over 200 LP who answers
 * it could not actually queue with them, so the post claims only the part that is always true.
 */
export function lolDuoRangeLabel(rank: LolRank | null): string | null {
  if (!rank || !isLolDivisionalTier(rank.tier) || !isLolDivision(rank.division)) return null;
  switch (rank.tier) {
    case "iron":
    case "bronze":
      return "Iron to Silver";
    case "silver":
      return "Iron to Gold";
    case "gold":
      return "Silver to Platinum";
    case "platinum":
      return "Gold to Emerald";
    case "emerald":
      return "Platinum to Diamond III";
    case "diamond":
      return rank.division === 1 ? "Diamond III to Diamond I" : "Emerald II to Diamond II";
  }
}
