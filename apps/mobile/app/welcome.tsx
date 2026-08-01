import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeIn, FadeInUp, ZoomIn } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { hapticSuccess } from "@/lib/haptics";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function WelcomeScreen() {
  const { colors, spacing, type } = useTheme();
  const displayName = useOnboardingStore((s) => s.displayName);
  const refreshProfile = useSessionStore((s) => s.refreshProfile);

  useEffect(() => {
    hapticSuccess();
  }, []);

  async function handleContinue() {
    await refreshProfile();
    router.replace("/(tabs)");
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
        <Animated.View entering={ZoomIn.springify().delay(100)}>
          <Logo width={220} variant="wordmark" />
        </Animated.View>

        <Animated.Text
          entering={FadeIn.duration(400).delay(250)}
          style={[type.screenTitle, { color: colors.text, textAlign: "center" }]}
        >
          You&apos;re all set{displayName ? `, ${displayName}` : ""}!
        </Animated.Text>

        <Animated.Text
          entering={FadeIn.duration(400).delay(400)}
          style={[type.body, { color: colors.textMuted, textAlign: "center" }]}
        >
          Your profile is live. Time to find some people worth queueing up with.
        </Animated.Text>

        <Animated.View entering={FadeInUp.duration(400).delay(550)} style={{ width: "100%" }}>
          <Button label="Start swiping" onPress={() => void handleContinue()} />
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}
