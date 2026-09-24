import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { SectionLabel } from "@/components/SectionLabel";
import { useTheme } from "@/theme/useTheme";

import type { OwnPrompt } from "./useOwnPrompts";

// The Edit link is one 14pt label line. It gets a 44pt box, and negative vertical margins take
// the extra 30pt back out of the layout, so PROMPTS sits as close to its first quote as GAMES
// sits to its panel. The box stays centered on the label line.
const TARGET = 44;
const LABEL_LINE = 14;
const OVERHANG = (TARGET - LABEL_LINE) / 2;

/**
 * PROMPTS: every prompt you answered, in one place, as open quotes with no box. Each has a 2pt
 * volt bar on the left, the question as a muted mono label and the answer in large type. Edit
 * sits at the right of the section label.
 */
export function PromptQuotes({ prompts }: { prompts: OwnPrompt[] }) {
  const { colors, fonts, spacing, type } = useTheme();

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SectionLabel>Prompts</SectionLabel>
        <Pressable
          onPress={() => router.push("/edit-prompts")}
          accessibilityRole="button"
          accessibilityLabel="Edit prompts"
          style={({ pressed }) => ({
            minWidth: TARGET,
            minHeight: TARGET,
            marginVertical: -OVERHANG,
            alignItems: "flex-end",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={[type.label, { color: colors.voltDim, includeFontPadding: false }]}>Edit ›</Text>
        </Pressable>
      </View>
      <View style={{ gap: spacing.lg }}>
        {prompts.map((prompt) => (
          <View
            key={prompt.promptId}
            accessible
            accessibilityLabel={prompt.question ? `${prompt.question}, ${prompt.answer}` : prompt.answer}
            style={{ flexDirection: "row", gap: spacing.md }}
          >
            <View style={{ width: 2, borderRadius: 1, backgroundColor: colors.volt }} />
            <View style={{ flex: 1, gap: spacing.xs, paddingVertical: spacing.xs }}>
              {prompt.question ? <Text style={[type.label, { color: colors.textMuted }]}>{prompt.question}</Text> : null}
              <Text style={{ fontFamily: fonts.semibold, fontSize: 24, lineHeight: 32, color: colors.text }}>{prompt.answer}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
