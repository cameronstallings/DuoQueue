import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MATCHES_QUERY_KEY } from "@/features/chat/useMatches";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

import type { DuoPopAnswer, DuoPopCard } from "./types";
import { isMissingFunction, QUEUE_UP_QUERY_KEY } from "./useQueueUp";

/**
 * The recipient's side of a Duo Pop: read the card (get_duo_pop) and answer it (answer_duo_pop).
 *
 * get_duo_pop returns zero rows whenever this player may not see the pop (not one of its
 * recipients, blocked either way, a report, the sender gone), and 0085 may not be live at all
 * (PGRST202): both are null here, which the Pop card draws as "This Duo Pop isn't available
 * anymore". Any other failure is an error the card offers to retry.
 */

export function duoPopQueryKey(popId: string | null | undefined) {
  return ["duo-pop", popId] as const;
}

export function useDuoPop(popId: string | null) {
  return useQuery({
    queryKey: duoPopQueryKey(popId),
    queryFn: async (): Promise<DuoPopCard | null> => {
      const { data, error } = await supabase.rpc("get_duo_pop", { p_pop_id: popId });
      if (error) {
        if (isMissingFunction(error)) return null;
        throw error;
      }
      return ((data ?? []) as DuoPopCard[])[0] ?? null;
    },
    enabled: !!popId,
    staleTime: 0,
    retry: 1,
  });
}

/**
 * I'm in (`accept: true`) or Not now. Every outcome is a row (locked, declined, taken, expired,
 * ended, already_matched, unavailable); only a missing session, a ban, the rate limit or the
 * network throw. A lock is a new match, so Matches and the deck are refreshed behind the moment.
 */
export function useAnswerDuoPop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ popId, accept }: { popId: string; accept: boolean }): Promise<DuoPopAnswer> => {
      const { data, error } = await supabase.rpc("answer_duo_pop", { p_pop_id: popId, p_accept: accept });
      if (error) throw error;
      const row = ((data ?? []) as DuoPopAnswer[])[0];
      if (!row) throw new Error("answer_duo_pop returned no row");
      return row;
    },
    onSuccess: (answer) => {
      void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["deck"] });
      // ONE DUO PER QUEUE UP (0088): a player who was queued themselves and locks someone else's
      // pop has found their duo, so the server ends their own queue-up and takes them out of
      // Online Now. Their pill (the profile) and their sheet (the queue status) re-read it.
      if (answer.result === "locked") {
        void queryClient.invalidateQueries({ queryKey: QUEUE_UP_QUERY_KEY });
        void useSessionStore.getState().refreshProfile();
      }
    },
  });
}
