import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Gender, MatchFeedbackTag, Platform, PlaystyleTag, Region, SkillLevel, TiltHandling } from "@duoqueue/shared-types";

/** Static display-label maps for enum values shown across filters, swipe cards, and the
 * Profile tab — kept in one place instead of duplicated per screen. */

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  non_binary: "Non-binary",
  prefer_not_to_say: "Prefer not to say",
};

export const REGION_LABELS: Record<Region, string> = {
  na_east: "NA East",
  na_west: "NA West",
  sa: "South America",
  eu: "Europe",
  mena: "MENA",
  africa: "Africa",
  asia: "Asia",
  sea: "SEA",
  oce: "Oceania",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  pc: "PC",
  playstation: "PlayStation",
  xbox: "Xbox",
  switch: "Switch",
  mobile: "Mobile",
};

/** Brand-recognizable glyphs (Discord/Steam-style platform iconography) instead of the
 * generic chip icon every platform previously shared. */
export const PLATFORM_ICONS: Record<Platform, ComponentProps<typeof MaterialCommunityIcons>["name"]> = {
  pc: "desktop-tower-monitor",
  playstation: "sony-playstation",
  xbox: "microsoft-xbox",
  switch: "nintendo-switch",
  mobile: "cellphone",
};

export const SKILL_LABELS: Record<SkillLevel, string> = {
  casual: "Casual",
  intermediate: "Intermediate",
  competitive: "Competitive",
  ranked_grinder: "Ranked Grinder",
};

export const PLAYSTYLE_LABELS: Record<PlaystyleTag, string> = {
  chill: "Chill",
  competitive: "Competitive",
  mic_required: "Mic required",
  no_mic: "No mic",
  late_night: "Late night",
  weekend_warrior: "Weekend warrior",
  casual_coop: "Casual co-op",
  grinder: "Grinder",
  team_player: "Team player",
  solo_queue: "Solo queue",
};

export const TILT_HANDLING_LABELS: Record<TiltHandling, string> = {
  stays_calm: "Stays calm",
  gets_frustrated_sometimes: "Gets frustrated sometimes",
  tilts_but_recovers_fast: "Tilts, but recovers fast",
  needs_space_after_losses: "Needs space after losses",
};

export const MATCH_FEEDBACK_LABELS: Record<MatchFeedbackTag, string> = {
  good_comms: "Good comms",
  chill_after_losses: "Chill after losses",
  showed_up_on_time: "Showed up on time",
  flaked: "Flaked",
};

/** The small set of "usual play window" choices offered in onboarding/edit — kept
 * coarse (a handful of presets, not a raw hour wheel) since the underlying
 * usual_play_start_hour/usual_play_end_hour columns don't need finer input than this
 * to be useful for the get_deck overlap bonus. */
export const PLAY_WINDOW_PRESETS: { label: string; startHour: number; endHour: number }[] = [
  { label: "Early morning (5–9am)", startHour: 5, endHour: 9 },
  { label: "Morning (9am–12pm)", startHour: 9, endHour: 12 },
  { label: "Afternoon (12–5pm)", startHour: 12, endHour: 17 },
  { label: "Evening (5–9pm)", startHour: 17, endHour: 21 },
  { label: "Night (9pm–1am)", startHour: 21, endHour: 1 },
  { label: "Late night (1–5am)", startHour: 1, endHour: 5 },
];

export function formatPlayWindow(startHour: number | null, endHour: number | null): string | null {
  if (startHour === null || endHour === null) return null;
  const preset = PLAY_WINDOW_PRESETS.find((p) => p.startHour === startHour && p.endHour === endHour);
  return preset ? `Usually plays ${preset.label}` : null;
}
