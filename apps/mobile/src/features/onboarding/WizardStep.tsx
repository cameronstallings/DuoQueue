import type { PropsWithChildren } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DELETE_THIS_SIGN_IN_LABEL } from "@/features/auth/deleteThisSignIn";
import { useDeleteThisSignIn } from "@/features/auth/useDeleteThisSignIn";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

import { ONBOARDING_STEPS, type OnboardingStep } from "./steps";
import { WIZARD_EXIT_LINK_LABEL, WIZARD_EXIT_SHEET } from "./wizardExit";

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
  const { confirmDeleteThisSignIn, deleting } = useDeleteThisSignIn();

  // The only way out of the wizard. (onboarding)/_layout.tsx sends anyone with a session
  // and an unfinished profile straight back here from every route, so without this a
  // half-finished signup is a closed loop: no welcome screen, no sign-in, no way to reach
  // another account. Someone who abandons onboarding on a borrowed phone, or a reviewer
  // who makes a test account and then wants the demo account back, is otherwise stuck
  // reinstalling the app.
  //
  // It is also the only way to DELETE the account from here. Settings > Account is behind
  // the tabs layout, which is behind a finished profile, so without the third button an
  // account (an Apple one especially, since it exists before any of this was filled in) could
  // not be removed until ten steps and two photos had been completed. The delete goes through
  // its own confirmation before anything happens.
  function handleExit() {
    Alert.alert(WIZARD_EXIT_SHEET.title, WIZARD_EXIT_SHEET.message, [
      { text: WIZARD_EXIT_SHEET.keepGoing, style: "cancel" },
      { text: WIZARD_EXIT_SHEET.signOut, onPress: () => void signOut() },
      { text: DELETE_THIS_SIGN_IN_LABEL, style: "destructive", onPress: confirmDeleteThisSignIn },
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

      <Button
        label={continueLabel}
        onPress={onContinue}
        disabled={continueDisabled || deleting}
        loading={loading}
      />

      <Pressable
        onPress={handleExit}
        disabled={deleting}
        hitSlop={12}
        accessibilityRole="button"
        style={{ alignSelf: "center" }}
      >
        <Text style={[type.caption, { color: colors.textMuted }]}>{deleting ? "Deleting..." : WIZARD_EXIT_LINK_LABEL}</Text>
      </Pressable>
    </ScreenContainer>
  );
}
