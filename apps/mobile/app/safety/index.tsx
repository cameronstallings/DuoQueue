import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SAFETY_TOPICS } from "@/features/safety/content";
import { useTheme } from "@/theme/useTheme";

const TOPIC_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  meetup: "people",
  scams: "shield-checkmark",
  guidelines: "document-text",
  reporting: "flag",
  crisis: "call",
};

export default function SafetyCenterScreen() {
  const { colors, spacing } = useTheme();

  return (
    <ScreenContainer title="Safety Center" showClose>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
        Tips, guidelines, and resources for staying safe on DuoQueue.
      </Text>

      <Card style={{ padding: 0 }}>
        {SAFETY_TOPICS.map((topic, i) => (
          <View key={topic.key}>
            {i > 0 && <View style={{ height: 1, backgroundColor: colors.border }} />}
            <Pressable
              onPress={() => router.push({ pathname: "/safety/[topic]", params: { topic: topic.key } })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
              }}
            >
              <Ionicons name={TOPIC_ICONS[topic.key] ?? "information-circle"} size={22} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "600" }}>{topic.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={1}>
                  {topic.summary}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </Card>
    </ScreenContainer>
  );
}
