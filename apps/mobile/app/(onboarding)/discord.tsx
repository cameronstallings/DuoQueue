import { useState } from "react";
import { Text } from "react-native";
import { discordUsernameSchema } from "@duoqueue/shared-types";

import { TextField } from "@/components/TextField";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function DiscordStep() {
  const { colors } = useTheme();
  const { discordUsername, setDiscordUsername, submit, submitting } = useOnboardingStore();
  const refreshProfile = useSessionStore((s) => s.refreshProfile);
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
      await refreshProfile();
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
      />
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        Your Discord is never shown automatically — only when you tap &quot;Share my Discord&quot; in a
        match chat.
      </Text>
    </WizardStep>
  );
}
