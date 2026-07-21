import { useQuery } from "@tanstack/react-query";
import type { SwipeQuota } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

export function useSwipeQuota() {
  return useQuery({
    queryKey: ["swipe-quota"],
    queryFn: async (): Promise<SwipeQuota> => {
      const { data, error } = await supabase.rpc("get_swipe_quota");
      if (error) throw error;
      const [result] = (data ?? []) as SwipeQuota[];
      return result ?? { swipes_used: 0, swipes_limit: 25, is_premium: false };
    },
  });
}
