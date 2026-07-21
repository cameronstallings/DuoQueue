import { useState } from "react";
import { router } from "expo-router";
import { displayNameSchema, MAX_PROFILE_PHOTOS } from "@duoqueue/shared-types";

import { TextField } from "@/components/TextField";
import { PhotoGrid } from "@/features/onboarding/PhotoGrid";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";

export default function DisplayNameStep() {
  const { displayName, photoUris, setDisplayName, setPhotoUris } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    const result = displayNameSchema.safeParse(displayName);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a display name.");
      return;
    }
    if (photoUris.length === 0) {
      setError("Add at least one photo.");
      return;
    }
    setError(null);
    router.push(nextStepPath("display-name"));
  }

  return (
    <WizardStep
      step="display-name"
      title="Let's set up your profile"
      subtitle={`Add up to ${MAX_PROFILE_PHOTOS} photos and pick a display name.`}
      onContinue={handleContinue}
      error={error}
    >
      <PhotoGrid uris={photoUris} onChange={setPhotoUris} />
      <TextField label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={30} />
    </WizardStep>
  );
}
