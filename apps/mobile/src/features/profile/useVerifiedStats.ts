import { useQuery } from "@tanstack/react-query";
import type { VerifiedStatKind } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

/** Formats a raw `verified_stats.stat_value` for display. Rank values already arrive as
 * human text ("Gold II") from sync-verified-stats; playtime arrives as a plain decimal
 * hour count ("214.0") that still needs comma grouping and a unit suffix. */
function formatStatValue(statKind: VerifiedStatKind, value: string): string {
  if (statKind !== "playtime_hours") return value;
  const hours = Number(value);
  if (!Number.isFinite(hours)) return value;
  const rounded = Math.round(hours);
  return `${rounded.toLocaleString()}h`;
}

/** Verified rank/playtime for a profile's games, keyed by game name — the same key
 * GamesSection already uses for its chips, from `public_verified_stats`
 * (0039_verified_stats.sql). Returns `{}` for every profile until sync-verified-stats
 * has actually run and found a matching linked account, which is the normal, expected
 * state while STEAM_WEB_API_KEY / RIOT_API_KEY remain unset — the query never errors on
 * an empty result, it just means "nothing verified yet," identical to today's UI. */
export function useVerifiedStats(profileId: string | undefined) {
  return useQuery({
    queryKey: ["verified-stats", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_verified_stats")
        .select("game_name, stat_kind, stat_value")
        .eq("profile_id", profileId);
      if (error) throw error;

      const byName: Record<string, string> = {};
      for (const row of data ?? []) {
        const gameName = row.game_name as string | null;
        if (!gameName) continue;
        byName[gameName] = formatStatValue(row.stat_kind as VerifiedStatKind, row.stat_value as string);
      }
      return byName;
    },
    enabled: !!profileId,
  });
}
