import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConsumableCredits, SwipeResult } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

export const CONSUMABLE_CREDITS_QUERY_KEY = ["consumable-credits"] as const;

export function useConsumableCredits() {
  return useQuery({
    queryKey: CONSUMABLE_CREDITS_QUERY_KEY,
    queryFn: async (): Promise<ConsumableCredits> => {
      const { data, error } = await supabase.rpc("get_consumable_credits");
      if (error) throw error;
      const [result] = (data ?? []) as ConsumableCredits[];
      return result ?? { boosts: 0, roses: 0 };
    },
  });
}

export class NoBoostCreditsError extends Error {
  constructor() {
    super("You're out of Power-Ups.");
    this.name = "NoBoostCreditsError";
  }
}

export class NoRoseCreditsError extends Error {
  constructor() {
    super("You're out of Legendary Likes.");
    this.name = "NoRoseCreditsError";
  }
}

export function useActivateBoost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("activate_boost");
      if (error) {
        if (error.message.includes("no_boost_credits")) throw new NoBoostCreditsError();
        throw error;
      }
      const [result] = (data ?? []) as { expires_at: string }[];
      if (!result) throw new Error("Power-Up activation failed.");
      return result.expires_at;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONSUMABLE_CREDITS_QUERY_KEY });
    },
  });
}

export function useSendRose() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetId: string): Promise<SwipeResult> => {
      const { data, error } = await supabase.rpc("send_rose", { p_target_id: targetId });
      if (error) {
        if (error.message.includes("no_rose_credits")) throw new NoRoseCreditsError();
        throw error;
      }
      const [result] = (data ?? []) as SwipeResult[];
      return result ?? { matched: false, match_id: null };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONSUMABLE_CREDITS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["swipe-quota"] });
    },
  });
}
