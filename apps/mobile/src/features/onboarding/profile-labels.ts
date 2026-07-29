import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Gender, Platform, PlaystyleTag, Region, SkillLevel } from "@duoqueue/shared-types";

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
