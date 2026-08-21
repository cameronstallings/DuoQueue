/**
 * The deck queue's decisions, extracted from `useDeck` so they can be tested without React.
 *
 * Both functions here are pure and generic over anything with a `profile_id`, because neither
 * decision cares about the rest of a card. That is also what makes the tests readable: a case
 * about deduplication should not have to build a full `DeckCard` with photos and playstyles to
 * say what it is about.
 *
 * What is left in the hook after this is the wiring — a query, a piece of state and an effect
 * that calls `shouldRefill` — which is short enough to be read rather than tested.
 */

export interface DeckMergeResult<T> {
  /**
   * The queue to render.
   *
   * REFERENCE EQUAL to `prev` when the page added nobody. That is deliberate: `useDeck` feeds
   * this straight into `setQueue`, and returning a fresh array that happens to hold the same
   * cards would re-render the deck to say nothing changed, and would re-fire the refill effect
   * that depends on the queue.
   */
  queue: T[];
  /**
   * True when the page contained nobody the queue did not already have.
   *
   * This is the ONLY signal that the deck is genuinely finished. `get_deck` takes a limit and
   * nothing else: no cursor, no offset, no total. It returns the top N candidates the viewer has
   * not swiped, so asking again always returns something as long as anybody is left. A page that
   * adds nobody new is therefore the same statement as "there is nobody left", and it is the
   * only one available.
   */
  exhausted: boolean;
}

/**
 * Appends a freshly fetched page to the queue, keeping only cards the queue does not already
 * hold.
 *
 * The deduplication is the mechanism rather than a precaution. Because `get_deck` excludes only
 * what the viewer has SWIPED, a refill fired while cards are still queued returns those same
 * cards again, plus whatever now ranks below them. Filtering on `profile_id` is what turns
 * "fetch the top twenty again" into "append the ones I do not have".
 *
 * The single pass also dedupes the page against itself. `get_deck` selects distinct profiles so
 * that should not happen, but a merge that quietly doubles a card if it ever did is a worse
 * failure than the one line it costs to rule out.
 */
export function mergeDeckPage<T extends { profile_id: string }>(
  prev: readonly T[],
  page: readonly T[],
): DeckMergeResult<T> {
  const seen = new Set(prev.map((card) => card.profile_id));
  const added: T[] = [];

  for (const card of page) {
    if (seen.has(card.profile_id)) continue;
    seen.add(card.profile_id);
    added.push(card);
  }

  if (added.length === 0) return { queue: prev as T[], exhausted: true };
  return { queue: [...prev, ...added], exhausted: false };
}

export interface RefillGate {
  /** How many cards are left in the local queue. */
  queueLength: number;
  /** Refill at or below this many cards. */
  refillAt: number;
  /** The first page is still in flight; there is nothing to top up yet. */
  isLoading: boolean;
  /**
   * The first page failed. Without this, an empty queue and `isLoading: false` is indistinguishable
   * from a drained deck, and the refill spends a request on the same failure the query just hit.
   * Recovery belongs to the query's own retry and to the empty state's refresh button.
   */
  hasError: boolean;
  /** A previous refill came back with nobody new. */
  exhausted: boolean;
  /**
   * A refill is already out. The effect that calls this re-runs on every change to the queue
   * length, and a swipe changes it while a request is in flight, so without this one drain sends
   * several identical requests at `get_deck`'s 40-per-minute rate limit.
   */
  refilling: boolean;
}

/**
 * Whether to fetch another page.
 *
 * Note it does NOT require the queue to be non-empty. A first page shorter than `refillAt` should
 * still ask once, and that request is what discovers there is nobody else and sets `exhausted` so
 * it never asks again.
 */
export function shouldRefill(gate: RefillGate): boolean {
  if (gate.isLoading) return false;
  if (gate.hasError) return false;
  if (gate.exhausted) return false;
  if (gate.refilling) return false;
  return gate.queueLength <= gate.refillAt;
}
