import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeckCandidate } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

import { mergeDeckPage, shouldRefill } from "./deckQueue";
import { enrichCandidates } from "./enrichCandidates";
import type { DeckCard } from "./types";

const DECK_PAGE_SIZE = 20;

/** Refill once the local queue is this short, rather than waiting for it to empty.
 *
 * Emptying first is what made the deck look finished when it was not: the queue ran dry, the
 * screen fell through to its "nobody left" empty state, and the only way back was the manual
 * refresh button on it. With four demo profiles that never happened. At twenty five it happens
 * on the first sitting, and it tells a new user the app is empty on the day the waitlist lands.
 *
 * Five is chosen against the render stack, not by feel: SwipeDeck renders STACK_DEPTH cards, so
 * a refill that starts at five still has visible cards under the top one while the request is in
 * flight, and the swap never happens under the user's thumb. */
const REFILL_AT = 5;

async function fetchDeckPage(): Promise<DeckCard[]> {
  const { data: candidates, error: deckError } = await supabase.rpc("get_deck", {
    p_limit: DECK_PAGE_SIZE,
  });
  if (deckError) throw deckError;
  return enrichCandidates((candidates ?? []) as DeckCandidate[]);
}

export function useDeck() {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<DeckCard[]>([]);

  const query = useQuery({
    queryKey: ["deck"],
    queryFn: fetchDeckPage,
    staleTime: 0,
  });

  /** In flight guard. The refill trigger below fires on every change to queue.length, and a
   * swipe changes it while a request is already out, so without this a single drain sends
   * several identical requests at get_deck's 40-per-minute rate limit. */
  const refillingRef = useRef(false);

  /** Set once a refill comes back with nobody new in it, which is the only honest signal that
   * the deck is genuinely finished. get_deck has no cursor and no total, so "there is no more"
   * cannot be known any other way.
   *
   * A ref and not state on purpose: nothing renders from it (the screen's empty state already
   * keys off cards.length, and with refills in place that only reaches zero when this is true),
   * so making it state would re-render the deck to record a fact the deck does not display. */
  const exhaustedRef = useRef(false);

  /** Appends the next page to the local queue.
   *
   * This deliberately calls the RPC directly instead of going through react-query. The ["deck"]
   * cache is the HARD REFRESH path: the render-time sync below replaces the whole queue whenever
   * that query returns new data, which is right for a pull to refresh and fatal for a refill,
   * because it would throw away the local ordering and any optimistic popTop that had not yet
   * been reflected server side.
   *
   * The dedup is not defensive, it is the mechanism. get_deck takes only a limit: it returns the
   * top N candidates the viewer has not swiped, ranked by score. So a second call while cards are
   * still in the queue returns THOSE SAME CARDS again, plus whatever now ranks below them. The
   * filter is what turns "fetch the top twenty again" into "append the ones I do not have". */
  const refill = useCallback(async () => {
    if (refillingRef.current || exhaustedRef.current) return;
    refillingRef.current = true;
    try {
      const page = await fetchDeckPage();
      setQueue((prev) => {
        const { queue: next, exhausted } = mergeDeckPage(prev, page);
        // Setting the ref from inside an updater is a side effect in a function that should be
        // pure, and React may invoke this twice in development. It is safe only because the
        // write is idempotent: exhaustion is a latch, and setting it true twice says the same
        // thing once. Nothing else in here may follow that pattern.
        if (exhausted) exhaustedRef.current = true;
        return next;
      });
    } catch {
      // A failed refill must not strand the deck behind a permanent empty state, so it is
      // swallowed and `exhaustedRef` is deliberately left false: the next swipe re-fires the
      // trigger and tries again, and if the network is simply down the query's own error path
      // and the empty state's manual refresh still cover it.
    } finally {
      refillingRef.current = false;
    }
  }, []);

  const popTop = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  // Re-inserts a card at the front of the queue — used to undo an optimistic
  // popTop() when the swipe RPC behind it fails, so the card isn't lost.
  const restoreTop = useCallback((card: DeckCard) => {
    setQueue((prev) => [card, ...prev]);
  }, []);

  // Render-time sync (not an effect) so swipes can pop the local queue optimistically
  // without waiting on a refetch — see the useState docs on storing info from previous
  // renders. Guarded by reference equality so it only re-syncs when react-query hands
  // back a genuinely new page (e.g. after popTop's slice(), query.data no longer equals
  // queue but we don't want to re-sync until the underlying query result itself changes).
  const [syncedData, setSyncedData] = useState<DeckCard[] | null>(null);
  if (query.data && query.data !== syncedData) {
    setSyncedData(query.data);
    setQueue(query.data);
  }

  // The refill trigger. An effect rather than a call inside popTop because a refill is a side
  // effect, and a state updater has to stay pure — React may invoke it twice in development,
  // which would double the request.
  //
  // Not gated on queue.length > 0: a first page that comes back shorter than REFILL_AT should
  // still ask once, and that call is what sets exhaustedRef so it never asks again.
  useEffect(() => {
    const go = shouldRefill({
      queueLength: queue.length,
      refillAt: REFILL_AT,
      isLoading: query.isLoading,
      hasError: query.error != null,
      exhausted: exhaustedRef.current,
      refilling: refillingRef.current,
    });
    if (go) void refill();
  }, [queue.length, query.isLoading, query.error, refill]);

  const refetch = useCallback(async () => {
    // A hard refresh is the one moment "there is nobody left" can stop being true without a
    // swipe: someone may have signed up since, and the low-density notification work is meant to
    // bring users back to this screen for exactly that reason. Clearing the flag here is what
    // lets the refill trigger run again afterwards.
    exhaustedRef.current = false;
    await queryClient.invalidateQueries({ queryKey: ["deck"] });
  }, [queryClient]);

  return {
    cards: queue,
    isLoading: query.isLoading,
    error: query.error,
    popTop,
    restoreTop,
    refetch,
  };
}
