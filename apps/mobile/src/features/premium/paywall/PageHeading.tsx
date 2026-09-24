import { Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

import type { HeadingCopy } from "./paywallCopy";

/** Each page's own label, title and body. They do the heading work: the bar above has no title. */
export function PageHeading({ copy }: { copy: HeadingCopy }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[type.label, { color: colors.volt }]}>{copy.label}</Text>
      <Text accessibilityRole="header" style={[type.heroTitle, { color: colors.text }]}>
        {copy.title}
      </Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{copy.body}</Text>
    </View>
  );
}
