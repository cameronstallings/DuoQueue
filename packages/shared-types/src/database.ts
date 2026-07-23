import type {
  Gender,
  ModerationStatus,
  Platform,
  Region,
  ReportReason,
  ShowCategory,
  SkillLevel,
  SubscriptionStatus,
  SwipeAction,
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
}
