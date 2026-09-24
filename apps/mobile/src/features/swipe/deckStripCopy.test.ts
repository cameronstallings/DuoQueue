import { describe, expect, it } from "vitest";

import { spacing, type } from "../../theme/tokens";

import {
  STRIP_FACE_OVERLAP,
  STRIP_FACE_SIZE,
  highlightsCountLabel,
  stripIsCompact,
  stripQuotaLabel,
  type StripQuota,
} from "./deckStripCopy";

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
    expect(highlightsCountLabel(4)).not.toContain("\u2014");
    expect(stripQuotaLabel({ is_premium: true, swipes_limit: null, swipes_used: 0 }, false)).not.toContain("\u2014");
  });
});

// IBM Plex Mono is monospaced: every glyph, the \u203a included, advances 600/1000 em, and React
// Native on iOS adds the letter spacing after every glyph, the last one included.
function monoWidth(text: string, style: { fontSize: number; letterSpacing: number }): number {
  return text.length * (style.fontSize * 0.6 + style.letterSpacing);
}

// The Deck insets the strip 24pt each side; inside it are a 1pt border and 8pt of padding each side.
function rowSpace(windowWidth: number): number {
  return windowWidth - 2 * spacing.lg - 2 * (1 + spacing.sm);
}

// Three faces with their 1pt rings, overlapping; "HIGHLIGHTS"; the count with its \u203a; the swipes
// text; and the three 8pt gaps between those four children.
function rowWidth(count: number, quotaText: string): number {
  const faces = 3 * (STRIP_FACE_SIZE + 2) - 2 * STRIP_FACE_OVERLAP;
  return (
    faces +
    monoWidth("Highlights", type.label) +
    monoWidth(`${highlightsCountLabel(count)} \u203a`, type.tick) +
    monoWidth(quotaText, type.tick) +
    3 * spacing.sm
  );
}

describe("the strip at phone widths", () => {
  // useStandouts asks for at most 8, so the count is one digit.
  const MOST_HIGHLIGHTS = 8;
  const quotas: StripQuota[] = [
    { is_premium: true, swipes_limit: null, swipes_used: 0 },
    { is_premium: false, swipes_limit: 25, swipes_used: 0 },
    { is_premium: false, swipes_limit: 25, swipes_used: 24 },
  ];

  // 375: SE and mini. 390/393/402: the common 6.1" phones. 414 up: Plus, Max, Pro Max.
  it.each([375, 390, 393, 402, 414, 428, 430, 440])("fits without cutting the count at %ipt", (windowWidth) => {
    for (const quota of quotas) {
      const quotaText = stripQuotaLabel(quota, stripIsCompact(windowWidth));
      expect(rowWidth(MOST_HIGHLIGHTS, quotaText)).toBeLessThanOrEqual(rowSpace(windowWidth));
    }
  });

  it("uses the short copy on the 6.1-inch phones and the full copy from 414pt", () => {
    expect(stripIsCompact(375)).toBe(true);
    expect(stripIsCompact(393)).toBe(true);
    expect(stripIsCompact(402)).toBe(true);
    expect(stripIsCompact(414)).toBe(false);
    expect(stripIsCompact(440)).toBe(false);
  });
});
