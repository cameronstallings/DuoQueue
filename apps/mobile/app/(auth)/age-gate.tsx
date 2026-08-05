import { useState } from "react";
import { Platform, Text } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { dobSchema, MIN_AGE } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useTheme } from "@/theme/useTheme";

const MIN_AGE_CUTOFF = new Date();
MIN_AGE_CUTOFF.setFullYear(MIN_AGE_CUTOFF.getFullYear() - MIN_AGE);

export default function AgeGate() {
  const { colors, scheme, spacing, type } = useTheme();
  const [dob, setDob] = useState<Date>(MIN_AGE_CUTOFF);
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
      <Logo width={56} />
      <Text style={[type.screenTitle, { color: colors.text }]}>Confirm your age</Text>
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
        DuoQueue is for players {MIN_AGE} and older. Your date of birth is kept private — only your age
        is ever shown on your profile.
      </Text>

      {/* This is a NATIVE view, so it does not inherit the app's theme — left alone it
          follows the DEVICE's appearance. A phone in dark mode rendered near-white
          wheel text onto Paper's light background, which is how the birthdate ended up
          practically invisible. themeVariant pins the picker to the app's scheme, and
          textColor pins the iOS spinner's wheel text to our own ink. Both are iOS-only;
          Android's `default` display opens a system dialog that themes itself. */}
      <DateTimePicker
        value={dob}
        mode="date"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        themeVariant={scheme === "dark" ? "dark" : "light"}
        textColor={colors.text}
        maximumDate={MIN_AGE_CUTOFF}
        onChange={(_event, selected) => selected && setDob(selected)}
      />

      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}

      <Button label="Continue" onPress={handleContinue} />
    </ScreenContainer>
  );
}
