import { Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

/**
 * The heading above a grouped section — sections are separated by the label itself
 * rather than by a rule mark beside it.
 */
export function SectionLabel({ children }: { children: string }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View style={{ marginBottom: spacing.sm }}>
      {/* type.label is 10px/14 line-height mono uppercase — includeFontPadding: false
       *  keeps Android from clipping ascenders/descenders at that tight a ratio. */}
      <Text style={[type.label, { color: colors.textMuted, includeFontPadding: false }]}>{children}</Text>
    </View>
  );
}
