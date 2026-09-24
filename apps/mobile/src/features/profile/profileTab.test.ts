import { lolDuoRuleSummary } from "@duoqueue/shared-types";
import { describe, expect, it } from "vitest";

import { OWN_CARD_CAPTION, PAUSED_CARD_LINE, leagueRuleLine } from "./profileTab";

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
