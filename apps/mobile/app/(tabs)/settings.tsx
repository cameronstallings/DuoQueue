import { Text } from "react-native";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function SettingsScreen() {
  const { colors, spacing } = useTheme();
  const signOut = useSessionStore((s) => s.signOut);

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>Settings</Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
        Notification preferences, blocked users, and account deletion land in Phase 5.
      </Text>
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
    </ScreenContainer>
  );
}
