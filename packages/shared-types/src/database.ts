import type {
  Gender,
  LinkedAccountProvider,
  MatchSessionStatus,
  ModerationStatus,
  Platform,
  Region,
  ReportReason,
  ShowCategory,
  SkillLevel,
  SubscriptionStatus,
  SwipeAction,
  TiltHandling,
  VerifiedStatKind,
} from "./enums";

/**
 * Hand-authored mirror of the Supabase schema (supabase/migrations/0001_init.sql).
 * Once the project is linked, prefer regenerating this via:
 *   supabase gen types typescript --local > packages/shared-types/src/database.generated.ts
 * Kept hand-written for Phase 1 since no live project is linked yet.
 */

export type ReportStatus = "open" | "reviewed" | "actioned" | "dismissed";
export type SubscriptionStore = "app_store" | "play_store";

export interface ProfileRow {
  id: string;
  display_name: string;
  dob: string;
  gender: Gender;
  region: Region;
  timezone: string;
  bio: string | null;
  discord_username: string | null;
  onboarding_completed: boolean;
  is_active: boolean;
  hide_last_active: boolean;
  last_active_at: string | null;
  usual_play_start_hour: number | null;
  usual_play_end_hour: number | null;
  is_looking_now: boolean;
  looking_now_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Row shape for `profile_vibe` (see 0019_vibe_compatibility.sql) — self-reported
 * playstyle-fit sliders, 0-100, plus a tilt-handling tag. */
export interface ProfileVibeRow {
  profile_id: string;
  intensity: number;
  comms_style: number;
  coaching_pref: number;
  tilt_handling: TiltHandling;
}

/** Row shape for `profile_voice_intro` (see 0024_voice_intros.sql). */
export interface ProfileVoiceIntroRow {
  profile_id: string;
  storage_path: string;
  duration_seconds: number;
  moderation_status: ModerationStatus;
  created_at: string;
}

/** Row shape for `linked_accounts` (see 0025_linked_accounts.sql). */
export interface LinkedAccountRow {
  profile_id: string;
  provider: LinkedAccountProvider;
  external_id: string;
  display_name: string;
  rank_tier: string | null;
  avatar_url: string | null;
  linked_at: string;
}

/** Row shape for `verified_stats` (see 0039_verified_stats.sql) — a platform-verified
 * rank or playtime figure, written only by the `sync-verified-stats` Edge Function. */
export interface VerifiedStatRow {
  id: string;
  profile_id: string;
  provider: LinkedAccountProvider;
  game_id: string | null;
  stat_kind: VerifiedStatKind;
  stat_value: string;
  fetched_at: string;
}

/** Public-safe projection (backs the `public_verified_stats` view) — adds the game's
 * name so a client can key straight off it, the same shape `public_profile_games`
 * already uses for self-reported games. */
export interface PublicVerifiedStatRow {
  profile_id: string;
  provider: LinkedAccountProvider;
  game_id: string | null;
  game_name: string | null;
  stat_kind: VerifiedStatKind;
  stat_value: string;
  fetched_at: string;
}

/** Row shape for `match_sessions` (see 0023_match_sessions.sql). */
export interface MatchSessionRow {
  id: string;
  match_id: string;
  proposed_by: string;
  scheduled_at: string;
  status: MatchSessionStatus;
  created_at: string;
  updated_at: string;
}

/** Public-safe projection (backs the `public_profiles` view) — never exposes dob/discord_username. */
export interface PublicProfileRow {
  id: string;
  display_name: string;
  age: number;
  gender: Gender;
  region: Region;
  bio: string | null;
  created_at: string;
}

export interface ProfileMediaRow {
  id: string;
  profile_id: string;
  storage_path: string;
  position: number;
  moderation_status: ModerationStatus;
  created_at: string;
}

export interface ProfilePlatformRow {
  profile_id: string;
  platform: Platform;
}

export interface ProfileLanguageRow {
  profile_id: string;
  language_code: string;
}

export interface ProfilePlaystyleRow {
  profile_id: string;
  tag: string;
}

export interface GameRow {
  id: string;
  name: string;
  igdb_id: number | null;
  /** Steam AppID, when this catalog game maps to a Steam title (see
   * 0039_verified_stats.sql) — lets `sync-verified-stats` ask GetOwnedGames for exactly
   * this game's playtime. Null for games with no Steam mapping. */
  steam_app_id: number | null;
  /** Riot ranked queue type (e.g. `RANKED_SOLO_5x5` for League), when this catalog game
   * maps to a Riot title. Null for games with no Riot mapping. */
  riot_queue: string | null;
  is_custom: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ProfileGameRow {
  id: string;
  profile_id: string;
  game_id: string;
  skill_level: SkillLevel;
  rank_text: string | null;
  priority: number;
  created_at: string;
}

export interface ShowRow {
  id: string;
  name: string;
  category: ShowCategory | null;
  is_custom: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ProfileShowRow {
  id: string;
  profile_id: string;
  show_id: string;
  priority: number;
  created_at: string;
}

export interface PreferencesRow {
  profile_id: string;
  min_age: number;
  max_age: number;
  preferred_genders: Gender[] | null;
  preferred_regions: Region[] | null;
  required_language: string | null;
  filter_game_id: string | null;
  filter_platform: Platform | null;
  filter_skill_level: SkillLevel | null;
  filter_playstyle: string | null;
  filter_show_id: string | null;
  filter_recently_active: boolean;
  updated_at: string;
}

export interface SwipeRow {
  id: string;
  swiper_id: string;
  target_id: string;
  action: SwipeAction;
  created_at: string;
}

export interface DailySwipeCounterRow {
  profile_id: string;
  day: string;
  swipe_count: number;
}

export interface MatchRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  matched_at: string;
  unmatched_at: string | null;
  unmatched_by: string | null;
}

export interface MessageRow {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  is_flagged: boolean;
  read_at: string | null;
  created_at: string;
}

export interface DiscordShareRow {
  id: string;
  match_id: string;
  shared_by: string;
  revoked: boolean;
  shared_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: ReportReason;
  details: string | null;
  match_id: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface BlockRow {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface SubscriptionRow {
  profile_id: string;
  revenuecat_app_user_id: string;
  product_id: string;
  status: SubscriptionStatus;
  entitlement: string;
  current_period_end: string | null;
  will_renew: boolean;
  is_trial: boolean;
  store: SubscriptionStore;
  raw_event: unknown;
  updated_at: string;
}

export interface SuperPingRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
}

export interface PushTokenRow {
  id: string;
  profile_id: string;
  expo_push_token: string;
  device_info: unknown;
  created_at: string;
}

export interface NotificationSettingsRow {
  profile_id: string;
  new_match: boolean;
  new_message: boolean;
  super_ping: boolean;
  daily_swipes_refreshed: boolean;
  nudge_unread: boolean;
  nudge_online: boolean;
}
