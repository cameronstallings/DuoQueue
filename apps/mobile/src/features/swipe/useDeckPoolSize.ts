import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export const DECK_POOL_SIZE_QUERY_KEY = ["deck-pool-size"] as const;

/**
 * How many people the signed-in user could see with every preference filter removed.
 *
 * This is the question an empty deck cannot answer on its own. `get_deck` returns nothing
 * whether the pool is genuinely empty or whether the viewer's own region/language/age filters
 * removed everyone from it, and those two facts want opposite screens. `get_deck_pool_size`
 * (0062) applies only the hard gates, so a non-zero answer on an empty deck means the filters
 * did it, and zero means there really is nobody left.
 *
 * `enabled` is what keeps this off the hot path: the deck screen passes true only once the
 * deck has settled at zero cards, so a user who is swiping never pays for it. That also keeps
 * the RPC comfortably inside its 20-per-minute rate limit, which is deliberately half
 * `get_deck`'s.
 *
 * 30 seconds of staleness because the only things that move this number are a new signup and
 * the viewer's own filters, and the second of those invalidates the key directly from
 * `usePreferences.save`.
 */
export function useDeckPoolSize(enabled: boolean) {
  return useQuery({
    queryKey: DECK_POOL_SIZE_QUERY_KEY,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_deck_pool_size");
      if (error) throw error;
      return (data ?? 0) as number;
    },
    enabled,
    staleTime: 30_000,
  });
}
