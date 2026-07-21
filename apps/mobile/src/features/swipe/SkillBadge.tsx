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

export function SkillBadge({ gameName, skillLevel }: SkillBadgeProps) {
  const { radius, spacing } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: "rgba(0,0,0,0.5)",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{gameName}</Text>
      <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{LABELS[skillLevel]}</Text>
    </View>
  );
}
