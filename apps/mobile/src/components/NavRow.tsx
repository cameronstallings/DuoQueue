import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/useTheme";

interface NavRowProps {
  label: string;
  /** One short line under the label. Use it to answer the question the row raises
   *  before the user has to tap in and find out. */
  hint?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  destructive?: boolean;
  /** Value shown on the right — the current selection for a row that opens a picker. */
  value?: string;
}

/** A row that opens something else. The building block of the settings menu, so that
 *  the top level reads as a short list of destinations rather than every control in
 *  the app stacked on one page. */
export function NavRow({ label, hint, icon, onPress, destructive, value }: NavRowProps) {
  const { colors, spacing, type } = useTheme();
  const tint = destructive ? colors.danger : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: pressed ? colors.surfaceAlt : "transparent",
      })}
    >
      {icon && <Ionicons name={icon} size={19} color={destructive ? colors.danger : colors.textMuted} />}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[type.body, { color: tint }]}>{label}</Text>
        {hint && <Text style={[type.caption, { color: colors.textMuted }]}>{hint}</Text>}
      </View>
      {value && <Text style={[type.caption, { color: colors.textMuted }]}>{value}</Text>}
      <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
    </Pressable>
  );
}

/** A hairline between rows inside the same group. */
export function RowDivider() {
  const { colors, spacing } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing.md }} />;
}
