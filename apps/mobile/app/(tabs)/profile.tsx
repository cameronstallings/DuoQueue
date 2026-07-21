import { Text } from "react-native";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function ProfileScreen() {
  const { colors } = useTheme();
  const profile = useSessionStore((s) => s.profile);

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>
        {profile?.display_name}
      </Text>
      <Text style={{ color: colors.textMuted }}>{profile?.bio}</Text>
      <Text style={{ color: colors.textMuted }}>
        Profile editing and premium (&quot;who swiped right on you&quot;) land in later phases.
      </Text>
    </ScreenContainer>
  );
}
