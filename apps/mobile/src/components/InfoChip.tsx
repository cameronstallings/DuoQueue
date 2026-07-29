import type { ComponentProps } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/useTheme";

interface InfoChipProps {
  label: string;
  sublabel?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
}

/** A small, non-interactive pill — used to display (not select) games/shows/platforms/
 * playstyles on the Profile tab, visually related to ChipSelect but read-only. */
export function InfoChip({ label, sublabel, icon }: InfoChipProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {icon && <Ionicons name={icon} size={13} color={colors.brand} />}
      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{label}</Text>
      {sublabel && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{sublabel}</Text>}
    </View>
  );
}
