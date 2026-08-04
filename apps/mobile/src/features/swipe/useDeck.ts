import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeckCandidate } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

import { enrichCandidates } from "./enrichCandidates";
import type { DeckCard } from "./types";

const DECK_PAGE_SIZE = 20;

async function fetchDeckCards(): Promise<DeckCard[]> {
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
    queryFn: fetchDeckCards,
    staleTime: 0,
  });

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

  const refetch = useCallback(async () => {
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
