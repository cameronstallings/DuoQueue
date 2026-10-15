import { describe, expect, it } from "vitest";

import {
  STACK_DEPTH,
  STACK_SCALE_STEP,
  STACK_Y_STEP,
  initialSlotDepth,
  initialSlotOpacity,
  slotTransform,
} from "./deckStack";

describe("the stack constants", () => {
  it("draws three cards, each 4% smaller and 12pt lower than the one above", () => {
    expect(STACK_DEPTH).toBe(3);
    expect(STACK_SCALE_STEP).toBe(0.04);
    expect(STACK_Y_STEP).toBe(12);
  });
});

describe("slotTransform", () => {
  it("places each depth as the static stack always did", () => {
    expect(slotTransform(0)).toEqual({ scale: 1, translateY: 0 });
    expect(slotTransform(1).scale).toBeCloseTo(0.96, 10);
    expect(slotTransform(1).translateY).toBe(12);
    expect(slotTransform(2).scale).toBeCloseTo(0.92, 10);
    expect(slotTransform(2).translateY).toBe(24);
    expect(slotTransform(3).scale).toBeCloseTo(0.88, 10);
    expect(slotTransform(3).translateY).toBe(36);
  });

  it("follows a spring between depths", () => {
    expect(slotTransform(0.5).scale).toBeCloseTo(0.98, 10);
    expect(slotTransform(0.5).translateY).toBe(6);
  });

  it("never grows the top card past full size when the rise overshoots", () => {
    expect(slotTransform(-0.03)).toEqual({ scale: 1, translateY: 0 });
  });
});

describe("initialSlotDepth and initialSlotOpacity", () => {
  it("puts every card in its place, visible, on the deck's first render", () => {
    for (const index of [0, 1, 2]) {
      const slot = { index, deckMounted: false, restored: false };
      expect(initialSlotDepth(slot)).toBe(index);
      expect(initialSlotOpacity(slot)).toBe(1);
    }
  });

  it("starts a card that joins the stack later one step behind it, hidden, so it rises and fades up", () => {
    const slot = { index: 2, deckMounted: true, restored: false };
    expect(initialSlotDepth(slot)).toBe(STACK_DEPTH);
    expect(initialSlotOpacity(slot)).toBe(0);
  });

  it("puts a restored card straight back in its place, visible (it slides in from the side it left)", () => {
    const slot = { index: 0, deckMounted: true, restored: true };
    expect(initialSlotDepth(slot)).toBe(0);
    expect(initialSlotOpacity(slot)).toBe(1);
  });
});
