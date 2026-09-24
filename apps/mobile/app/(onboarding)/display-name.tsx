import { useEffect, useState } from "react";
import { router } from "expo-router";
import { displayNameSchema } from "@duoqueue/shared-types";

import { TextField } from "@/components/TextField";
import { PicturePicker } from "@/features/onboarding/PicturePicker";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { assertPhotoWithinSizeLimit } from "@/features/profile/usePhotoUpload";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";

export default function DisplayNameStep() {
  const { displayName, profilePhotoUri, setDisplayName, setProfilePhotoUri } = useOnboardingStore();
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

  // Checked here, on the step where the picture was chosen, so a too-large picture is never
  // first reported on the last step.
  async function handlePicked(uri: string) {
    try {
      await assertPhotoWithinSizeLimit(uri);
      setProfilePhotoUri(uri);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That picture can't be used. Try another one.");
    }
  }

  // Only the name is required. The picture is optional, so "Skip for now" is this same handler.
  function handleContinue() {
    const result = displayNameSchema.safeParse(displayName);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a display name.");
      return;
    }
    setError(null);
    router.push(nextStepPath("display-name"));
  }

  return (
    <WizardStep
      step="display-name"
      title="Let's set up your card"
      subtitle="Pick the name other players will see. A picture is optional."
      onContinue={handleContinue}
      error={error}
    >
      <TextField label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={30} />
      <PicturePicker
        uri={profilePhotoUri}
        onPick={(uri) => void handlePicked(uri)}
        onRemove={() => setProfilePhotoUri(null)}
        onSkip={handleContinue}
      />
    </WizardStep>
  );
}
