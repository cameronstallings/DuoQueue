import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { useTheme } from "@/theme/useTheme";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** A consistent "nothing here" / "something went wrong" presentation — used across the
 * deck, matches, admirers, and block list. The icon sits in a soft glowing circle,
 * so an empty screen still looks like it belongs to this app. */
export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing, radius, type, glow } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg }}>
      <View
        style={[
          {
            width: 64,
            height: 64,
            borderRadius: radius.round,
            backgroundColor: colors.brandSoft,
            alignItems: "center",
            justifyContent: "center",
          },
          glow(colors.glowViolet, 24),
        ]}
      >
        <Ionicons name={icon} size={32} color={colors.accentInk} />
      </View>
      <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{title}</Text>
      <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{subtitle}</Text>
      {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} variant="ghost" />}
    </View>
  );
}
