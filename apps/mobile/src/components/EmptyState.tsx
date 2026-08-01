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

/** A consistent "nothing here" / "something went wrong" presentation — used across the
 * deck, matches, admirers, and block list. The icon sits in a keylined square rather
 * than a soft circle, so an empty screen still looks like it belongs to this app. */
export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing, radius, type, shadow, hairline } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg }}>
      <View
        style={[
          {
            width: 72,
            height: 72,
            borderRadius: radius.md,
            backgroundColor: colors.brandSoft,
            borderWidth: hairline,
            borderColor: colors.ink,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ rotate: "-2deg" }],
          },
          shadow,
        ]}
      >
        <Ionicons name={icon} size={32} color={colors.brandInk} />
      </View>
      <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{title}</Text>
      <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{subtitle}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={[type.label, { color: colors.brandInk }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
