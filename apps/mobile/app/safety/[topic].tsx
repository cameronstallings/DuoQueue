import { Text } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SAFETY_TOPICS } from "@/features/safety/content";
import { useTheme } from "@/theme/useTheme";

export default function SafetyTopicScreen() {
  const { colors, spacing, type } = useTheme();
  const { topic: topicKey } = useLocalSearchParams<{ topic: string }>();
  const topic = SAFETY_TOPICS.find((t) => t.key === topicKey);

  if (!topic) {
    return (
      <ScreenContainer>
        <Text style={{ color: colors.textMuted }}>This safety topic isn&apos;t available.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: topic.title }} />
      <Text style={{ ...type.screenTitle, color: colors.text }}>{topic.title}</Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>{topic.summary}</Text>

      {topic.sections.map((section) => (
        <Card key={section.heading} style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>{section.heading}</Text>
          <Text style={{ color: colors.textMuted, lineHeight: 20 }}>{section.body}</Text>
        </Card>
      ))}
    </ScreenContainer>
  );
}
