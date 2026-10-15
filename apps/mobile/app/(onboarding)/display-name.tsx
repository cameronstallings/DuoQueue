import { useEffect, useState } from "react";
import * as Localization from "expo-localization";
import { router } from "expo-router";
import { displayNameSchema } from "@duoqueue/shared-types";

import { TextField } from "@/components/TextField";
import { NAME_COPY, welcomeTitle } from "@/features/auth/frontDoorCopy";
import { CardPreview } from "@/features/onboarding/CardPreview";
import { firstName } from "@/features/onboarding/commitDraft";
import { draftPhotoExists, keepDraftPhoto } from "@/features/onboarding/draftPhoto";
import { languagesFromLocales, regionFromTimeZone } from "@/features/onboarding/localePrefill";
import { PicturePicker } from "@/features/onboarding/PicturePicker";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { assertPhotoWithinSizeLimit } from "@/features/profile/usePhotoUpload";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";

/**
 * Step 1: the player name, with the card filling in live under it, and the optional picture.
 *
 * The preview never implies the name is unique or reserved: it is the name on the card, nothing
 * more (display names are not unique).
 */
export default function DisplayNameStep() {
  const displayName = useOnboardingStore((s) => s.displayName);
  const displayNameSeeded = useOnboardingStore((s) => s.displayNameSeeded);
  const profilePhotoUri = useOnboardingStore((s) => s.profilePhotoUri);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);
  const setProfilePhotoUri = useOnboardingStore((s) => s.setProfilePhotoUri);
  const seedDisplayName = useOnboardingStore((s) => s.seedDisplayName);
  const prefillFromDevice = useOnboardingStore((s) => s.prefillFromDevice);
  const signedIn = useSessionStore((s) => s.status === "signed_in");
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

  // An Apple-first player (signed in, no draft) never saw the intro, which is where the phone's
  // guesses usually go in. Once per draft, never over a chosen answer (the store's rule), so this
  // is a no-op for everyone who did see it.
  useEffect(() => {
    if (!signedIn) return;
    prefillFromDevice({
      region: regionFromTimeZone(Localization.getCalendars()[0]?.timeZone),
      languages: languagesFromLocales(Localization.getLocales()),
    });
  }, [signedIn, prefillFromDevice]);

  // A draft can sit for days, and the kept picture with it; a reinstall or a cleared folder takes
  // the file but not the draft's uri. An empty slot is honest; a broken image is not.
  useEffect(() => {
    if (!profilePhotoUri) return;
    let cancelled = false;
    void draftPhotoExists(profilePhotoUri).then((exists) => {
      if (!cancelled && !exists) setProfilePhotoUri(null);
    });
    return () => {
      cancelled = true;
    };
  }, [profilePhotoUri, setProfilePhotoUri]);

  // "Welcome, {first name}" only for an Apple-first account whose name Apple shared (D3). Every
  // other player is asked for it.
  const seededFirstName = displayNameSeeded && profileDisplayName ? firstName(profileDisplayName) : "";
  const title = seededFirstName ? welcomeTitle(seededFirstName) : NAME_COPY.title;

  // Checked here, on the step where the picture was chosen, so a too-large picture is never
  // first reported on the last step. Then copied out of the picker's cache, which iOS may purge
  // before a draft is saved (draftPhoto.ts).
  async function handlePicked(uri: string) {
    try {
      await assertPhotoWithinSizeLimit(uri);
      setProfilePhotoUri(await keepDraftPhoto(uri));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That picture can't be used. Try another one.");
    }
  }

  // Only the name is required. The picture is optional, and Continue moves on without one.
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
    <WizardStep step="display-name" title={title} subtitle={NAME_COPY.subtitle} onContinue={handleContinue} error={error}>
      <TextField
        label={NAME_COPY.field}
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={30}
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={handleContinue}
      />
      <CardPreview name={displayName} />
      <PicturePicker
        uri={profilePhotoUri}
        onPick={(uri) => void handlePicked(uri)}
        onRemove={() => setProfilePhotoUri(null)}
      />
    </WizardStep>
  );
}
