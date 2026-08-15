import type { PropsWithChildren } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

import { ONBOARDING_STEPS, type OnboardingStep } from "./steps";

function ProgressBar({ current, total }: { current: number; total: number }) {
  const { colors, radius } = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 4, borderRadius: radius.chip, backgroundColor: colors.border, overflow: "hidden" }}
        >
          {i < current && (
            <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1, backgroundColor: colors.volt }} />
          )}
        </View>
      ))}
    </View>
  );
}

interface WizardStepProps extends PropsWithChildren {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  error?: string | null;
}

export function WizardStep({
  step,
  title,
  subtitle,
  onContinue,
  continueLabel = "Continue",
  continueDisabled,
  loading,
  error,
  children,
}: WizardStepProps) {
  const { colors, spacing, type } = useTheme();
  const stepNumber = ONBOARDING_STEPS.indexOf(step) + 1;
  const signOut = useSessionStore((s) => s.signOut);

  // The only way out of the wizard. (onboarding)/_layout.tsx sends anyone with a session
  // and an unfinished profile straight back here from every route, so without this a
  // half-finished signup is a closed loop: no welcome screen, no sign-in, no way to reach
  // another account. Someone who abandons onboarding on a borrowed phone, or a reviewer
  // who makes a test account and then wants the demo account back, is otherwise stuck
  // reinstalling the app.
  function handleSignOut() {
    Alert.alert("Sign out?", "Your profile is not finished yet. You can sign back in and pick up where you left off.", [
      { text: "Keep going", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <ScreenContainer>
      <ProgressBar current={stepNumber} total={ONBOARDING_STEPS.length} />
      <Text style={[type.caption, { color: colors.textMuted }]}>
        STEP {stepNumber} OF {ONBOARDING_STEPS.length}
      </Text>
      <Text style={[type.screenTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[type.body, { color: colors.textMuted }]}>{subtitle}</Text> : null}

      <View style={{ gap: spacing.md }}>{children}</View>

      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}

      <Button label={continueLabel} onPress={onContinue} disabled={continueDisabled} loading={loading} />

      <Pressable onPress={handleSignOut} hitSlop={12} accessibilityRole="button" style={{ alignSelf: "center" }}>
        <Text style={[type.caption, { color: colors.textMuted }]}>Sign out</Text>
      </Pressable>
    </ScreenContainer>
  );
}
