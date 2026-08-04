import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SwipeResult } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

import type { SwipeDirection } from "./types";

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

export function useSwipeAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetId, direction }: { targetId: string; direction: SwipeDirection }) =>
      performSwipe(targetId, direction),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["swipe-quota"] });
      // A like-back here can match/remove someone from the admirers list.
      void queryClient.invalidateQueries({ queryKey: ["admirers"] });
      void queryClient.invalidateQueries({ queryKey: ["admirers-count"] });
    },
  });
}
