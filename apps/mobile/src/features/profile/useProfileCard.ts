import { useQuery } from "@tanstack/react-query";
import type { DeckCandidate } from "@duoqueue/shared-types";

import { enrichCandidates } from "@/features/swipe/enrichCandidates";
import type { DeckCard } from "@/features/swipe/types";
import { supabase } from "@/lib/supabase";

/** Row shape returned by the `get_profile_card` RPC (see 0060_remove_gender_filtering.sql). */
interface ProfileCardRow {
  profile_id: string;
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
 * This deliberately does not use `get_deck`/`get_standouts`: those bake in
 * deck-eligibility filtering (already-swiped candidates are excluded from what they
 * return), which is exactly wrong for this hook, since a matched user has necessarily
 * already been swiped on and so could never come back from them. `get_profile_card`
 * applies only the visibility rules `public_profiles` does — active, onboarded, not
 * banned or suspended, not blocked either direction — with no notion of "already seen,"
 * so it resolves any visible profile by id regardless of swipe/match history.
 *
 * It used to read `public_profiles` directly. It cannot anymore: 0060 dropped `gender`
 * from that view, because PostgREST exposes every view column as a filter operator and
 * `?gender=eq.<x>` was therefore a working gender-filtered roster of the whole discovery
 * pool — the exact capability the App Review notes say the app does not have. A SECURITY
 * DEFINER function takes an id and nothing else, so gender is still displayable one
 * profile at a time with no way to query *by* it.
 *
 * Throws (rather than resolving to `undefined`) when no row matches — react-query's
 * queryFn contract treats `undefined` as "not fetched yet," not as a valid result, so
 * a missing profile folds into `isError` like any other failed fetch instead.
 */
async function fetchProfileCard(profileId: string): Promise<DeckCard> {
  const { data, error } = await supabase
    .rpc("get_profile_card", { p_profile_id: profileId })
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Profile not found");

  const row = data as ProfileCardRow;
  const candidate: DeckCandidate = {
    profile_id: row.profile_id,
    display_name: row.display_name,
    age: row.age,
    gender: row.gender,
    region: row.region,
    bio: row.bio,
    // get_profile_card carries none of get_deck's per-viewer ranking data — these
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
