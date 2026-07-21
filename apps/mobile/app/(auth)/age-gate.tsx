import { useState } from "react";
import { Platform, Text } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { dobSchema } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useTheme } from "@/theme/useTheme";

const EIGHTEEN_YEARS_AGO = new Date();
EIGHTEEN_YEARS_AGO.setFullYear(EIGHTEEN_YEARS_AGO.getFullYear() - 18);

export default function AgeGate() {
  const { colors, spacing } = useTheme();
  const [dob, setDob] = useState<Date>(EIGHTEEN_YEARS_AGO);
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    const iso = dob.toISOString().slice(0, 10);
    const result = dobSchema.safeParse(iso);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid date of birth.");
      return;
    }
    setError(null);
    router.push({ pathname: "/(auth)/sign-up", params: { dob: iso } });
  }

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>Confirm your age</Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
        DuoQueue is for players 18 and older. Your date of birth is kept private — only your age is
        ever shown on your profile.
      </Text>

      <DateTimePicker
        value={dob}
        mode="date"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        maximumDate={EIGHTEEN_YEARS_AGO}
        onChange={(_event, selected) => selected && setDob(selected)}
      />

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      <Button label="Continue" onPress={handleContinue} />
    </ScreenContainer>
  );
}
