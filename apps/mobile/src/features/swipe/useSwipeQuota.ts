import { useQuery } from "@tanstack/react-query";
import type { SwipeQuota } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

/**
 * Exported because three call sites invalidate this cache and they used to do it by writing the
 * string out again: the swipe RPC, and both purchase paths. The purchase paths did not, and the
 * gap was invisible precisely because nothing tied them together — a subscriber came back from
 * the paywall to a deck still reading "0 swipes left today" off a stale entry.
 */
export const SWIPE_QUOTA_QUERY_KEY = ["swipe-quota"] as const;

export function useSwipeQuota() {
  return useQuery({
    queryKey: SWIPE_QUOTA_QUERY_KEY,
    queryFn: async (): Promise<SwipeQuota> => {
      const { data, error } = await supabase.rpc("get_swipe_quota");
      if (error) throw error;
      const [result] = (data ?? []) as SwipeQuota[];
      return result ?? { swipes_used: 0, swipes_limit: 25, is_premium: false };
    },
  });
}
