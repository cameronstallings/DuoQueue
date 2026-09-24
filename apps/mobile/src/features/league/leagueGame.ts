import { useQuery } from "@tanstack/react-query";
import { LEAGUE_RIOT_QUEUE } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

/**
 * Which catalog row is League of Legends. Found by its Riot queue marker, never by name, the same
 * way the server's `lol_game_id()` finds it (0069_league_rank_duo.sql), so the two always agree.
 *
 * Everything League-specific in the app keys on this id: the rank picker in onboarding and Edit
 * details, and the League rank chip on other people's cards. When it is null (the read failed, or
 * there is no marked row) every one of those surfaces behaves exactly as it did before 0069: a
 * free-text rank field and no League chip.
 */
async function fetchLeagueGameId(): Promise<string | null> {
  const { data, error } = await supabase
    .from("games")
    .select("id")
    .eq("riot_queue", LEAGUE_RIOT_QUEUE)
    .eq("is_custom", false)
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.id as string | undefined) ?? null;
}

/** One read per app session. A failed read clears the memo, so the next caller retries. */
let pending: Promise<string | null> | null = null;

function loadLeagueGameId(): Promise<string | null> {
  if (!pending) {
    const attempt = fetchLeagueGameId();
    pending = attempt;
    attempt.catch(() => {
      if (pending === attempt) pending = null;
    });
  }
  return pending;
}

/** The League game id, or null when it cannot be read. Never throws: every caller falls back to
 * the pre-0069 behaviour on null. */
export async function getLeagueGameId(): Promise<string | null> {
  try {
    return await loadLeagueGameId();
  } catch {
    return null;
  }
}

/** React wrapper over the same memo. Null while loading and after a failure; a failure is
 * retried by react-query rather than cached as "no League". */
export function useLeagueGameId(): string | null {
  const { data } = useQuery({
    queryKey: ["league-game-id"],
    queryFn: loadLeagueGameId,
    staleTime: Infinity,
  });
  return data ?? null;
}
