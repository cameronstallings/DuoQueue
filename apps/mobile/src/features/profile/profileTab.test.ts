import { lolDuoRuleSummary } from "@duoqueue/shared-types";
import { describe, expect, it } from "vitest";

import { SKILL_LABELS } from "../onboarding/profile-labels";
import { OWN_CARD_CAPTION, PAUSED_CARD_LINE, gameRowValue, leagueRuleLine, showAllLabel } from "./profileTab";

describe("leagueRuleLine", () => {
  it("says who a ranked League player can duo with", () => {
    expect(leagueRuleLine([{ lolTier: null, lolDivision: null }, { lolTier: "gold", lolDivision: 2 }])).toBe(
      "In Solo/Duo you can duo with Silver to Platinum.",
    );
  });

  it("uses the master line as the rank picker does", () => {
    expect(leagueRuleLine([{ lolTier: "master", lolDivision: null }])).toBe(
      lolDuoRuleSummary({ tier: "master", division: null }),
    );
  });

  it("says nothing for Unranked, whose line is a nudge for the picker", () => {
    expect(leagueRuleLine([{ lolTier: "unranked", lolDivision: null }])).toBeNull();
  });

  it("says nothing without League, or with a tier missing its division", () => {
    expect(leagueRuleLine([])).toBeNull();
    expect(leagueRuleLine([{ lolTier: null, lolDivision: null }])).toBeNull();
    expect(leagueRuleLine([{ lolTier: "gold", lolDivision: null }])).toBeNull();
  });
});

describe("copy", () => {
  it("has no em dash", () => {
    for (const text of [OWN_CARD_CAPTION, PAUSED_CARD_LINE]) expect(text).not.toContain("\u2014");
  });
});

describe("gameRowValue", () => {
  it("prefers a verified stat", () => {
    expect(gameRowValue({ skillLevel: "casual", rankText: "Gold II" }, "Diamond I", SKILL_LABELS)).toBe("\u2713 Diamond I");
  });

  it("then your own rank text", () => {
    expect(gameRowValue({ skillLevel: "casual", rankText: "Gold II" }, null, SKILL_LABELS)).toBe("Gold II");
  });

  it("then the skill level", () => {
    expect(gameRowValue({ skillLevel: "ranked_grinder", rankText: "  " }, null, SKILL_LABELS)).toBe("Ranked Grinder");
  });
});

describe("showAllLabel", () => {
  it("counts every game", () => {
    expect(showAllLabel(14)).toBe("Show all 14 \u203a");
  });
});
