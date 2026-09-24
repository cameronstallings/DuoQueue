import { describe, expect, it } from "vitest";

import { highlightsCountLabel, stripQuotaLabel } from "./deckStripCopy";

describe("stripQuotaLabel", () => {
  it("is empty until the quota loads", () => {
    expect(stripQuotaLabel(undefined, false)).toBe("");
  });

  it("says unlimited for DuoQueue+", () => {
    const quota = { is_premium: true, swipes_limit: null, swipes_used: 40 };
    expect(stripQuotaLabel(quota, false)).toBe("Unlimited swipes");
    expect(stripQuotaLabel(quota, true)).toBe("Unlimited");
  });

  it("counts what is left today", () => {
    const quota = { is_premium: false, swipes_limit: 25, swipes_used: 7 };
    expect(stripQuotaLabel(quota, false)).toBe("18 swipes left");
    expect(stripQuotaLabel(quota, true)).toBe("18 left");
  });

  it("uses the free limit when the server sends none", () => {
    expect(stripQuotaLabel({ is_premium: false, swipes_limit: null, swipes_used: 5 }, false)).toBe("20 swipes left");
  });

  it("never goes below zero, and says one swipe", () => {
    expect(stripQuotaLabel({ is_premium: false, swipes_limit: 25, swipes_used: 30 }, false)).toBe("0 swipes left");
    expect(stripQuotaLabel({ is_premium: false, swipes_limit: 25, swipes_used: 24 }, false)).toBe("1 swipe left");
  });
});

describe("highlightsCountLabel", () => {
  it("counts today's picks", () => {
    expect(highlightsCountLabel(4)).toBe("4 picked today");
    expect(highlightsCountLabel(1)).toBe("1 picked today");
  });

  it("has no em dash", () => {
    expect(highlightsCountLabel(4)).not.toContain("—");
    expect(stripQuotaLabel({ is_premium: true, swipes_limit: null, swipes_used: 0 }, false)).not.toContain("—");
  });
});
