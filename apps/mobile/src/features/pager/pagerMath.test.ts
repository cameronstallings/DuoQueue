import { describe, expect, it } from "vitest";

import {
  DOT_GAP,
  DOT_SIZE,
  PEEK_DELAY_MS,
  PEEK_HOLD_MS,
  PEEK_OFFSET,
  adjustedPage,
  clampPage,
  dotLight,
  footFade,
  pageAtOffset,
  pagerA11yValue,
  settledPage,
  shouldPeek,
} from "./pagerMath";

describe("clampPage", () => {
  it("keeps an index inside the pager", () => {
    expect(clampPage(-1, 3)).toBe(0);
    expect(clampPage(1, 3)).toBe(1);
    expect(clampPage(7, 3)).toBe(2);
  });

  it("is 0 for an empty pager", () => {
    expect(clampPage(2, 0)).toBe(0);
  });
});

describe("pageAtOffset", () => {
  it("rounds to the nearest page", () => {
    expect(pageAtOffset(0, 393, 3)).toBe(0);
    expect(pageAtOffset(196, 393, 3)).toBe(0);
    expect(pageAtOffset(197, 393, 3)).toBe(1);
    expect(pageAtOffset(786, 393, 3)).toBe(2);
  });

  it("counts the peek's 32pt as still page one", () => {
    expect(pageAtOffset(PEEK_OFFSET, 393, 3)).toBe(0);
  });

  it("clamps past the ends and survives a zero width", () => {
    expect(pageAtOffset(5000, 393, 3)).toBe(2);
    expect(pageAtOffset(-40, 393, 3)).toBe(0);
    expect(pageAtOffset(100, 0, 3)).toBe(0);
  });
});

describe("settledPage (a drag that ends on a page's edge, with no momentum to follow)", () => {
  it("is the page when the drag ended on it", () => {
    expect(settledPage(1179, 393, 4)).toBe(3);
    expect(settledPage(1179.3, 393, 4)).toBe(3);
    expect(settledPage(0, 393, 4)).toBe(0);
  });

  it("is null between pages, where the momentum end will say", () => {
    expect(settledPage(1000, 393, 4)).toBeNull();
    expect(settledPage(PEEK_OFFSET, 393, 4)).toBeNull();
  });

  it("survives a zero width", () => {
    expect(settledPage(0, 0, 4)).toBeNull();
  });
});

describe("dotLight", () => {
  it("is fully lit on its own page and dark a page away", () => {
    expect(dotLight(393, 1, 393)).toBe(1);
    expect(dotLight(0, 1, 393)).toBe(0);
    expect(dotLight(786, 1, 393)).toBe(0);
  });

  it("follows the finger between pages", () => {
    expect(dotLight(196.5, 0, 393)).toBeCloseTo(0.5);
    expect(dotLight(196.5, 1, 393)).toBeCloseTo(0.5);
  });

  it("lights only the first dot before layout", () => {
    expect(dotLight(0, 0, 0)).toBe(1);
    expect(dotLight(0, 1, 0)).toBe(0);
  });
});

describe("footFade (the tour's Skip and Start swiping)", () => {
  const w = 393;
  const last = 3;
  const lastX = last * w;

  it("shows Skip and hides Start before the last turn starts", () => {
    expect(footFade(0, last, w)).toEqual({ skip: 1, start: 0 });
    expect(footFade(lastX - w, last, w)).toEqual({ skip: 1, start: 0 });
  });

  it("never shows both half-faded: Skip is gone by the halfway point, Start begins there", () => {
    expect(footFade(lastX - w / 2, last, w)).toEqual({ skip: 0, start: 0 });
    const early = footFade(lastX - (3 * w) / 4, last, w);
    expect(early.skip).toBeCloseTo(0.5);
    expect(early.start).toBe(0);
    const late = footFade(lastX - w / 4, last, w);
    expect(late.skip).toBe(0);
    expect(late.start).toBeCloseTo(0.5);
  });

  it("shows only Start on the last page", () => {
    expect(footFade(lastX, last, w)).toEqual({ skip: 0, start: 1 });
  });

  it("is Start alone for a one-page pager, and Skip alone before layout", () => {
    expect(footFade(0, 0, w)).toEqual({ skip: 0, start: 1 });
    expect(footFade(0, last, 0)).toEqual({ skip: 1, start: 0 });
  });
});

describe("shouldPeek", () => {
  const base = { count: 3, ready: true, peeked: false, touched: false, reduceMotion: false, screenReader: false };

  it("peeks once page one has content", () => {
    expect(shouldPeek(base)).toBe(true);
  });

  it("waits for page one's content", () => {
    expect(shouldPeek({ ...base, ready: false })).toBe(false);
  });

  it("never peeks twice", () => {
    expect(shouldPeek({ ...base, peeked: true })).toBe(false);
  });

  it("stands down once the user has moved the pager", () => {
    expect(shouldPeek({ ...base, touched: true })).toBe(false);
  });

  it("stands down under Reduce Motion and under a screen reader", () => {
    expect(shouldPeek({ ...base, reduceMotion: true })).toBe(false);
    expect(shouldPeek({ ...base, screenReader: true })).toBe(false);
  });

  it("has nowhere to peek with one page", () => {
    expect(shouldPeek({ ...base, count: 1 })).toBe(false);
  });

  it("uses the design's numbers", () => {
    expect([PEEK_OFFSET, PEEK_DELAY_MS, PEEK_HOLD_MS, DOT_SIZE, DOT_GAP]).toEqual([32, 1400, 450, 7, 8]);
  });
});

describe("pagerA11yValue and adjustedPage (VoiceOver's pager)", () => {
  it("reads N of M, one-based", () => {
    expect(pagerA11yValue(0, 3)).toEqual({ min: 1, max: 3, now: 1, text: "1 of 3" });
    expect(pagerA11yValue(2, 4)).toEqual({ min: 1, max: 4, now: 3, text: "3 of 4" });
  });

  it("names the page it landed on, its title on one line", () => {
    const nbsp = String.fromCharCode(0xa0);
    const titles = ["Keep swiping.\nChoose who shows up.", "See everyone who wants to duo.", `Choose your${nbsp}plan.`];
    expect(pagerA11yValue(0, 3, titles).text).toBe("1 of 3, Keep swiping. Choose who shows up.");
    expect(pagerA11yValue(1, 3, titles).text).toBe("2 of 3, See everyone who wants to duo.");
    expect(pagerA11yValue(2, 3, titles).text).toBe("3 of 3, Choose your plan.");
    expect(pagerA11yValue(1, 3, []).text).toBe("2 of 3");
  });

  it("turns one page per swipe and stops at the ends", () => {
    expect(adjustedPage("increment", 0, 3)).toBe(1);
    expect(adjustedPage("increment", 2, 3)).toBe(2);
    expect(adjustedPage("decrement", 0, 3)).toBe(0);
    expect(adjustedPage("decrement", 2, 3)).toBe(1);
    expect(adjustedPage("activate", 1, 3)).toBe(1);
  });
});
