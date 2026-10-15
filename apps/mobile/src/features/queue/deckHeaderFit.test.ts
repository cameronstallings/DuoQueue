import { describe, expect, it } from "vitest";

import {
  clusterWidth,
  DECK_TITLE_MAX_FONT_SCALE,
  deckHeaderCompact,
  headerBudget,
  headerFits,
  QUEUE_PILL_W,
} from "./deckHeaderFit";
import { pillContentWidth, QUEUE_UP_PILL, queueUpButtonLabel } from "./queueState";

/** iPhone widths in points from the 6.1-inch phones up: SE/mini, 12-14, 15/16, 16 Pro/17,
 * Plus/Max (older), 12-14 Pro Max and 14 Plus, 15 Pro Max, 16 Pro Max. */
const WIDTHS = [375, 390, 393, 402, 414, 428, 430, 440];

/** 1.0.2's floor is React Native 0.81's iOS 15.1, so the 320pt iPhone SE (1st gen) and iPod
 * touch (7th gen) install it too (both run iOS 15.8). */
const ALL_WIDTHS = [320, ...WIDTHS];

/** Every iOS text size React Native reports as fontScale: xS to xxxL, then the five
 * accessibility sizes. */
const FONT_SCALES = [0.823, 0.882, 0.941, 1, 1.118, 1.235, 1.353, 1.786, 2.143, 2.643, 3.143, 3.571];

describe("the deck header", () => {
  it("keeps the text links at the default text size on every phone from 375pt up, with the Power-Up rocket and without", () => {
    for (const width of WIDTHS) {
      for (const rocket of [false, true]) {
        expect(deckHeaderCompact(width, { rocket, fontScale: 1 }), `${width} rocket ${rocket}`).toBe(false);
        expect(headerFits(width, { rocket }), `${width} rocket ${rocket}`).toBe(true);
      }
    }
  });

  it("measures the tightest full case as on 14 Oct: 375pt with the rocket is 234.1 of 246.2", () => {
    expect(clusterWidth({ rocket: true })).toBeCloseTo(234.1, 5);
    expect(headerBudget(375)).toBeCloseTo(246.2, 5);
  });

  it("would not fit 'Requests (9+)' as text beside the rocket at 375pt, which is why counts are badges", () => {
    const asText = clusterWidth({ rocket: true }) - 59.3 + 89.0;
    expect(asText).toBeGreaterThan(headerBudget(375));
  });

  it("does not fit the text links on a 320pt phone, so it goes compact there, with the rocket and without", () => {
    for (const rocket of [false, true]) {
      expect(headerFits(320, { rocket }), `rocket ${rocket}`).toBe(false);
      expect(deckHeaderCompact(320, { rocket, fontScale: 1 }), `rocket ${rocket}`).toBe(true);
      expect(headerFits(320, { rocket, compact: true }), `rocket ${rocket}`).toBe(true);
    }
    // Icons for Requests and Filters, 16pt like the rocket, the same 12pt apart.
    expect(clusterWidth({ rocket: true, compact: true })).toBeCloseTo(168, 5);
    expect(clusterWidth({ rocket: false, compact: true })).toBeCloseTo(140, 5);
  });

  it("goes compact on a 375pt phone with the rocket from the second larger text size, and not before", () => {
    expect(deckHeaderCompact(375, { rocket: true, fontScale: 1.118 })).toBe(false);
    expect(deckHeaderCompact(375, { rocket: true, fontScale: 1.235 })).toBe(true);
    expect(deckHeaderCompact(375, { rocket: false, fontScale: 3.571 })).toBe(false);
    expect(deckHeaderCompact(393, { rocket: true, fontScale: 3.571 })).toBe(false);
  });

  it("fits at every width and every text size, in the layout it picks", () => {
    for (const width of ALL_WIDTHS) {
      for (const fontScale of FONT_SCALES) {
        for (const rocket of [false, true]) {
          const compact = deckHeaderCompact(width, { rocket, fontScale });
          expect(headerFits(width, { rocket, fontScale, compact }), `${width} x${fontScale} rocket ${rocket}`).toBe(true);
        }
      }
    }
  });

  it("grows the title with the text size only up to its cap, and never the links", () => {
    expect(headerBudget(375, 1.118)).toBeCloseTo(375 - 48 - 68.8 * 1.118 - 12, 5);
    expect(headerBudget(375, 3.571)).toBeCloseTo(375 - 48 - 68.8 * DECK_TITLE_MAX_FONT_SCALE - 12, 5);
    expect(headerBudget(375, 0.823)).toBeCloseTo(375 - 48 - 68.8 * 0.823 - 12, 5);
  });
});

describe("the Queue up pill", () => {
  const room = QUEUE_UP_PILL.width - 2 * QUEUE_UP_PILL.paddingX - 2 * QUEUE_UP_PILL.border;

  it("is the 84pt the header budgets", () => {
    expect(QUEUE_PILL_W).toBe(QUEUE_UP_PILL.width);
    expect(room).toBe(70);
  });

  it("fits 'Queue up' with its icon", () => {
    expect(pillContentWidth(queueUpButtonLabel({ kind: "idle" }), true)).toBeLessThanOrEqual(room);
  });

  it("fits every queued label from 1 to 60 minutes", () => {
    for (let m = 1; m <= 60; m++) {
      const label = queueUpButtonLabel({ kind: "queued", minutesLeft: m, untilMs: 0 });
      expect(pillContentWidth(label, false), label).toBeLessThanOrEqual(room);
    }
  });
});
