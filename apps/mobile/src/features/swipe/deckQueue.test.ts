import { describe, expect, it } from "vitest";

import { mergeDeckPage, shouldRefill, type RefillGate } from "./deckQueue";

/** The merge only reads `profile_id`, so a case about deduplication does not need a real card. */
const card = (profile_id: string) => ({ profile_id });
const ids = <T extends { profile_id: string }>(cards: readonly T[]) => cards.map((c) => c.profile_id);

describe("mergeDeckPage", () => {
  it("appends every card when the queue is empty", () => {
    const result = mergeDeckPage([], [card("a"), card("b"), card("c")]);
    expect(ids(result.queue)).toEqual(["a", "b", "c"]);
    expect(result.exhausted).toBe(false);
  });

  it("appends only the cards the queue does not already hold", () => {
    // The real get_deck shape: it excludes what you SWIPED, not what is still queued, so a
    // refill fired at REFILL_AT returns the cards still in hand plus the ones behind them.
    const queue = [card("d"), card("e")];
    const page = [card("d"), card("e"), card("f"), card("g")];

    const result = mergeDeckPage(queue, page);

    expect(ids(result.queue)).toEqual(["d", "e", "f", "g"]);
    expect(result.exhausted).toBe(false);
  });

  it("preserves queue order and appends new cards after it", () => {
    const result = mergeDeckPage([card("a"), card("b")], [card("z"), card("b")]);
    expect(ids(result.queue)).toEqual(["a", "b", "z"]);
  });

  it("reports exhausted when the page adds nobody new", () => {
    const queue = [card("a"), card("b")];
    const result = mergeDeckPage(queue, [card("a"), card("b")]);

    expect(result.exhausted).toBe(true);
    // Reference equality matters: useDeck feeds this into setQueue, and a fresh array holding the
    // same cards would re-render the deck and re-fire the refill effect to say nothing changed.
    expect(result.queue).toBe(queue);
  });

  it("reports exhausted on an empty page", () => {
    const queue = [card("a")];
    const result = mergeDeckPage(queue, []);
    expect(result.exhausted).toBe(true);
    expect(result.queue).toBe(queue);
  });

  it("reports exhausted when both the queue and the page are empty", () => {
    // The drained-and-finished case: the deck is empty, the refill asks once more, nobody is
    // there. The screen's empty state is only honest because this sets exhausted.
    const result = mergeDeckPage([], []);
    expect(result.exhausted).toBe(true);
    expect(result.queue).toEqual([]);
  });

  it("dedupes a page against itself", () => {
    const result = mergeDeckPage([], [card("a"), card("a"), card("b")]);
    expect(ids(result.queue)).toEqual(["a", "b"]);
    expect(result.exhausted).toBe(false);
  });

  it("does not mutate the queue it was given", () => {
    const queue = [card("a")];
    const before = [...queue];
    mergeDeckPage(queue, [card("b")]);
    expect(queue).toEqual(before);
  });
});

describe("shouldRefill", () => {
  const gate = (over: Partial<RefillGate> = {}): RefillGate => ({
    queueLength: 20,
    refillAt: 5,
    isLoading: false,
    hasError: false,
    exhausted: false,
    refilling: false,
    ...over,
  });

  it("does not refill while the queue is comfortably stocked", () => {
    expect(shouldRefill(gate({ queueLength: 20 }))).toBe(false);
    expect(shouldRefill(gate({ queueLength: 6 }))).toBe(false);
  });

  it("refills at the threshold, not only once the deck is empty", () => {
    // Refilling at zero is the bug this replaced: the queue emptied, the screen fell through to
    // "nobody left", and a manual refresh was the only way back.
    expect(shouldRefill(gate({ queueLength: 5 }))).toBe(true);
    expect(shouldRefill(gate({ queueLength: 1 }))).toBe(true);
  });

  it("refills on an empty queue so a short first page still asks once", () => {
    expect(shouldRefill(gate({ queueLength: 0 }))).toBe(true);
  });

  it("does not refill while the first page is still loading", () => {
    expect(shouldRefill(gate({ queueLength: 0, isLoading: true }))).toBe(false);
  });

  it("does not refill when the first page errored", () => {
    // An errored query leaves queueLength 0 with isLoading false, which is indistinguishable from
    // a drained deck. Refilling there spends a request on the failure the query just hit.
    expect(shouldRefill(gate({ queueLength: 0, hasError: true }))).toBe(false);
  });

  it("does not refill once exhausted", () => {
    expect(shouldRefill(gate({ queueLength: 0, exhausted: true }))).toBe(false);
  });

  it("does not refill while a refill is already in flight", () => {
    // The effect re-runs on every queue-length change, and swiping changes it while the request
    // is out. Without this guard one drain fires several identical requests into get_deck's
    // 40-per-minute rate limit.
    expect(shouldRefill(gate({ queueLength: 3, refilling: true }))).toBe(false);
  });
});

describe("a full drain, as the deck actually plays out", () => {
  it("tops up mid-deck, then stops asking once nobody new comes back", () => {
    // Twenty five candidates, a page size of twenty, refilling at five.
    const everyone = Array.from({ length: 25 }, (_, i) => card(`p${i}`));
    const pageFor = (swiped: Set<string>) => everyone.filter((c) => !swiped.has(c.profile_id)).slice(0, 20);

    const swiped = new Set<string>();
    let queue = mergeDeckPage([], pageFor(swiped)).queue;
    expect(queue).toHaveLength(20);

    const swipe = (n: number) => {
      for (let i = 0; i < n; i++) {
        swiped.add(queue[0]!.profile_id);
        queue = queue.slice(1);
      }
    };

    swipe(15);
    expect(queue).toHaveLength(5);
    expect(shouldRefill({ queueLength: queue.length, refillAt: 5, isLoading: false, hasError: false, exhausted: false, refilling: false })).toBe(true);

    // The refill returns the five still in hand plus the five that were behind the page limit.
    const first = mergeDeckPage(queue, pageFor(swiped));
    expect(first.exhausted).toBe(false);
    queue = first.queue;
    expect(queue).toHaveLength(10);

    swipe(5);
    expect(queue).toHaveLength(5);

    // Everyone left is already in hand, so this page adds nobody and the deck is finished.
    const second = mergeDeckPage(queue, pageFor(swiped));
    expect(second.exhausted).toBe(true);
    queue = second.queue;

    swipe(5);
    expect(queue).toHaveLength(0);
    // And with exhausted set, the empty state the user now sees is telling the truth.
    expect(shouldRefill({ queueLength: 0, refillAt: 5, isLoading: false, hasError: false, exhausted: true, refilling: false })).toBe(false);
  });
});
