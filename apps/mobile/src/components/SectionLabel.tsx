import { Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

/**
 * The heading above a grouped section. A short brand rule sits to its left — the
 * recurring detail that marks where one group of content ends and the next begins,
 * so sections are separated by a mark rather than only by whitespace.
 */
export function SectionLabel({ children }: { children: string }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ width: 10, height: 3, backgroundColor: colors.p1Line }} />
      <Text style={[type.label, { color: colors.textMuted }]}>{children}</Text>
    </View>
  );
}
