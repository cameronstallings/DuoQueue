import { describe, expect, it } from "vitest";

import { spacing, type } from "../../theme/tokens";

import {
  STRIP_FACE_OVERLAP,
  STRIP_FACE_SIZE,
  STRIP_MAX_FONT_SCALE,
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
// Native on iOS adds the letter spacing after every glyph, the last one included. The strip's
// text grows with Dynamic Type at most STRIP_MAX_FONT_SCALE, so the sums use that scale.
function monoWidth(text: string, style: { fontSize: number; letterSpacing: number }): number {
  return text.length * (style.fontSize * 0.6 + style.letterSpacing) * STRIP_MAX_FONT_SCALE;
}

// The Deck insets the strip 24pt each side; inside it are a 1pt border and 8pt of padding each side.
function rowSpace(windowWidth: number): number {
  return windowWidth - 2 * spacing.lg - 2 * (1 + spacing.sm);
}

// The children on the row, with an 8pt gap between each two.
function rowWidth(children: number[]): number {
  return children.reduce((sum, width) => sum + width, 0) + (children.length - 1) * spacing.sm;
}

// Three faces with their 1pt rings, overlapping; the loading skeletons have no ring.
const FACES = 3 * (STRIP_FACE_SIZE + 2) - 2 * STRIP_FACE_OVERLAP;
const SKELETON_FACES = 3 * STRIP_FACE_SIZE - 2 * STRIP_FACE_OVERLAP;
const HIGHLIGHTS = monoWidth("Highlights", type.label);

describe("the strip at phone widths", () => {
  // useStandouts asks for at most 8, so the count is one digit.
  const MOST_HIGHLIGHTS = 8;
  const quotas: StripQuota[] = [
    { is_premium: true, swipes_limit: null, swipes_used: 0 },
    { is_premium: false, swipes_limit: 25, swipes_used: 0 },
    { is_premium: false, swipes_limit: 25, swipes_used: 24 },
  ];
  // 375: SE and mini. 390/393/402: the common 6.1" phones. 414 up: Plus, Max, Pro Max.
  const widths = [375, 390, 393, 402, 414, 428, 430, 440];

  it.each(widths)("fits the count and the swipes beside the faces, keeping the \u203a, at %ipt", (windowWidth) => {
    const count = monoWidth(`${highlightsCountLabel(MOST_HIGHLIGHTS)} \u203a`, type.tick);
    for (const quota of quotas) {
      const swipes = monoWidth(stripQuotaLabel(quota, stripIsCompact(windowWidth, true)), type.tick);
      expect(rowWidth([FACES, HIGHLIGHTS, count, swipes])).toBeLessThanOrEqual(rowSpace(windowWidth));
    }
  });

  it.each(widths)("fits the full swipes copy while Highlights load, and with none, at %ipt", (windowWidth) => {
    for (const quota of quotas) {
      const quotaText = stripQuotaLabel(quota, stripIsCompact(windowWidth, false));
      const swipes = monoWidth(quotaText, type.tick);
      expect(rowWidth([SKELETON_FACES, HIGHLIGHTS, swipes])).toBeLessThanOrEqual(rowSpace(windowWidth));
      expect(rowWidth([swipes])).toBeLessThanOrEqual(rowSpace(windowWidth));
    }
  });

  it("uses the short copy on the 6.1-inch phones and the full copy from 414pt", () => {
    expect(stripIsCompact(375, true)).toBe(true);
    expect(stripIsCompact(393, true)).toBe(true);
    expect(stripIsCompact(402, true)).toBe(true);
    expect(stripIsCompact(414, true)).toBe(false);
    expect(stripIsCompact(440, true)).toBe(false);
  });

  it("uses the full copy on any phone when no count is beside it", () => {
    expect(stripIsCompact(375, false)).toBe(false);
    expect(stripIsCompact(393, false)).toBe(false);
    const quota = { is_premium: false, swipes_limit: 25, swipes_used: 7 };
    expect(stripQuotaLabel(quota, stripIsCompact(393, false))).toBe("18 swipes left");
    expect(stripQuotaLabel({ ...quota, is_premium: true }, stripIsCompact(393, false))).toBe("Unlimited swipes");
  });
});
