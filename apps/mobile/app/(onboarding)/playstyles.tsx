import { useState } from "react";
import { router } from "expo-router";
import { PLAYSTYLE_TAGS } from "@duoqueue/shared-types";

import { ChipSelect } from "@/components/ChipSelect";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";

const LABELS: Record<(typeof PLAYSTYLE_TAGS)[number], string> = {
  chill: "Chill",
  competitive: "Competitive",
  mic_required: "Mic required",
  no_mic: "No mic",
  late_night: "Late night",
  weekend_warrior: "Weekend warrior",
  casual_coop: "Casual co-op",
  grinder: "Grinder",
  team_player: "Team player",
  solo_queue: "Solo queue",
};

const MAX_PLAYSTYLES = 6;

export default function PlaystylesStep() {
  const { playstyles, togglePlaystyle } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  function handleToggle(value: (typeof PLAYSTYLE_TAGS)[number]) {
    if (!playstyles.includes(value) && playstyles.length >= MAX_PLAYSTYLES) {
      setError(`Choose up to ${MAX_PLAYSTYLES} tags.`);
      return;
    }
    setError(null);
    togglePlaystyle(value);
  }

  function handleContinue() {
    router.push(nextStepPath("playstyles"));
  }

  return (
    <WizardStep
      step="playstyles"
      title="How do you like to play?"
      subtitle={`Optional — pick up to ${MAX_PLAYSTYLES}.`}
      onContinue={handleContinue}
      error={error}
      continueLabel={playstyles.length === 0 ? "Skip" : "Continue"}
    >
      <ChipSelect
        options={PLAYSTYLE_TAGS.map((value) => ({ value, label: LABELS[value] }))}
        selected={playstyles}
        onToggle={handleToggle}
      />
    </WizardStep>
  );
}
