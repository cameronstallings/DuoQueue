import { useState } from "react";
import { router } from "expo-router";
import { GENDERS } from "@duoqueue/shared-types";

import { ChipSelect } from "@/components/ChipSelect";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";

const LABELS: Record<(typeof GENDERS)[number], string> = {
  male: "Male",
  female: "Female",
  non_binary: "Non-binary",
  prefer_not_to_say: "Prefer not to say",
};

export default function GenderStep() {
  const { gender, setGender } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!gender) {
      setError("Select an option to continue.");
      return;
    }
    setError(null);
    router.push(nextStepPath("gender"));
  }

  return (
    <WizardStep step="gender" title="What's your gender?" onContinue={handleContinue} error={error}>
      <ChipSelect
        options={GENDERS.map((value) => ({ value, label: LABELS[value] }))}
        selected={gender ? [gender] : []}
        onToggle={setGender}
      />
    </WizardStep>
  );
}
