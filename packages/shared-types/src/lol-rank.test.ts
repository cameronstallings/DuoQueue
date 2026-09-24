import { describe, expect, it } from "vitest";

import {
  formatLolRank,
  isCanonicalLolRankLabel,
  LOL_DIVISIONAL_TIERS,
  LOL_TIER_CHOICES,
  LOL_TIERS,
  lolDuoRuleSummary,
  lolSoloDuoEligible,
  parseLolRankText,
  type LolDivision,
  type LolRank,
  type LolTierChoice,
} from "./lol-rank";

/**
 * The TypeScript half of the League duo rules. Every case here is also in
 * supabase/checks/0069_league_rank_duo.sql (section A), run against the SQL twin, and the
 * 306 / 636 / 82 checksum is the same number in both. If this file goes red and the SQL one
 * does not (or the reverse), one of the two implementations has drifted from Riot's table.
 */

function r(tier: LolTierChoice, division: LolDivision | null = null): LolRank {
  return { tier, division };
}

/** The 32 choices: 28 divisional ranks (Iron IV .. Diamond I), Master, Grandmaster,
 * Challenger, Unranked. Built the same way as the SQL test's values list. */
const ALL_CHOICES: LolRank[] = [
  ...LOL_DIVISIONAL_TIERS.flatMap((tier) => ([4, 3, 2, 1] as const).map((d) => r(tier, d))),
  r("master"),
  r("grandmaster"),
  r("challenger"),
  r("unranked"),
];

function label(rank: LolRank): string {
  return formatLolRank(rank) ?? `${rank.tier}/${rank.division}`;
}

describe("Riot's rows (8.1 A1): at least one true and one false per row", () => {
  const cases: [LolRank, LolRank, boolean][] = [
    [r("iron", 4), r("silver", 1), true],
    [r("iron", 1), r("gold", 4), false],
    [r("bronze", 2), r("iron", 4), true],
    [r("bronze", 1), r("gold", 4), false],
    [r("silver", 4), r("gold", 1), true],
    [r("silver", 1), r("platinum", 4), false],
    [r("gold", 2), r("silver", 4), true],
    [r("gold", 2), r("platinum", 1), true],
    [r("gold", 4), r("bronze", 1), false],
    [r("gold", 1), r("emerald", 4), false],
    [r("platinum", 3), r("gold", 4), true],
    [r("platinum", 1), r("emerald", 1), true],
    [r("platinum", 1), r("diamond", 4), false],
    [r("emerald", 2), r("diamond", 3), true],
    [r("emerald", 1), r("platinum", 4), true],
    [r("emerald", 4), r("gold", 1), false],
    [r("diamond", 4), r("emerald", 2), true],
    [r("diamond", 2), r("diamond", 4), true],
    [r("diamond", 4), r("diamond", 1), false],
    [r("diamond", 1), r("diamond", 1), true],
    [r("diamond", 1), r("emerald", 1), false],
  ];
  for (const [a, b, expected] of cases) {
    it(`${label(a)} x ${label(b)} is ${expected}`, () => {
      expect(lolSoloDuoEligible(a, b)).toBe(expected);
    });
  }
});

describe("unknown pairs are null, never claimed (8.1 A2)", () => {
  it("Unranked with anyone", () => {
    expect(lolSoloDuoEligible(r("unranked"), r("gold", 2))).toBeNull();
  });

  it("no rank at all", () => {
    expect(lolSoloDuoEligible(null, r("gold", 2))).toBeNull();
  });

  it("Master with Master, and Master with Diamond I (depends on LP we do not collect)", () => {
    expect(lolSoloDuoEligible(r("master"), r("master"))).toBeNull();
    expect(lolSoloDuoEligible(r("master"), r("diamond", 1))).toBeNull();
  });

  const disagreements: [LolRank, LolRank][] = [
    [r("emerald", 4), r("diamond", 4)],
    [r("emerald", 4), r("diamond", 3)],
    [r("emerald", 3), r("diamond", 4)],
    [r("emerald", 3), r("diamond", 3)],
    [r("emerald", 2), r("diamond", 2)],
    [r("emerald", 1), r("diamond", 2)],
    [r("diamond", 3), r("diamond", 1)],
    [r("diamond", 2), r("diamond", 1)],
  ];
  for (const [a, b] of disagreements) {
    it(`${label(a)} x ${label(b)}: Riot's two rows disagree`, () => {
      expect(lolSoloDuoEligible(a, b)).toBeNull();
      expect(lolSoloDuoEligible(b, a)).toBeNull();
    });
  }
});

describe("apex ranks (8.1 A3)", () => {
  it("are false where Riot says no", () => {
    expect(lolSoloDuoEligible(r("master"), r("diamond", 2))).toBe(false);
    expect(lolSoloDuoEligible(r("grandmaster"), r("grandmaster"))).toBe(false);
    expect(lolSoloDuoEligible(r("challenger"), r("master"))).toBe(false);
    expect(lolSoloDuoEligible(r("grandmaster"), r("iron", 4))).toBe(false);
  });
});

describe("the whole table (8.1 A4, A5)", () => {
  const results = ALL_CHOICES.flatMap((a) => ALL_CHOICES.map((b) => ({ a, b, value: lolSoloDuoEligible(a, b) })));

  it("covers 32 choices, 1,024 ordered pairs", () => {
    expect(ALL_CHOICES).toHaveLength(32);
    expect(results).toHaveLength(1024);
  });

  it("splits into 306 true, 636 false, 82 null (the checksum shared with the SQL test)", () => {
    expect(results.filter((x) => x.value === true)).toHaveLength(306);
    expect(results.filter((x) => x.value === false)).toHaveLength(636);
    expect(results.filter((x) => x.value === null)).toHaveLength(82);
  });

  it("splits the nulls into 63 Unranked, 3 Master/LP and 16 table-disagreement pairs", () => {
    const nulls = results.filter((x) => x.value === null);
    const unranked = nulls.filter((x) => x.a.tier === "unranked" || x.b.tier === "unranked");
    const master = nulls.filter(
      (x) => x.a.tier !== "unranked" && x.b.tier !== "unranked" && (x.a.tier === "master" || x.b.tier === "master"),
    );
    expect(unranked).toHaveLength(63);
    expect(master).toHaveLength(3);
    expect(nulls.length - unranked.length - master.length).toBe(16);
  });

  it("is symmetric: f(a, b) equals f(b, a) for every pair", () => {
    const asymmetric = results.filter((x) => lolSoloDuoEligible(x.b, x.a) !== x.value);
    expect(asymmetric).toEqual([]);
  });

  it("matches the per-rank true counts in the design's resulting table", () => {
    const trueCount = (rank: LolRank) => ALL_CHOICES.filter((b) => lolSoloDuoEligible(rank, b) === true).length;
    for (const d of [4, 3, 2, 1] as const) {
      expect(trueCount(r("iron", d))).toBe(12);
      expect(trueCount(r("bronze", d))).toBe(12);
      expect(trueCount(r("silver", d))).toBe(16);
      expect(trueCount(r("gold", d))).toBe(12);
      expect(trueCount(r("platinum", d))).toBe(12);
    }
    expect(trueCount(r("emerald", 4))).toBe(8);
    expect(trueCount(r("emerald", 3))).toBe(8);
    expect(trueCount(r("emerald", 2))).toBe(10);
    expect(trueCount(r("emerald", 1))).toBe(10);
    expect(trueCount(r("diamond", 4))).toBe(5);
    expect(trueCount(r("diamond", 3))).toBe(5);
    expect(trueCount(r("diamond", 2))).toBe(3);
    expect(trueCount(r("diamond", 1))).toBe(1);
    expect(trueCount(r("master"))).toBe(0);
    expect(trueCount(r("grandmaster"))).toBe(0);
    expect(trueCount(r("challenger"))).toBe(0);
    expect(trueCount(r("unranked"))).toBe(0);
  });
});

describe("parseLolRankText (8.1 A6)", () => {
  const accepted: [string, LolRank][] = [
    ["Iron 1", r("iron", 1)],
    ["Iron 3", r("iron", 3)],
    ["Diamond II", r("diamond", 2)],
    ["plat 2", r("platinum", 2)],
    ["GOLD iv", r("gold", 4)],
    ["gold4", r("gold", 4)],
    ["  Silver   I ", r("silver", 1)],
    ["Master", r("master")],
    ["Master I", r("master")],
    ["gm", r("grandmaster")],
    ["Grand Master", r("grandmaster")],
    ["Unranked", r("unranked")],
  ];
  for (const [text, expected] of accepted) {
    it(`parses ${JSON.stringify(text)}`, () => {
      expect(parseLolRankText(text)).toEqual(expected);
    });
  }

  const rejected: (string | null)[] = ["Diamond", "Gold V", "Immortal 1", "Master 400 LP", "", null];
  for (const text of rejected) {
    it(`does not parse ${JSON.stringify(text)}`, () => {
      expect(parseLolRankText(text)).toBeNull();
    });
  }

  it("does not accept an apex rank with a division other than I", () => {
    expect(parseLolRankText("Master 2")).toBeNull();
    expect(parseLolRankText("Challenger IV")).toBeNull();
  });
});

describe("formatLolRank (8.1 A7)", () => {
  it("writes the canonical labels", () => {
    expect(formatLolRank(r("gold", 2))).toBe("Gold II");
    expect(formatLolRank(r("iron", 4))).toBe("Iron IV");
    expect(formatLolRank(r("master"))).toBe("Master");
    expect(formatLolRank(r("grandmaster"))).toBe("Grandmaster");
    expect(formatLolRank(r("unranked"))).toBe("Unranked");
    expect(formatLolRank(r("gold"))).toBeNull();
  });

  it("round-trips every one of the 32 choices through parse", () => {
    for (const rank of ALL_CHOICES) {
      const text = formatLolRank(rank);
      expect(text).not.toBeNull();
      expect(parseLolRankText(text)).toEqual(rank);
      expect(isCanonicalLolRankLabel(text)).toBe(true);
    }
  });
});

describe("isCanonicalLolRankLabel", () => {
  it("is true only for the labels the server writes", () => {
    expect(isCanonicalLolRankLabel("Gold II")).toBe(true);
    expect(isCanonicalLolRankLabel("Master")).toBe(true);
    expect(isCanonicalLolRankLabel("gold 2")).toBe(false);
    expect(isCanonicalLolRankLabel("Iron 1")).toBe(false);
    expect(isCanonicalLolRankLabel("Diamond")).toBe(false);
    expect(isCanonicalLolRankLabel("hardstuck")).toBe(false);
    expect(isCanonicalLolRankLabel(null)).toBe(false);
  });
});

describe("LOL_TIERS", () => {
  it("is Riot's ladder, lowest to highest", () => {
    expect(LOL_TIERS).toEqual([
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
    ]);
    expect(LOL_TIER_CHOICES[0]).toBe("unranked");
  });
});

describe("lolDuoRuleSummary (the picker's helper copy, design section 6.3)", () => {
  it("restates Riot's row for every tier, word for word", () => {
    for (const d of [4, 3, 2, 1] as const) {
      expect(lolDuoRuleSummary(r("iron", d))).toBe("In Solo/Duo you can duo with Iron to Silver.");
      expect(lolDuoRuleSummary(r("bronze", d))).toBe("In Solo/Duo you can duo with Iron to Silver.");
      expect(lolDuoRuleSummary(r("silver", d))).toBe("In Solo/Duo you can duo with Iron to Gold.");
      expect(lolDuoRuleSummary(r("gold", d))).toBe("In Solo/Duo you can duo with Silver to Platinum.");
      expect(lolDuoRuleSummary(r("platinum", d))).toBe("In Solo/Duo you can duo with Gold to Emerald.");
      expect(lolDuoRuleSummary(r("emerald", d))).toBe("In Solo/Duo you can duo with Platinum to Diamond III.");
    }
    for (const d of [4, 3, 2] as const) {
      expect(lolDuoRuleSummary(r("diamond", d))).toBe("In Solo/Duo you can duo with Emerald II to Diamond II.");
    }
    expect(lolDuoRuleSummary(r("diamond", 1))).toBe("In Solo/Duo you can duo with Diamond III to Master (under 200 LP).");
    expect(lolDuoRuleSummary(r("master"))).toBe(
      "Under 200 LP you can duo with Diamond I, and you can duo with Master players within 400 LP of you. DuoQueue doesn't track LP, so Master duos aren't labeled.",
    );
    expect(lolDuoRuleSummary(r("grandmaster"))).toBe("Duo isn't available at Grandmaster or Challenger.");
    expect(lolDuoRuleSummary(r("challenger"))).toBe("Duo isn't available at Grandmaster or Challenger.");
    expect(lolDuoRuleSummary(r("unranked"))).toBe(
      "Not placed yet? Pick your rank after placements to see who you can duo with.",
    );
  });

  it("names Riot's 200 LP condition in the Master line", () => {
    expect(lolDuoRuleSummary(r("master"))).toContain("200 LP");
  });

  it("says nothing for an incomplete rank", () => {
    expect(lolDuoRuleSummary(r("gold"))).toBeNull();
  });

  it("contains no em dash in any line", () => {
    for (const rank of ALL_CHOICES) {
      expect(lolDuoRuleSummary(rank) ?? "").not.toContain("\u2014");
    }
  });
});
