import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useTheme } from "@/theme/useTheme";

export default function ChatScreen() {
  const { colors } = useTheme();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>Chat</Text>
      <Text style={{ color: colors.textMuted }}>
        Real-time messaging for match {matchId} lands in Phase 3.
      </Text>
    </ScreenContainer>
  );
}
