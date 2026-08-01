import { Text, View } from "react-native";
import type { SkillLevel } from "@duoqueue/shared-types";

import { useTheme } from "@/theme/useTheme";

const LABELS: Record<SkillLevel, string> = {
  casual: "Casual",
  intermediate: "Intermediate",
  competitive: "Competitive",
  ranked_grinder: "Ranked Grinder",
};

interface SkillBadgeProps {
  gameName: string;
  skillLevel: SkillLevel;
}

/**
 * The game name is the loud part; the playstyle is a coloured tab clipped to its
 * right edge, like the category stripe on a cartridge label.
 *
 * Each playstyle gets its own ink, but the four are chosen at matched luminance so
 * the set reads as a legend rather than a ranking — this is a compatibility axis,
 * not a quality ladder, and a heat ramp would imply casual players are worse. The
 * previous version rendered all four in one identical grey pill, which meant the
 * field was on screen but carrying no information at all.
 */
export function SkillBadge({ gameName, skillLevel }: SkillBadgeProps) {
  const { colors, radius, spacing, type, scrimRgb } = useTheme();
  const tab = colors.playstyle[skillLevel];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        borderRadius: radius.chip,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: `rgba(${scrimRgb},0.9)`,
      }}
    >
      <View
        style={{
          justifyContent: "center",
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          backgroundColor: `rgba(${scrimRgb},0.82)`,
        }}
      >
        <Text style={[type.caption, { color: "#F5F1E8" }]} numberOfLines={1}>
          {gameName}
        </Text>
      </View>
      <View
        style={{
          justifyContent: "center",
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          backgroundColor: tab,
        }}
      >
        <Text style={[type.statSm, { color: colors.onFill }]} numberOfLines={1}>
          {LABELS[skillLevel]}
        </Text>
      </View>
    </View>
  );
}
