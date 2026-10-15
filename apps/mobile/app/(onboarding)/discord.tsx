import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { discordUsernameSchema } from "@duoqueue/shared-types";

import { TextField } from "@/components/TextField";
import { COMMIT_COPY, DISCORD_COPY } from "@/features/auth/frontDoorCopy";
import { firstIncompleteStep } from "@/features/onboarding/commitDraft";
import { stepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { toUserMessage } from "@/lib/userMessage";
import { useInviteStore } from "@/store/invite-store";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

/** The same fallback the store's own `submitError` uses (onboarding-store.ts). */
const FINISH_FAILED = "Something went wrong finishing your profile.";

/**
 * Step 8: the Discord name, optional and private.
 *
 * Two endings since 1.0.2. Signed out (the draft), Continue marks the card ready and opens "Save
 * your card", where the account is made and the commit writes everything (commit-store.ts).
 * Signed in (an Apple-first account, made before the card), there is nothing to save to, so this
 * step still finishes the profile itself, as in 1.0.1: "Finish" submits.
 */
export default function DiscordStep() {
  const { colors, type } = useTheme();
  const signedIn = useSessionStore((s) => s.status === "signed_in");
  const discordUsername = useOnboardingStore((s) => s.discordUsername);
  const setDiscordUsername = useOnboardingStore((s) => s.setDiscordUsername);
  const setReadyToSave = useOnboardingStore((s) => s.setReadyToSave);
  const submit = useOnboardingStore((s) => s.submit);
  const submitting = useOnboardingStore((s) => s.submitting);
  const reset = useOnboardingStore((s) => s.reset);
  const [error, setError] = useState<string | null>(null);

  // The trimmed value is what gets written (onboarding-store.ts), so it is what gets checked: a
  // stray space after a valid name must not fail here.
  function validate(): boolean {
    const trimmed = discordUsername.trim();
    if (trimmed) {
      const result = discordUsernameSchema.safeParse(trimmed);
      if (!result.success) {
        setError(result.error.issues[0]?.message ?? "Enter a valid Discord username.");
        return false;
      }
    }
    setError(null);
    return true;
  }

  function handleContinue() {
    if (!validate()) return;
    setReadyToSave(true);
    router.push("/(onboarding)/save");
  }

  async function handleFinish() {
    if (!validate()) return;

    // A step skipped on the way (a resumed draft, a Back past a requirement) would otherwise
    // reach the server as an incomplete card; send the player to it instead.
    const missing = firstIncompleteStep(useOnboardingStore.getState());
    if (missing) {
      useToastStore.getState().showToast(DISCORD_COPY.finishToast, "info");
      router.push(stepPath(missing));
      return;
    }

    try {
      const { pictureUploadFailed } = await submit();
      // A second onboarding pass in the same app session (delete account -> sign up
      // again, or QA testing back-to-back) should start blank, not pre-filled with
      // this account's photos/games/prompts.
      reset();
      if (pictureUploadFailed) {
        useToastStore.getState().showToast(COMMIT_COPY.pictureFailed, "error");
      }
      // Refreshing the session profile happens on the welcome/arrival screen instead of
      // here: (onboarding)/_layout.tsx redirects away the instant onboarding_completed
      // flips true, which would skip this celebratory screen entirely if we refreshed now.
      //
      // Somebody who arrived from an invite gets a different last screen. "You're all set,
      // time to find people worth queueing up with" is the wrong sentence for a person who
      // came because one specific friend asked them to: the friend is right there, and
      // sending them off to search a deck for somebody they already know would waste the
      // only connection this install starts with.
      const invited = useInviteStore.getState().arrival !== null;
      router.replace(invited ? "/invited" : "/welcome");
    } catch (err) {
      // Never the raw message: PostgrestError extends Error, so `err.message` would put
      // Postgres's own text (a constraint name, an RLS line) on screen. toUserMessage keeps the
      // sentences this codebase wrote (a P0001 hint, our own Errors) and hides the rest.
      setError(toUserMessage(err, FINISH_FAILED));
    }
  }

  return (
    <WizardStep
      step="discord"
      title={DISCORD_COPY.title}
      subtitle={DISCORD_COPY.subtitle}
      onContinue={signedIn ? () => void handleFinish() : handleContinue}
      continueLabel={signedIn ? DISCORD_COPY.finish : DISCORD_COPY.continue}
      loading={submitting}
      error={error}
    >
      <TextField
        label="Discord username (optional)"
        value={discordUsername}
        onChangeText={setDiscordUsername}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="yourname"
        maxLength={32}
      />
      <Text style={[type.caption, { color: colors.textMuted }]}>
        Your Discord is never shown automatically, only when you tap &quot;Share my Discord&quot; in a
        match chat.
      </Text>
    </WizardStep>
  );
}
