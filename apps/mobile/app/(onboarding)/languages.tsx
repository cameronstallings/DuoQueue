import { useState } from "react";
import { router } from "expo-router";
import { LANGUAGE_CODES } from "@duoqueue/shared-types";

import { ChipSelect } from "@/components/ChipSelect";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

export default function LanguagesStep() {
  const { languages, toggleLanguage } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (languages.length === 0) {
      setError("Select at least one language.");
      return;
    }
    setError(null);
    router.push(nextStepPath("languages"));
  }

  return (
    <WizardStep
      step="languages"
      title="What languages do you speak?"
      subtitle="Select all that apply."
      onContinue={handleContinue}
      error={error}
    >
      <ChipSelect
        options={LANGUAGE_CODES.map((code) => ({
          value: code,
          label: languageNames.of(code) ?? code.toUpperCase(),
        }))}
        selected={languages}
        onToggle={toggleLanguage}
      />
    </WizardStep>
  );
}
