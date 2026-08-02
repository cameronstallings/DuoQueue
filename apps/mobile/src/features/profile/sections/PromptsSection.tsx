import { Text, View } from "react-native";

import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { useTheme } from "@/theme/useTheme";

/**
 * One glass card per prompt — the question sits small and tinted (a label, not a
 * headline), the answer gets the larger quote size since it's the one place a
 * person's own writing appears at length.
 */
export function PromptsSection({ prompts }: { prompts: { question: string; answer: string }[] }) {
  const { colors, spacing, type } = useTheme();

  if (prompts.length === 0) return null;

  return (
    <View>
      <SectionLabel>Prompts</SectionLabel>
      <View style={{ gap: spacing.sm }}>
        {prompts.map((prompt) => (
          <Card key={prompt.question} style={{ gap: spacing.xs }}>
            <Text style={[type.caption, { color: colors.accentInk }]}>{prompt.question}</Text>
            <Text style={[type.quote, { color: colors.text }]}>{prompt.answer}</Text>
          </Card>
        ))}
      </View>
    </View>
  );
}
