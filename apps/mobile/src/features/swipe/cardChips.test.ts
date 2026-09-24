import type { SkillLevel } from "@duoqueue/shared-types";
import { describe, expect, it } from "vitest";

import { DUO_ACCESSIBILITY_LABEL, DUO_DETAIL_CAPTION, DUO_LABEL, cardPicture, deckCardChips, detailGames, showsDuoLabel } from "./cardChips";
import type { DeckCardGame } from "./types";

/**
 * The card's chip row and the profile detail's games list. The label is only ever the server's
 * `true`, and only next to a rank that can be shown; free-text League ranks are never shown.
 */

const SKILL: Record<SkillLevel, string> = {
  casual: "Casual",
  intermediate: "Intermediate",
  competitive: "Competitive",
  ranked_grinder: "Ranked Grinder",
};

const valorant: DeckCardGame = { name: "Valorant", skillLevel: "competitive", isLeague: false };
const league: DeckCardGame = { name: "League of Legends", skillLevel: "ranked_grinder", isLeague: true };

function card(over: { topGames?: DeckCardGame[]; lolRank?: string | null; lol_duo_eligible?: boolean | null }) {
  return { topGames: [valorant, league], lolRank: "Gold II", lol_duo_eligible: undefined, ...over };
}

describe("deckCardChips", () => {
  it("shows the League chip and the label when the pair is eligible, promoting League past the top game", () => {
    const chips = deckCardChips(card({ lol_duo_eligible: true }), SKILL);
    expect(chips).toEqual([
      { key: "league", label: "League of Legends", detail: "Gold II" },
      { key: "duo", label: DUO_LABEL, tone: "success", icon: "people", accessibilityLabel: DUO_ACCESSIBILITY_LABEL },
    ]);
  });

  it("shows the label even when League is not in the top three games", () => {
    const chips = deckCardChips(card({ topGames: [valorant], lol_duo_eligible: true }), SKILL);
    expect(chips.map((c) => c.label)).toEqual(["League of Legends", DUO_LABEL]);
  });

  it("shows no label when eligible but the rank cannot be shown", () => {
    const chips = deckCardChips(card({ lol_duo_eligible: true, lolRank: null }), SKILL);
    expect(chips).toEqual([{ key: "Valorant", label: "Valorant", detail: "Competitive" }]);
  });

  it("shows today's single chip for false, null and rows with no eligibility at all", () => {
    for (const lol_duo_eligible of [false, null, undefined]) {
      const chips = deckCardChips(card({ lol_duo_eligible }), SKILL);
      expect(chips).toEqual([{ key: "Valorant", label: "Valorant", detail: "Competitive" }]);
      expect(chips.some((c) => c.label === DUO_LABEL)).toBe(false);
    }
  });

  it("uses the canonical rank as League's detail when League is the top game", () => {
    const chips = deckCardChips(card({ topGames: [league, valorant], lol_duo_eligible: false }), SKILL);
    expect(chips).toEqual([{ key: "League of Legends", label: "League of Legends", detail: "Gold II" }]);
  });

  it("falls back to the skill label when the League text is not canonical, and never shows that text", () => {
    // enrichCandidates only ever sets lolRank to a canonical label; free text arrives as null.
    const chips = deckCardChips(card({ topGames: [league], lolRank: null }), SKILL);
    expect(chips).toEqual([{ key: "League of Legends", label: "League of Legends", detail: "Ranked Grinder" }]);
  });

  it("renders nothing for a card with no games", () => {
    expect(deckCardChips(card({ topGames: [] }), SKILL)).toEqual([]);
  });
});

describe("detailGames", () => {
  it("gives League its rank and leaves every other game on its skill level", () => {
    expect(detailGames(card({}), SKILL)).toEqual([
      { name: "Valorant", skillLevel: "Competitive", rank: undefined },
      { name: "League of Legends", skillLevel: "Ranked Grinder", rank: "Gold II" },
    ]);
  });

  it("prepends League when eligible and League is not in the top games", () => {
    const games = detailGames(card({ topGames: [valorant], lol_duo_eligible: true }), SKILL);
    expect(games[0]).toEqual({ name: "League of Legends", rank: "Gold II" });
    expect(games).toHaveLength(2);
  });

  it("does not prepend when not eligible", () => {
    expect(detailGames(card({ topGames: [valorant], lol_duo_eligible: null }), SKILL)).toHaveLength(1);
  });
});

describe("showsDuoLabel", () => {
  it("is true only for the server's true with a showable rank", () => {
    expect(showsDuoLabel(card({ lol_duo_eligible: true }))).toBe(true);
    expect(showsDuoLabel(card({ lol_duo_eligible: true, lolRank: null }))).toBe(false);
    expect(showsDuoLabel(card({ lol_duo_eligible: false }))).toBe(false);
    expect(showsDuoLabel(card({ lol_duo_eligible: null }))).toBe(false);
  });
});

describe("copy", () => {
  it("has no em dash", () => {
    for (const text of [DUO_LABEL, DUO_ACCESSIBILITY_LABEL, DUO_DETAIL_CAPTION]) {
      expect(text).not.toContain("\u2014");
    }
  });
});

describe("cardPicture", () => {
  it("prefers the picture over an old cover", () => {
    expect(cardPicture({ profilePhotoUrl: "p", headerPhotoUrl: "h" })).toBe("p");
  });

  it("falls back to an old cover, which is all build 11 ever uploaded", () => {
    expect(cardPicture({ profilePhotoUrl: null, headerPhotoUrl: "h" })).toBe("h");
  });

  it("is null with neither", () => {
    expect(cardPicture({ profilePhotoUrl: null, headerPhotoUrl: null })).toBeNull();
  });
});
