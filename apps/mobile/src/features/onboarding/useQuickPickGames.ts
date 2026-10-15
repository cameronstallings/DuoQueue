import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

import { orderQuickPicks, QUICK_PICK_GAMES } from "./catalogSearch";
import type { CatalogItem } from "./customGames";

/**
 * The games step's one-tap picks (League of Legends first), read from the catalog so each chip is
 * the real row with its real id. The games table is readable signed out (`games_select_all`), so
 * this works before the account exists.
 *
 * Catalog rows only (`is_custom = false`): a player-made game that happens to share a name must
 * never stand in for the real one. `orderQuickPicks` keeps QUICK_PICK_GAMES order and drops
 * anything else. The list never changes within a launch, hence `staleTime: Infinity`.
 *
 * On an error the step simply shows no quick picks; search still works.
 */
export function useQuickPickGames() {
  return useQuery({
    queryKey: ["games", "quick-picks"],
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase
        .from("games")
        .select("id, name")
        .in("name", [...QUICK_PICK_GAMES])
        .eq("is_custom", false);
      if (error) throw error;
      return orderQuickPicks((data ?? []) as CatalogItem[]);
    },
    staleTime: Infinity,
  });
}
