import { useQuery } from "@tanstack/react-query";
import type { DeckCandidate } from "@duoqueue/shared-types";

import { enrichCandidates } from "@/features/swipe/enrichCandidates";
import type { DeckCard } from "@/features/swipe/types";
import { supabase } from "@/lib/supabase";

interface PublicProfileRow {
  id: string;
  display_name: string;
  age: number;
  gender: DeckCandidate["gender"];
  region: DeckCandidate["region"];
  bio: string | null;
}

/**
 * Fetches a single profile by id and maps it through the exact same
 * `enrichCandidates` pipeline `useDeck`/`useStandouts` use, so a matched user's
 * profile renders identically to a deck card instead of a second, drifting
 * mapping.
 *
 * The row comes from `public_profiles` — the same view `usePartyMembers` already
 * queries by id (see `@/features/party/useParty.ts`) — rather than `get_deck`'s
 * RPC. `get_deck`/`get_standouts` bake in deck-eligibility filtering (already-
 * swiped candidates are excluded from what they return), which is exactly wrong
 * for this hook: a matched user has necessarily already been swiped on, so an
 * RPC-backed fetch could never resolve them. `public_profiles` only filters on
 * `is_active`/`onboarding_completed` (see 0001_init.sql / 0031_security_hardening.sql),
 * with no notion of "already seen," so it can resolve any active profile by id
 * regardless of swipe/match history.
 *
 * Throws (rather than resolving to `undefined`) when no row matches — react-query's
 * queryFn contract treats `undefined` as "not fetched yet," not as a valid result, so
 * a missing profile folds into `isError` like any other failed fetch instead.
 */
async function fetchProfileCard(profileId: string): Promise<DeckCard> {
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, display_name, age, gender, region, bio")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Profile not found");

  const row = data as PublicProfileRow;
  const candidate: DeckCandidate = {
    profile_id: row.id,
    display_name: row.display_name,
    age: row.age,
    gender: row.gender,
    region: row.region,
    bio: row.bio,
    // public_profiles carries none of get_deck's per-viewer ranking data — these
    // three fields only ever feed deck sort order, ProfileDetailContent never
    // reads them, so zero is a safe stand-in rather than making them optional on
    // the shared DeckCandidate type.
    shared_games_count: 0,
    shared_shows_count: 0,
    score: 0,
  };

  const [card] = await enrichCandidates([candidate]);
  if (!card) throw new Error("Profile not found");
  return card;
}

export function useProfileCard(profileId: string) {
  const query = useQuery({
    queryKey: ["profile-card", profileId],
    queryFn: () => fetchProfileCard(profileId),
    enabled: !!profileId,
  });

  return { data: query.data, isPending: query.isPending, isError: query.isError };
}
