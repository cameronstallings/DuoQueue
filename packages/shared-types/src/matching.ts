import type { Gender, Platform, PlaystyleTag, Region, SkillLevel } from "./enums";

/** Row shape returned by the `get_deck` Postgres RPC (see supabase/migrations/0003_matching.sql). */
export interface DeckCandidate {
  profile_id: string;
  display_name: string;
  age: number;
  gender: Gender;
  region: Region;
  bio: string | null;
  shared_games_count: number;
  shared_shows_count: number;
  score: number;
}

/** Row shape returned by the `perform_swipe` RPC. */
export interface SwipeResult {
  matched: boolean;
  match_id: string | null;
}

/** Row shape returned by the `get_swipe_quota` RPC. `swipes_limit` is null when unlimited (premium). */
export interface SwipeQuota {
  swipes_used: number;
  swipes_limit: number | null;
  is_premium: boolean;
}

/** Row shape returned by the `get_admirers` RPC (premium-only — see 0005_premium.sql). */
export interface Admirer {
  profile_id: string;
  display_name: string;
  age: number;
  gender: Gender;
  region: Region;
  bio: string | null;
  liked_at: string;
}

export interface PreferencesInput {
  minAge: number;
  maxAge: number;
  preferredGenders: Gender[];
  preferredRegions: Region[];
  requiredLanguage: string | null;
  filterGameId: string | null;
  filterPlatform: Platform | null;
  filterSkillLevel: SkillLevel | null;
  filterPlaystyle: PlaystyleTag | null;
}
