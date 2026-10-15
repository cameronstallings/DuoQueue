import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SwipeQuota, SwipeResult } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

import { optimisticQuota } from "./deckStripCopy";
import type { SwipeDirection } from "./types";
import { SWIPE_QUOTA_QUERY_KEY } from "./useSwipeQuota";

export class SwipeLimitReachedError extends Error {
  constructor() {
    super("Daily swipe limit reached");
    this.name = "SwipeLimitReachedError";
  }
}

async function performSwipe(targetId: string, direction: SwipeDirection): Promise<SwipeResult> {
  const { data, error } = await supabase.rpc("perform_swipe", {
    p_target_id: targetId,
    p_action: direction === "like" ? "like" : "pass",
  });
  if (error) {
    if (error.message.includes("daily_swipe_limit_reached")) {
      throw new SwipeLimitReachedError();
    }
    throw error;
  }
  const [result] = (data ?? []) as SwipeResult[];
  return result ?? { matched: false, match_id: null };
}

/**
 * `optimisticQuota: true` (only the Deck passes it) counts the swipe on the cached quota the
 * moment it starts, so the strip's "swipes left" and the deck's limit check (canCommitSwipe) move
 * with the card instead of a round trip later; a failure puts the previous quota back and refetches
 * it, because with several swipes in flight the snapshot can be one behind. Highlights, Requests
 * and the party deck leave it off and keep counting after the server answers, as before.
 */
export function useSwipeAction(options?: { optimisticQuota?: boolean }) {
  const queryClient = useQueryClient();
  const optimistic = options?.optimisticQuota === true;

  return useMutation({
    mutationFn: ({ targetId, direction }: { targetId: string; direction: SwipeDirection }) =>
      performSwipe(targetId, direction),
    onMutate: async (): Promise<{ previousQuota: SwipeQuota | undefined } | undefined> => {
      if (!optimistic) return undefined;
      // A quota fetch already in flight would land after this and wipe the count back out.
      await queryClient.cancelQueries({ queryKey: SWIPE_QUOTA_QUERY_KEY });
      const previousQuota = queryClient.getQueryData<SwipeQuota>(SWIPE_QUOTA_QUERY_KEY);
      const next = optimisticQuota(previousQuota);
      if (next && next !== previousQuota) queryClient.setQueryData(SWIPE_QUOTA_QUERY_KEY, next);
      return { previousQuota };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      if (context.previousQuota) queryClient.setQueryData(SWIPE_QUOTA_QUERY_KEY, context.previousQuota);
      void queryClient.invalidateQueries({ queryKey: SWIPE_QUOTA_QUERY_KEY });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SWIPE_QUOTA_QUERY_KEY });
      // A duo-back here can match/remove someone from the requests list…
      void queryClient.invalidateQueries({ queryKey: ["admirers"] });
      void queryClient.invalidateQueries({ queryKey: ["admirers-count"] });
      // …and from Highlights, which is a separate query and stayed stale otherwise.
      void queryClient.invalidateQueries({ queryKey: ["standouts"] });
    },
  });
}
