import { useQuery } from "@tanstack/react-query";
import type { DeckCandidate, OnlineNowCandidate } from "@duoqueue/shared-types";

import { enrichCandidates } from "@/features/swipe/enrichCandidates";
import type { DeckCard } from "@/features/swipe/types";
import { supabase } from "@/lib/supabase";

export interface OnlineNowCard extends DeckCard {
  lastActiveAt: string | null;
}

const ONLINE_NOW_PAGE_SIZE = 30;
/** Keeps the "live" list from going stale while the screen is open — cheap since the
 * RPC only scans the small is_looking_now-partial-indexed slice of profiles. */
const REFETCH_INTERVAL_MS = 30_000;

async function fetchOnlineNow(): Promise<OnlineNowCard[]> {
  const { data, error } = await supabase.rpc("get_online_now", { p_limit: ONLINE_NOW_PAGE_SIZE });
  if (error) throw error;
  const rows = (data ?? []) as OnlineNowCandidate[];

  const candidates: DeckCandidate[] = rows.map((r) => ({
    profile_id: r.profile_id,
    display_name: r.display_name,
    age: r.age,
    gender: r.gender,
    region: r.region,
    bio: r.bio,
    shared_games_count: r.shared_games_count,
    shared_shows_count: r.shared_shows_count,
    score: 0,
  }));

  const cards = await enrichCandidates(candidates);
  const lastActiveById = new Map(rows.map((r) => [r.profile_id, r.last_active_at]));
  return cards.map((c) => ({ ...c, lastActiveAt: lastActiveById.get(c.profile_id) ?? null }));
}

export function useOnlineNow() {
  return useQuery({
    queryKey: ["online-now"],
    queryFn: fetchOnlineNow,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
