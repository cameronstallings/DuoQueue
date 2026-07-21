import { Text } from "react-native";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function DeckScreen() {
  const { colors } = useTheme();
  const profile = useSessionStore((s) => s.profile);

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>
        Welcome, {profile?.display_name ?? "gamer"}
      </Text>
      <Text style={{ color: colors.textMuted }}>
        The swipe deck lands in Phase 2. Your profile is fully set up — thanks for building with us.
      </Text>
    </ScreenContainer>
  );
}
