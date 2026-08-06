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

/** Row shape returned by the `get_consumable_credits` RPC (see 0013_boosts_and_roses.sql,
 * extended in 0027_free_daily_rose.sql). `roses` is purchased credits only — everyone
 * also gets one free Legendary Like every 24 hours regardless of purchase history,
 * tracked separately via `free_rose_available`/`free_rose_available_at`. */
export interface ConsumableCredits {
  boosts: number;
  roses: number;
  free_rose_available: boolean;
  free_rose_available_at: string | null;
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

/** Row shape returned by the `get_online_now` RPC (see 0021_online_now.sql). */
export interface OnlineNowCandidate {
  profile_id: string;
  display_name: string;
  age: number;
  gender: Gender;
  region: Region;
  bio: string | null;
  shared_games_count: number;
  shared_shows_count: number;
  last_active_at: string | null;
}

/** Row shape returned by the `get_party_deck` RPC — same shape as DeckCandidate so it
 * can be piped through the existing enrichCandidates()/SwipeDeck without a new card
 * type (see 0026_parties.sql). */
export type PartyDeckCandidate = DeckCandidate;

/** Row shape returned by the `perform_party_swipe` RPC. */
export interface PartySwipeResult {
  invited: boolean;
}

/** Row shape returned by `get_my_party_invites`. */
export interface PartyInviteSummary {
  invite_id: string;
  party_id: string;
  created_at: string;
}

/** Row shape returned by `get_my_parties`. */
export interface PartySummary {
  party_id: string;
  created_at: string;
}

/** Row shape for `party_members` (see 0026_parties.sql). */
export interface PartyMemberRow {
  party_id: string;
  profile_id: string;
  joined_at: string;
}

/** Row shape for `party_messages` (see 0026_parties.sql). */
export interface PartyMessageRow {
  id: string;
  party_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface PreferencesInput {
  minAge: number;
  maxAge: number;
  preferredRegions: Region[];
  requiredLanguage: string | null;
  filterGameId: string | null;
  filterPlatform: Platform | null;
  filterSkillLevel: SkillLevel | null;
  filterPlaystyle: PlaystyleTag | null;
}
