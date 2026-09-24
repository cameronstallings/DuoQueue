import { ScrollView, Text, View } from "react-native";

import { SectionLabel } from "@/components/SectionLabel";
import { useTheme } from "@/theme/useTheme";

import type { OwnPrompt } from "./useOwnPrompts";

const CARD_WIDTH = 260;

/** Your other prompts as cards that scroll sideways, the next one peeking. Cards on one row
 * stretch to the tallest, so a 150-character answer never truncates. */
export function MoreFromMe({ prompts }: { prompts: OwnPrompt[] }) {
  const { colors, fonts, radius, spacing, type } = useTheme();

  return (
    <View>
      <SectionLabel>More from me</SectionLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spacing.lg }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      >
        {prompts.map((prompt) => (
          <View
            key={prompt.promptId}
            style={{
              width: CARD_WIDTH,
              minHeight: 128,
              padding: spacing.md,
              gap: spacing.xs,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.cardEdge,
              backgroundColor: colors.cardHero,
            }}
          >
            {prompt.question ? <Text style={[type.label, { color: colors.textMuted }]}>{prompt.question}</Text> : null}
            <Text style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, color: colors.text }}>{prompt.answer}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
