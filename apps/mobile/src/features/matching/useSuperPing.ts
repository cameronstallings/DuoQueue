import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SwipeResult } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

export class SuperPingRequiresPremiumError extends Error {
  constructor() {
    super("Super Ping is a DuoQueue+ feature.");
    this.name = "SuperPingRequiresPremiumError";
  }
}

export class SuperPingLimitReachedError extends Error {
  constructor() {
    super("You've used your Super Ping for today — come back tomorrow.");
    this.name = "SuperPingLimitReachedError";
  }
}

export function useSuperPing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetId: string) => {
      const { data, error } = await supabase.rpc("send_super_ping", { p_target_id: targetId });
      if (error) {
        if (error.message.includes("super_ping_requires_premium")) throw new SuperPingRequiresPremiumError();
        if (error.message.includes("super_ping_limit_reached")) throw new SuperPingLimitReachedError();
        throw error;
      }
      const [result] = (data ?? []) as SwipeResult[];
      return result ?? { matched: false, match_id: null };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["swipe-quota"] });
    },
  });
}
