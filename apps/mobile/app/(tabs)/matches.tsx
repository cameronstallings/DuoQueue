import { Text } from "react-native";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useTheme } from "@/theme/useTheme";

export default function MatchesScreen() {
  const { colors } = useTheme();
  return (
    <ScreenContainer>
      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>Matches</Text>
      <Text style={{ color: colors.textMuted }}>
        Real-time chat and Discord sharing land in Phase 3.
      </Text>
    </ScreenContainer>
  );
}
