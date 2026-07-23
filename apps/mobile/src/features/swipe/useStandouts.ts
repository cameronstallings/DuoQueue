import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeckCandidate } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

import { enrichCandidates } from "./enrichCandidates";
import type { DeckCard } from "./types";

const STANDOUTS_LIMIT = 8;

async function fetchStandoutCards(): Promise<DeckCard[]> {
  const { data: candidates, error } = await supabase.rpc("get_standouts", {
    p_limit: STANDOUTS_LIMIT,
  });
  if (error) throw error;
  return enrichCandidates((candidates ?? []) as DeckCandidate[]);
}

export function useStandouts() {
  const queryClient = useQueryClient();
  const [cards, setCards] = useState<DeckCard[]>([]);

  const query = useQuery({
    queryKey: ["standouts"],
    queryFn: fetchStandoutCards,
    staleTime: 1000 * 60 * 60,
  });

  const [syncedData, setSyncedData] = useState<DeckCard[] | null>(null);
  if (query.data && query.data !== syncedData) {
    setSyncedData(query.data);
    setCards(query.data);
  }

  const removeCard = useCallback((profileId: string) => {
    setCards((prev) => prev.filter((c) => c.profile_id !== profileId));
  }, []);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["standouts"] });
  }, [queryClient]);

  return {
    cards,
    isLoading: query.isLoading,
    error: query.error,
    removeCard,
    refetch,
  };
}
