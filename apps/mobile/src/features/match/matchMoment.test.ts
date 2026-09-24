import { describe, expect, it } from "vitest";

import { VB_W } from "../../theme/logo-geometry";
import { MATCH_REASON_COPY, matchParams, matchReason, ringTravel } from "./matchMoment";

describe("ringTravel", () => {
  it("is 190 of the mark's viewBox units at any width, as on duoqueue.io", () => {
    expect(ringTravel(VB_W)).toBeCloseTo(190, 6);
    expect(ringTravel(168)).toBeCloseTo(37.135, 2);
  });
});

describe("matchParams", () => {
  it("carries the pair facts the deck knows", () => {
    expect(matchParams({ matchId: "m1", name: "Dae", photo: "https://x/p.jpg", canDuo: true, sharedGames: 3 })).toEqual({
      matchId: "m1",
      name: "Dae",
      photo: "https://x/p.jpg",
      duo: "1",
      common: "3",
    });
  });

  it("sends an empty photo and no facts when there are none", () => {
    const params = matchParams({ matchId: "m1", name: "Dae", photo: null, canDuo: false, sharedGames: null });
    expect(params).toEqual({ matchId: "m1", name: "Dae", photo: "" });
    expect(params).not.toHaveProperty("duo");
    expect(params).not.toHaveProperty("common");
  });

  it("drops zero games in common", () => {
    expect(matchParams({ matchId: "m1", name: "Dae", photo: null, canDuo: false, sharedGames: 0 })).not.toHaveProperty("common");
  });
});

describe("matchReason", () => {
  it("says the pair can queue Solo/Duo before anything else", () => {
    expect(matchReason({ duo: "1", common: "3" })).toEqual({ kind: "duo", text: "You can queue Ranked Solo/Duo" });
  });

  it("counts games in common otherwise", () => {
    expect(matchReason({ common: "1" })).toEqual({ kind: "common", text: "1 game in common" });
    expect(matchReason({ common: "3" })).toEqual({ kind: "common", text: "3 games in common" });
  });

  it("says nothing without a fact, and never a score", () => {
    for (const common of ["0", "", undefined, "abc", "-2", "2.5"]) {
      expect(matchReason({ common })).toBeNull();
    }
    expect(matchReason({})).toBeNull();
  });

  it("has no em dash", () => {
    for (const text of Object.values(MATCH_REASON_COPY)) expect(text).not.toContain("\u{2014}");
    expect(matchReason({ common: "3" })?.text).not.toContain("\u{2014}");
  });
});
