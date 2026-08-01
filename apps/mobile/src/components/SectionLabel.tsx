import { Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

/**
 * The heading above a grouped section — sections are separated by the accent-tinted
 * label itself rather than by a rule mark beside it.
 */
export function SectionLabel({ children }: { children: string }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={[type.label, { color: colors.accent }]}>{children}</Text>
    </View>
  );
}
