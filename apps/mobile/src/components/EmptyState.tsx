import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/useTheme";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** A consistent "nothing here" / "something went wrong" presentation — an icon badge
 * instead of bare text, used across the deck, matches, admirers, and block list. */
export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={32} color={colors.brand} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, textAlign: "center" }}>{title}</Text>
      <Text style={{ color: colors.textMuted, textAlign: "center" }}>{subtitle}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction}>
          <Text style={{ color: colors.brand, fontWeight: "600" }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
