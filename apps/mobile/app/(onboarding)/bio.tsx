import { Text } from "react-native";
import { router } from "expo-router";
import { BIO_MAX_LENGTH } from "@duoqueue/shared-types";

import { TextField } from "@/components/TextField";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useTheme } from "@/theme/useTheme";

export default function BioStep() {
  const { colors } = useTheme();
  const { bio, setBio } = useOnboardingStore();

  function handleContinue() {
    router.push(nextStepPath("bio"));
  }

  return (
    <WizardStep
      step="bio"
      title="Write a short bio"
      subtitle="Optional — tell people what you're looking for."
      onContinue={handleContinue}
      continueLabel={bio.length === 0 ? "Skip" : "Continue"}
    >
      <TextField
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
        maxLength={BIO_MAX_LENGTH}
        style={{ minHeight: 100, textAlignVertical: "top" }}
      />
      <Text style={{ color: colors.textMuted, textAlign: "right" }}>
        {bio.length}/{BIO_MAX_LENGTH}
      </Text>
    </WizardStep>
  );
}
