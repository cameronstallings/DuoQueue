import { describe, expect, it } from "vitest";

import {
  legacyLolRankText,
  LOL_DIVISION_REQUIRED_MESSAGE,
  removeLegacyRankText,
  selectLolDivision,
  selectLolTier,
  toProfileGameRow,
  validateLolRank,
  withTypedRankText,
  type LeagueRankValue,
  type RankedGame,
} from "./rankPickerState";

/**
 * The picker's rules and the row both writers send. The case that matters most is the last one
 * in "toProfileGameRow": a rank loaded as (gold, 2, "Gold II") whose tier is then cleared must be
 * sent with rank_text null, because the server's trigger would parse a re-sent "Gold II" straight
 * back into Gold II and the rank could never be cleared.
 */

const LEAGUE = "league-id";
const OTHER = "valorant-id";
const WRITE = { profileId: "me", priority: 0 };

const empty: LeagueRankValue = { lolTier: null, lolDivision: null, rankText: "" };

function league(value: Partial<LeagueRankValue> = {}): RankedGame {
  return { gameId: LEAGUE, skillLevel: "competitive", ...empty, ...value };
}

describe("selectLolTier", () => {
  it("clears the division when the tier changes", () => {
    const next = selectLolTier({ lolTier: "gold", lolDivision: 2, rankText: "Gold II" }, "silver");
    expect(next.lolTier).toBe("silver");
    expect(next.lolDivision).toBeNull();
  });

  it("forces the division to null for Unranked and the apex tiers, and completes the rank", () => {
    for (const tier of ["unranked", "master", "grandmaster", "challenger"] as const) {
      const next = selectLolTier({ lolTier: "gold", lolDivision: 2, rankText: "Gold II" }, tier);
      expect(next.lolTier).toBe(tier);
      expect(next.lolDivision).toBeNull();
      expect(validateLolRank(next)).toBeNull();
    }
    expect(selectLolTier(empty, "master").rankText).toBe("Master");
    expect(selectLolTier(empty, "unranked").rankText).toBe("Unranked");
  });

  it("clears the rank when the selected tier is tapped again", () => {
    const next = selectLolTier({ lolTier: "gold", lolDivision: 2, rankText: "Gold II" }, "gold");
    expect(next.lolTier).toBeNull();
    expect(next.lolDivision).toBeNull();
  });
});

describe("selectLolDivision", () => {
  it("completes a divisional tier and writes its label", () => {
    const next = selectLolDivision(selectLolTier(empty, "gold"), 2);
    expect(next).toEqual({ lolTier: "gold", lolDivision: 2, rankText: "Gold II" });
  });

  it("does nothing without a divisional tier", () => {
    const master = selectLolTier(empty, "master");
    expect(selectLolDivision(master, 2)).toEqual(master);
    expect(selectLolDivision(empty, 2)).toEqual(empty);
  });

  it("clears the division when the selected one is tapped again", () => {
    const next = selectLolDivision({ lolTier: "gold", lolDivision: 2, rankText: "Gold II" }, 2);
    expect(next.lolDivision).toBeNull();
  });
});

describe("validateLolRank", () => {
  it("blocks a divisional tier with no division", () => {
    expect(validateLolRank({ lolTier: "diamond", lolDivision: null, rankText: "" })).toBe(LOL_DIVISION_REQUIRED_MESSAGE);
  });

  it("allows no rank at all, and complete ranks", () => {
    expect(validateLolRank(empty)).toBeNull();
    expect(validateLolRank({ lolTier: "diamond", lolDivision: 1, rankText: "Diamond I" })).toBeNull();
    expect(validateLolRank({ lolTier: "challenger", lolDivision: null, rankText: "Challenger" })).toBeNull();
  });
});

describe("the legacy note", () => {
  it("shows unparseable text when no tier is picked", () => {
    expect(legacyLolRankText({ ...empty, rankText: "hardstuck" })).toBe("hardstuck");
  });

  it("does not show a parseable text, or any text once a tier is picked", () => {
    expect(legacyLolRankText({ ...empty, rankText: "Gold II" })).toBeNull();
    expect(legacyLolRankText({ lolTier: "gold", lolDivision: 2, rankText: "hardstuck" })).toBeNull();
    expect(legacyLolRankText(empty)).toBeNull();
  });

  it("Remove clears the text", () => {
    expect(removeLegacyRankText({ ...empty, rankText: "hardstuck" }).rankText).toBe("");
  });
});

describe("toProfileGameRow", () => {
  it("never sets lol_* on a non-League row, even when the game holds a parsed rank", () => {
    const valorant: RankedGame = { gameId: OTHER, skillLevel: "casual", lolTier: "gold", lolDivision: 2, rankText: "Gold 2" };
    const row = toProfileGameRow(valorant, LEAGUE, WRITE);
    expect(row.lol_tier).toBeNull();
    expect(row.lol_division).toBeNull();
  });

  it("passes a non-League row's typed text through unchanged", () => {
    const row = toProfileGameRow(
      { gameId: OTHER, skillLevel: "casual", ...empty, rankText: "Immortal 1" },
      LEAGUE,
      WRITE,
    );
    expect(row).toEqual({
      profile_id: "me",
      game_id: OTHER,
      skill_level: "casual",
      rank_text: "Immortal 1",
      lol_tier: null,
      lol_division: null,
      priority: 0,
    });
    expect(toProfileGameRow({ gameId: OTHER, skillLevel: "casual", ...empty }, LEAGUE, WRITE).rank_text).toBeNull();
  });

  it("sends rank_text equal to the canonical label when a tier is set", () => {
    expect(toProfileGameRow(league({ lolTier: "gold", lolDivision: 2, rankText: "" }), LEAGUE, WRITE)).toMatchObject({
      rank_text: "Gold II",
      lol_tier: "gold",
      lol_division: 2,
    });
    expect(toProfileGameRow(league({ lolTier: "master", rankText: "hardstuck" }), LEAGUE, WRITE)).toMatchObject({
      rank_text: "Master",
      lol_tier: "master",
      lol_division: null,
    });
  });

  it("keeps unparseable legacy text when no tier is picked", () => {
    expect(toProfileGameRow(league({ rankText: "hardstuck" }), LEAGUE, WRITE)).toMatchObject({
      rank_text: "hardstuck",
      lol_tier: null,
      lol_division: null,
    });
  });

  it("sends null after Remove", () => {
    const removed = removeLegacyRankText(league({ rankText: "hardstuck" }));
    expect(toProfileGameRow({ ...league(), ...removed }, LEAGUE, WRITE).rank_text).toBeNull();
  });

  it("sends rank_text null, not the old label, when a loaded (gold, 2, \"Gold II\") rank is cleared", () => {
    const loaded = league({ lolTier: "gold", lolDivision: 2, rankText: "Gold II" });
    const cleared = { ...loaded, ...selectLolTier(loaded, "gold") };
    const row = toProfileGameRow(cleared, LEAGUE, WRITE);
    expect(row.rank_text).toBeNull();
    expect(row.lol_tier).toBeNull();
    expect(row.lol_division).toBeNull();
  });

  it("treats League as an ordinary game when the League id is unknown", () => {
    const row = toProfileGameRow(league({ lolTier: "gold", lolDivision: 2, rankText: "Gold II" }), null, WRITE);
    expect(row).toMatchObject({ rank_text: "Gold II", lol_tier: null, lol_division: null });
  });
});

describe("withTypedRankText", () => {
  it("derives the structured rank from the text the way the server would", () => {
    expect(withTypedRankText(league(), "plat 2")).toMatchObject({ rankText: "plat 2", lolTier: "platinum", lolDivision: 2 });
    expect(withTypedRankText(league({ lolTier: "gold", lolDivision: 2 }), "hardstuck")).toMatchObject({
      rankText: "hardstuck",
      lolTier: null,
      lolDivision: null,
    });
  });

  it("keeps a League rank typed into the fallback text field when the League id turns up by save time", () => {
    const typed = withTypedRankText(league(), "Gold 2");
    expect(toProfileGameRow(typed, LEAGUE, WRITE)).toMatchObject({ rank_text: "Gold II", lol_tier: "gold", lol_division: 2 });
    expect(toProfileGameRow(typed, null, WRITE)).toMatchObject({ rank_text: "Gold 2", lol_tier: null });
  });
});
