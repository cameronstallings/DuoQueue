import { describe, expect, it } from "vitest";

import { clusterWidth, headerBudget, headerFits, QUEUE_PILL_W } from "./deckHeaderFit";
import { pillContentWidth, QUEUE_UP_PILL, queueUpButtonLabel } from "./queueState";

/** iPhone widths in points: SE/mini, 15/16, 16 Pro/17, Plus/Max (older), Pro Max. */
const WIDTHS = [375, 393, 402, 414, 430];

describe("the deck header", () => {
  it("fits every current iPhone width, with the Power-Up rocket and without", () => {
    for (const width of WIDTHS) {
      expect(headerFits(width, { rocket: false }), `${width} without`).toBe(true);
      expect(headerFits(width, { rocket: true }), `${width} with the rocket`).toBe(true);
    }
  });

  it("measures the tightest case as on 14 Oct: 375pt with the rocket is 234.1 of 246.2", () => {
    expect(clusterWidth({ rocket: true })).toBeCloseTo(234.1, 5);
    expect(headerBudget(375)).toBeCloseTo(246.2, 5);
  });

  it("would not fit 'Requests (9+)' as text beside the rocket at 375pt, which is why counts are badges", () => {
    const asText = clusterWidth({ rocket: true }) - 59.3 + 89.0;
    expect(asText).toBeGreaterThan(headerBudget(375));
  });

  it("does not fit a phone narrower than any it ships on", () => {
    expect(headerFits(320, { rocket: true })).toBe(false);
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
