import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SAFETY_TOPICS } from "@/features/safety/content";
import { useTheme } from "@/theme/useTheme";

export default function SafetyTopicScreen() {
  const { colors, spacing, type } = useTheme();
  const { topic: topicKey } = useLocalSearchParams<{ topic: string }>();
  const topic = SAFETY_TOPICS.find((t) => t.key === topicKey);

  // Reached from a modal (safety/index), so the native header this used to enable
  // never rendered — the screen title was drawn twice and there was no way back.
  if (!topic) {
    return (
      <ScreenContainer title="Not found" showBack>
        <Text style={[type.body, { color: colors.textMuted }]}>This safety topic isn&apos;t available.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title={topic.title} showBack>
      <Text style={[type.body, { color: colors.textMuted }]}>{topic.summary}</Text>

      {topic.sections.map((section) => (
        <Card key={section.heading} style={{ gap: spacing.xs }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>{section.heading}</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>{section.body}</Text>
        </Card>
      ))}
    </ScreenContainer>
  );
}
