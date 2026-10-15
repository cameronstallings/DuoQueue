import { useState } from "react";
import { router } from "expo-router";
import { LANGUAGE_CODES } from "@duoqueue/shared-types";

import { ChipSelect } from "@/components/ChipSelect";
import { LANGUAGES_COPY } from "@/features/auth/frontDoorCopy";
import { LANGUAGE_LABELS } from "@/features/onboarding/language-labels";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";

/**
 * Step 3: languages, usually already holding the phone's own (the intro's prefill), and said so
 * while any are chosen. Editable like any other answer.
 */
export default function LanguagesStep() {
  const languages = useOnboardingStore((s) => s.languages);
  const toggleLanguage = useOnboardingStore((s) => s.toggleLanguage);
  const devicePrefilled = useOnboardingStore((s) => s.devicePrefilled);
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
      subtitle={devicePrefilled && languages.length > 0 ? LANGUAGES_COPY.prefilledSubtitle : LANGUAGES_COPY.subtitle}
      onContinue={handleContinue}
      error={error}
    >
      <ChipSelect
        options={LANGUAGE_CODES.map((code) => ({
          value: code,
          label: LANGUAGE_LABELS[code],
        }))}
        selected={languages}
        onToggle={toggleLanguage}
      />
    </WizardStep>
  );
}
