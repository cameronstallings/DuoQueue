import type { SkillLevel } from "@duoqueue/shared-types";
import { describe, expect, it } from "vitest";

import { PLATFORM_LABELS, PLAYSTYLE_LABELS, REGION_LABELS } from "../onboarding/profile-labels";
import {
  CELL_COPY,
  DUO_ACCESSIBILITY_LABEL,
  DUO_DETAIL_CAPTION,
  DUO_LABEL,
  type CardCellsMode,
  type CellLabels,
  cardCells,
  cardDetailsLine,
  cardPages,
  cardPicture,
  deckCardChips,
  detailGames,
  showsDuoLabel,
} from "./cardChips";
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

const LABELS: CellLabels = { skill: SKILL, platform: PLATFORM_LABELS, playstyle: PLAYSTYLE_LABELS };
type Facts = Parameters<typeof cardCells>[0];

function facts(over: Partial<Facts> = {}): Facts {
  return {
    topGames: [valorant, league],
    lolRank: "Gold II",
    lol_duo_eligible: undefined,
    platforms: ["pc", "xbox"],
    playstyles: ["team_player", "chill"],
    ...over,
  };
}

const deck = (sharedGames: number): CardCellsMode => ({ kind: "deck", sharedGames });

describe("cardCells", () => {
  it("League ranked and eligible on the deck: rank, the lit Solo/Duo cell, games in common", () => {
    expect(cardCells(facts({ lol_duo_eligible: true }), deck(3), LABELS)).toEqual([
      { key: "game", label: "League rank", value: "Gold II", lit: false, accessibilityLabel: "League rank: Gold II" },
      { key: "duo", label: "Solo/Duo", value: "Can duo", lit: true, accessibilityLabel: DUO_ACCESSIBILITY_LABEL },
      { key: "common", label: "In common", value: "3 games", lit: false, accessibilityLabel: "3 games in common" },
    ]);
  });

  it("League ranked but not eligible: platforms instead, and nothing lights", () => {
    for (const lol_duo_eligible of [false, null, undefined]) {
      const cells = cardCells(facts({ lol_duo_eligible }), deck(3), LABELS);
      expect(cells.map((c) => c.key)).toEqual(["game", "platforms", "common"]);
      expect(cells[1]).toMatchObject({ label: "Plays on", value: "PC · Xbox" });
      expect(cells.some((c) => c.lit)).toBe(false);
    }
  });

  it("never lights without a rank it can show", () => {
    const cells = cardCells(facts({ lol_duo_eligible: true, lolRank: null }), deck(1), LABELS);
    expect(cells.some((c) => c.lit)).toBe(false);
  });

  it("non-League player: the top game and its skill", () => {
    const cells = cardCells(facts({ topGames: [valorant], lolRank: null }), deck(1), LABELS);
    expect(cells[0]).toEqual({
      key: "game",
      label: "Valorant",
      value: "Competitive",
      lit: false,
      accessibilityLabel: "Valorant: Competitive",
    });
  });

  it("no games: no game cell", () => {
    const cells = cardCells(facts({ topGames: [], lolRank: null }), deck(2), LABELS);
    expect(cells.map((c) => c.key)).toEqual(["platforms", "common"]);
  });

  it("falls back from platforms to the first playstyle, in catalog order", () => {
    const cells = cardCells(facts({ platforms: [] }), deck(2), LABELS);
    expect(cells[1]).toEqual({ key: "style", label: "Style", value: "Chill", lit: false, accessibilityLabel: "Style: Chill" });
  });

  it("drops unknown playstyle tags", () => {
    const cells = cardCells(facts({ platforms: [], playstyles: ["mystery", "grinder"] }), deck(2), LABELS);
    expect(cells[1]?.value).toBe("Grinder");
  });

  it("leaves the middle cell out rather than showing a negative", () => {
    const cells = cardCells(facts({ platforms: [], playstyles: [] }), deck(2), LABELS);
    expect(cells.map((c) => c.key)).toEqual(["game", "common"]);
  });

  it("shows two platforms and says all of them to a screen reader", () => {
    const cells = cardCells(facts({ platforms: ["pc", "playstation", "switch"] }), deck(2), LABELS);
    expect(cells[1]).toMatchObject({ value: "PC · PlayStation", accessibilityLabel: "Plays on: PC, PlayStation, Switch" });
  });

  it("counts games in common, with none as 'None yet'", () => {
    expect(cardCells(facts(), deck(0), LABELS).at(-1)).toMatchObject({ value: "None yet", accessibilityLabel: "No games in common yet" });
    expect(cardCells(facts(), deck(1), LABELS).at(-1)).toMatchObject({ value: "1 game", accessibilityLabel: "1 game in common" });
  });

  it("your own card never lights and shows your game total", () => {
    const cells = cardCells(facts({ lol_duo_eligible: true }), { kind: "own", totalGames: 14 }, LABELS);
    expect(cells.map((c) => c.key)).toEqual(["game", "platforms", "games"]);
    expect(cells[2]).toEqual({ key: "games", label: "Games", value: "14", lit: false, accessibilityLabel: "14 games" });
    expect(cells.some((c) => c.lit)).toBe(false);
  });

  it("the party deck has no pair data: no light, no games in common", () => {
    const cells = cardCells(facts({ lol_duo_eligible: true }), { kind: "party" }, LABELS);
    expect(cells.map((c) => c.key)).toEqual(["game", "platforms"]);
  });
});

describe("cardPages", () => {
  const prompts = [
    { question: "My comfort game is", answer: "Stardew Valley." },
    { question: "I geek out on", answer: "New co-op games." },
    { question: "Never tell me", answer: "To play support." },
  ];

  it("is the picture, then the three prompts", () => {
    expect(cardPages("p", prompts)).toEqual([
      { kind: "picture", url: "p" },
      { kind: "prompt", question: "My comfort game is", answer: "Stardew Valley." },
      { kind: "prompt", question: "I geek out on", answer: "New co-op games." },
      { kind: "prompt", question: "Never tell me", answer: "To play support." },
    ]);
  });

  it("opens on the first prompt when there is no picture", () => {
    expect(cardPages(null, prompts)[0]).toEqual({ kind: "prompt", question: "My comfort game is", answer: "Stardew Valley." });
    expect(cardPages(null, prompts)).toHaveLength(3);
  });

  it("never shows more than three prompts", () => {
    expect(cardPages("p", [...prompts, { question: "Extra", answer: "Extra" }])).toHaveLength(4);
  });

  it("skips a blank answer", () => {
    expect(cardPages(null, [{ question: "Q", answer: "   " }, prompts[0]!])).toEqual([
      { kind: "prompt", question: "My comfort game is", answer: "Stardew Valley." },
    ]);
  });

  it("is one blank page with neither a picture nor a prompt", () => {
    expect(cardPages(null, [])).toEqual([{ kind: "blank" }]);
  });
});

describe("cardDetailsLine", () => {
  it("is age, region and languages", () => {
    expect(cardDetailsLine({ age: 27, region: "na_west", languages: ["en", "fr"] }, REGION_LABELS)).toBe("27 · NA West · en fr");
  });

  it("leaves languages out when there are none", () => {
    expect(cardDetailsLine({ age: 27, region: "eu", languages: [] }, REGION_LABELS)).toBe("27 · Europe");
  });
});

describe("cell copy", () => {
  it("has no em dash", () => {
    for (const text of Object.values(CELL_COPY)) expect(text).not.toContain("—");
  });
});
