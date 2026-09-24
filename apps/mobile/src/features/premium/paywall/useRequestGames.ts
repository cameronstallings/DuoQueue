import { useQuery } from "@tanstack/react-query";

import { getLeagueGameId } from "@/features/league/leagueGame";
import { supabase } from "@/lib/supabase";

import type { RequestGameRow } from "./paywallCopy";

/**
 * The games of the requests page 2 shows (the free daily three, which a free account can already
 * see), so each row says a rank or a main game instead of an age. The same view the deck reads.
 */
export function useRequestGames(profileIds: readonly string[]) {
  const key = [...profileIds].sort().join(",");
  return useQuery({
    queryKey: ["paywall-request-games", key],
    queryFn: async (): Promise<{ rows: RequestGameRow[]; leagueGameId: string | null }> => {
      const [gamesRes, leagueGameId] = await Promise.all([
        supabase
          .from("public_profile_games")
          .select("profile_id, game_id, game_name, rank_text, priority")
          .in("profile_id", [...profileIds])
          .order("priority"),
        getLeagueGameId(),
      ]);
      if (gamesRes.error) throw gamesRes.error;
      return { rows: (gamesRes.data ?? []) as RequestGameRow[], leagueGameId };
    },
    enabled: profileIds.length > 0,
  });
}
