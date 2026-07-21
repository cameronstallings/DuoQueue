import type { PropsWithChildren } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useTheme } from "@/theme/useTheme";

import { ONBOARDING_STEPS, type OnboardingStep } from "./steps";

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
  const { colors, spacing } = useTheme();
  const stepNumber = ONBOARDING_STEPS.indexOf(step) + 1;

  return (
    <ScreenContainer>
      <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>
        STEP {stepNumber} OF {ONBOARDING_STEPS.length}
      </Text>
      <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.textMuted }}>{subtitle}</Text> : null}

      <View style={{ gap: spacing.md }}>{children}</View>

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      <Button label={continueLabel} onPress={onContinue} disabled={continueDisabled} loading={loading} />
    </ScreenContainer>
  );
}
