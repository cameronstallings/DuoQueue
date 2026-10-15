/**
 * Where each card in the deck's stack sits. Pure (deckStack.test.ts); the functions SwipeDeck's
 * animated styles call are worklets.
 *
 * The stack is three cards: the top one at full size, each one under it 4% smaller and 12pt
 * lower, so their bottom edges peek out. Up to 1.0.1 those were static styles keyed to the card's
 * index, so when the top card left, the card behind JUMPED to full size in one frame, and the new
 * third card appeared from nowhere. Now each slot has an animated `depth` (0 = top) that springs
 * to the card's new index on SPRINGS.stack (about 360ms, damping ratio 0.74), and the transform is
 * computed from it, so the card behind rises into place and the new back card fades up behind it.
 */

/** How many cards the deck draws. useDeck's refill threshold (REFILL_AT 5) is chosen against it. */
export const STACK_DEPTH = 3;
/** Each step down the stack is this much smaller... */
export const STACK_SCALE_STEP = 0.04;
/** ...and this many points lower. */
export const STACK_Y_STEP = 12;

/**
 * The scale and drop for a (possibly fractional, mid-spring) depth. Depth is floored at 0: the
 * rise overshoots a little below 0, and a top card that grew past full size would poke out of
 * the card area for a frame or two.
 */
export function slotTransform(depth: number): { scale: number; translateY: number } {
  "worklet";
  const d = Math.max(0, depth);
  return { scale: 1 - d * STACK_SCALE_STEP, translateY: d * STACK_Y_STEP };
}

export interface SlotStart {
  /** The card's index in the stack when its slot mounts. */
  index: number;
  /** False on the deck's first render (everything simply appears in place with the deck's fade). */
  deckMounted: boolean;
  /** This card is coming back after a failed swipe; it slides in from the side it left. */
  restored: boolean;
}

/**
 * The depth a slot starts at. In place on the deck's first render (the whole deck fades in
 * together) and for a restored card (its own slide brings it back). Any other card joining a
 * deck that is already on screen starts one step behind the visible stack, so it rises into its
 * place instead of appearing there.
 */
export function initialSlotDepth({ index, deckMounted, restored }: SlotStart): number {
  if (!deckMounted || restored) return index;
  return STACK_DEPTH;
}

/** The opacity a slot starts at: visible where it starts in place, else 0 so it fades up. */
export function initialSlotOpacity({ deckMounted, restored }: SlotStart): number {
  if (!deckMounted || restored) return 1;
  return 0;
}
