import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeckCandidate, PartySwipeResult } from "@duoqueue/shared-types";

import { enrichCandidates } from "@/features/swipe/enrichCandidates";
import type { DeckCard, SwipeDirection } from "@/features/swipe/types";
import { supabase } from "@/lib/supabase";

const PARTY_DECK_PAGE_SIZE = 20;

async function fetchPartyDeckCards(partyId: string): Promise<DeckCard[]> {
  const { data, error } = await supabase.rpc("get_party_deck", { p_party_id: partyId, p_limit: PARTY_DECK_PAGE_SIZE });
  if (error) throw error;
  return enrichCandidates((data ?? []) as DeckCandidate[]);
}

export function usePartyDeck(partyId: string | undefined) {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<DeckCard[]>([]);

  const query = useQuery({
    queryKey: ["party-deck", partyId],
    queryFn: () => fetchPartyDeckCards(partyId!),
    enabled: !!partyId,
    staleTime: 0,
  });

  const popTop = useCallback(() => setQueue((prev) => prev.slice(1)), []);

  const [syncedData, setSyncedData] = useState<DeckCard[] | null>(null);
  if (query.data && query.data !== syncedData) {
    setSyncedData(query.data);
    setQueue(query.data);
  }

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["party-deck", partyId] });
  }, [queryClient, partyId]);

  return { cards: queue, isLoading: query.isLoading, error: query.error, popTop, refetch };
}

export function usePartySwipeAction(partyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetId, direction }: { targetId: string; direction: SwipeDirection }) => {
      if (!partyId) throw new Error("No party loaded.");
      const { data, error } = await supabase.rpc("perform_party_swipe", {
        p_party_id: partyId,
        p_target_id: targetId,
        p_action: direction === "like" ? "like" : "pass",
      });
      if (error) throw error;
      const [result] = (data ?? []) as PartySwipeResult[];
      return result ?? { invited: false };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["party-invites"] });
    },
  });
}
