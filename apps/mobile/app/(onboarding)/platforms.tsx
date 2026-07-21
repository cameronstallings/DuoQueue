import { useState } from "react";
import { router } from "expo-router";
import { PLATFORMS } from "@duoqueue/shared-types";

import { ChipSelect } from "@/components/ChipSelect";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";

const LABELS: Record<(typeof PLATFORMS)[number], string> = {
  pc: "PC",
  playstation: "PlayStation",
  xbox: "Xbox",
  switch: "Switch",
  mobile: "Mobile",
};

export default function PlatformsStep() {
  const { platforms, togglePlatform } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (platforms.length === 0) {
      setError("Select at least one platform.");
      return;
    }
    setError(null);
    router.push(nextStepPath("platforms"));
  }

  return (
    <WizardStep step="platforms" title="What do you play on?" onContinue={handleContinue} error={error}>
      <ChipSelect
        options={PLATFORMS.map((value) => ({ value, label: LABELS[value] }))}
        selected={platforms}
        onToggle={togglePlatform}
      />
    </WizardStep>
  );
}
