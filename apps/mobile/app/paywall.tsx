import { Text } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useTheme } from "@/theme/useTheme";

export default function PaywallScreen() {
  const { colors, spacing } = useTheme();

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>DuoQueue+</Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
        RevenueCat-powered subscriptions land in Phase 4 — Monthly $7.99 / Annual $47.99, shown side by
        side, with a 7-day free trial.
      </Text>
      {/* Required by the product spec: never trap the user on the paywall. */}
      <Button label="Continue with Free" variant="ghost" onPress={() => router.back()} />
    </ScreenContainer>
  );
}
