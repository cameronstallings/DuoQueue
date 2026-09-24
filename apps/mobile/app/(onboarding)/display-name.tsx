import { useEffect, useState } from "react";
import { router } from "expo-router";
import { displayNameSchema } from "@duoqueue/shared-types";

import { TextField } from "@/components/TextField";
import { ProfileHeaderPhotoPicker } from "@/features/onboarding/ProfileHeaderPhotoPicker";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";

export default function DisplayNameStep() {
  const { displayName, profilePhotoUri, headerPhotoUri, setDisplayName, setProfilePhotoUri, setHeaderPhotoUri } =
    useOnboardingStore();
  const seedDisplayName = useOnboardingStore((s) => s.seedDisplayName);
  const profileDisplayName = useSessionStore((s) => s.profile?.display_name ?? null);
  const [error, setError] = useState<string | null>(null);

  // The name Apple shared, which complete_signup already stored on the profile, goes into the
  // field instead of the user being asked for it a second time (Guideline 4.0). Only into an
  // empty field and only once per pass; the rules are in displayNameSeed.ts. The wizard's last
  // step writes this field over profiles.display_name, so whatever is here is what the profile
  // ends up with: seeding it is what keeps the stored name unless the user changes it.
  useEffect(() => {
    seedDisplayName(profileDisplayName);
  }, [profileDisplayName, seedDisplayName]);

  function handleContinue() {
    const result = displayNameSchema.safeParse(displayName);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a display name.");
      return;
    }
    if (!profilePhotoUri || !headerPhotoUri) {
      setError("Add a profile picture and a cover photo.");
      return;
    }
    setError(null);
    router.push(nextStepPath("display-name"));
  }

  return (
    <WizardStep
      step="display-name"
      title="Let's set up your profile"
      subtitle="Add a profile picture, a cover photo, and pick a display name."
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
