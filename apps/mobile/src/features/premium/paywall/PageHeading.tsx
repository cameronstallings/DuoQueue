import { Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

import type { HeadingCopy } from "./paywallCopy";

/** Each page's own label, title and body. They do the heading work: the bar above has no title. */
export function PageHeading({ copy }: { copy: HeadingCopy }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[type.label, { color: colors.volt }]}>{copy.label}</Text>
      {/* push-out: where a line still has to wrap (a 375pt phone, a larger text size), iOS
          moves a word down rather than leave one alone on the last line ("Choose who shows /
          up." on an iPhone SE, found by rendering at 375 x 667). */}
      <Text accessibilityRole="header" lineBreakStrategyIOS="push-out" style={[type.heroTitle, { color: colors.text }]}>
        {copy.title}
      </Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{copy.body}</Text>
    </View>
  );
}
