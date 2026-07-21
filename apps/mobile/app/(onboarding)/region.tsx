import { useState } from "react";
import { router } from "expo-router";
import { REGIONS } from "@duoqueue/shared-types";

import { ChipSelect } from "@/components/ChipSelect";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";

const LABELS: Record<(typeof REGIONS)[number], string> = {
  na_east: "NA East",
  na_west: "NA West",
  sa: "South America",
  eu: "Europe",
  mena: "MENA",
  africa: "Africa",
  asia: "Asia",
  sea: "SEA",
  oce: "Oceania",
};

export default function RegionStep() {
  const { region, setRegion } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!region) {
      setError("Select your region to continue.");
      return;
    }
    setError(null);
    router.push(nextStepPath("region"));
  }

  return (
    <WizardStep step="region" title="Where are you based?" onContinue={handleContinue} error={error}>
      <ChipSelect
        options={REGIONS.map((value) => ({ value, label: LABELS[value] }))}
        selected={region ? [region] : []}
        onToggle={setRegion}
      />
    </WizardStep>
  );
}
