/** Mirrors the Postgres enums defined in supabase/migrations/0001_init.sql — keep in sync. */

export const GENDERS = ["male", "female", "non_binary", "prefer_not_to_say"] as const;
export type Gender = (typeof GENDERS)[number];

export const REGIONS = [
  "na_east",
  "na_west",
  "sa",
  "eu",
  "mena",
  "africa",
  "asia",
  "sea",
  "oce",
] as const;
export type Region = (typeof REGIONS)[number];

export const PLATFORMS = ["pc", "playstation", "xbox", "switch", "mobile"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PHOTO_ROLES = ["profile", "header", "gallery"] as const;
export type PhotoRole = (typeof PHOTO_ROLES)[number];

/** Gallery photos hold a "position" (0..5) that orders them and caps how many a
 * profile can have — see supabase/migrations/0036_photo_gallery.sql. */
export const MAX_GALLERY_PHOTOS = 6;

export const SKILL_LEVELS = ["casual", "intermediate", "competitive", "ranked_grinder"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const REPORT_REASONS = [
  "harassment",
  "spam",
  "inappropriate_content",
  "underage",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const SWIPE_ACTIONS = ["like", "pass"] as const;
export type SwipeAction = (typeof SWIPE_ACTIONS)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "expired",
  "cancelled",
  "refunded",
  "grace_period",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const MODERATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const PLAYSTYLE_TAGS = [
  "chill",
  "competitive",
  "mic_required",
  "no_mic",
  "late_night",
  "weekend_warrior",
  "casual_coop",
  "grinder",
  "team_player",
  "solo_queue",
] as const;
export type PlaystyleTag = (typeof PLAYSTYLE_TAGS)[number];

export const SHOW_CATEGORIES = ["show", "movie", "anime"] as const;
export type ShowCategory = (typeof SHOW_CATEGORIES)[number];

export const MATCH_FEEDBACK_TAGS = ["good_comms", "chill_after_losses", "showed_up_on_time", "flaked"] as const;
export type MatchFeedbackTag = (typeof MATCH_FEEDBACK_TAGS)[number];

export const MATCH_SESSION_STATUSES = ["pending", "confirmed", "declined", "cancelled"] as const;
export type MatchSessionStatus = (typeof MATCH_SESSION_STATUSES)[number];

export const LINKED_ACCOUNT_PROVIDERS = ["steam", "riot", "xbox"] as const;
export type LinkedAccountProvider = (typeof LINKED_ACCOUNT_PROVIDERS)[number];

export const TILT_HANDLING_OPTIONS = [
  "stays_calm",
  "gets_frustrated_sometimes",
  "tilts_but_recovers_fast",
  "needs_space_after_losses",
] as const;
export type TiltHandling = (typeof TILT_HANDLING_OPTIONS)[number];

/** ISO 639-1 codes for the languages offered in the onboarding multi-select. */
export const LANGUAGE_CODES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "ru",
  "ja",
  "ko",
  "zh",
  "ar",
  "hi",
  "tr",
  "pl",
  "nl",
  "sv",
  "vi",
  "th",
  "id",
  "tl",
] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];
