import { useState } from "react";
import { router } from "expo-router";
import { displayNameSchema } from "@duoqueue/shared-types";

import { TextField } from "@/components/TextField";
import { ProfileHeaderPhotoPicker } from "@/features/onboarding/ProfileHeaderPhotoPicker";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";

export default function DisplayNameStep() {
  const { displayName, profilePhotoUri, headerPhotoUri, setDisplayName, setProfilePhotoUri, setHeaderPhotoUri } =
    useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    const result = displayNameSchema.safeParse(displayName);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a display name.");
      return;
    }
    if (!profilePhotoUri || !headerPhotoUri) {
      setError("Add a profile picture and a header picture.");
      return;
    }
    setError(null);
    router.push(nextStepPath("display-name"));
  }

  return (
    <WizardStep
      step="display-name"
      title="Let's set up your profile"
      subtitle="Add a profile picture, a header picture, and pick a display name."
      onContinue={handleContinue}
      error={error}
    >
      <ProfileHeaderPhotoPicker
        profilePhotoUri={profilePhotoUri}
        headerPhotoUri={headerPhotoUri}
        onChangeProfilePhoto={setProfilePhotoUri}
        onChangeHeaderPhoto={setHeaderPhotoUri}
      />
      <TextField label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={30} />
    </WizardStep>
  );
}
