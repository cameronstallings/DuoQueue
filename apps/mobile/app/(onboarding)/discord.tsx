import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { discordUsernameSchema } from "@duoqueue/shared-types";

import { TextField } from "@/components/TextField";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useInviteStore } from "@/store/invite-store";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useTheme } from "@/theme/useTheme";

export default function DiscordStep() {
  const { colors, type } = useTheme();
  const { discordUsername, setDiscordUsername, submit, submitting, reset } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    if (discordUsername) {
      const result = discordUsernameSchema.safeParse(discordUsername);
      if (!result.success) {
        setError(result.error.issues[0]?.message ?? "Enter a valid Discord username.");
        return;
      }
    }
    setError(null);
    try {
      await submit();
      // A second onboarding pass in the same app session (delete account -> sign up
      // again, or QA testing back-to-back) should start blank, not pre-filled with
      // this account's photos/games/prompts.
      reset();
      // Refreshing the session profile happens on the welcome/arrival screen instead of
      // here — (onboarding)/_layout.tsx redirects away the instant onboarding_completed
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
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <WizardStep
      step="discord"
      title="Last step: Discord"
      subtitle="Kept private. You choose per-match whether to share it in chat."
      onContinue={() => void handleFinish()}
      continueLabel="Finish"
      loading={submitting}
      error={error}
    >
      <TextField
        label="Discord username (optional)"
        value={discordUsername}
        onChangeText={setDiscordUsername}
        autoCapitalize="none"
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
