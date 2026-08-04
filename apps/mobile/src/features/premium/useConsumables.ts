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
      return result ?? { boosts: 0, roses: 0, free_rose_available: true, free_rose_available_at: null };
    },
  });
}

export class NoBoostCreditsError extends Error {
  constructor() {
    super("You're out of Power-Ups.");
    this.name = "NoBoostCreditsError";
  }
}

export class RoseOnCooldownError extends Error {
  constructor() {
    super("Your free Legendary Like is on cooldown, and you're out of extra credits.");
    this.name = "RoseOnCooldownError";
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

export interface SendRoseResult extends SwipeResult {
  usedFreeRose: boolean;
}

export function useSendRose() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetId: string): Promise<SendRoseResult> => {
      const { data, error } = await supabase.rpc("send_rose", { p_target_id: targetId });
      if (error) {
        if (error.message.includes("rose_on_cooldown")) throw new RoseOnCooldownError();
        throw error;
      }
      const [result] = (data ?? []) as (SwipeResult & { used_free_rose: boolean })[];
      return result
        ? { matched: result.matched, match_id: result.match_id, usedFreeRose: result.used_free_rose }
        : { matched: false, match_id: null, usedFreeRose: false };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONSUMABLE_CREDITS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["swipe-quota"] });
      // A rose can match/remove someone from the admirers list.
      void queryClient.invalidateQueries({ queryKey: ["admirers"] });
      void queryClient.invalidateQueries({ queryKey: ["admirers-count"] });
    },
  });
}
