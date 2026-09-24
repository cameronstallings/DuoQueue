import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { useTheme } from "@/theme/useTheme";

/** Your first prompt, large, with no box: a 2pt volt bar on the left. */
export function FeaturedPrompt({ question, answer }: { question: string; answer: string }) {
  const { colors, fonts, spacing, type } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ width: 2, borderRadius: 1, backgroundColor: colors.volt }} />
        <View style={{ flex: 1, gap: spacing.xs, paddingVertical: spacing.xs }}>
          {question ? <Text style={[type.label, { color: colors.voltDim }]}>{question}</Text> : null}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 24, lineHeight: 32, color: colors.text }}>{answer}</Text>
        </View>
      </View>
      <Pressable
        onPress={() => router.push("/edit-prompts")}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Edit prompts"
        style={{ alignSelf: "flex-start", marginLeft: spacing.md + 2 }}
      >
        <Text style={[type.label, { color: colors.voltDim }]}>Edit prompts ›</Text>
      </Pressable>
    </View>
  );
}
