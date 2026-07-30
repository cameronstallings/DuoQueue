import { useEffect, useState } from "react";
import { Text } from "react-native";
import * as Localization from "expo-localization";
import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function SignUp() {
  const { colors, spacing } = useTheme();
  const { dob } = useLocalSearchParams<{ dob?: string }>();
  const refreshProfile = useSessionStore((s) => s.refreshProfile);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dob) router.replace("/(auth)/age-gate");
  }, [dob]);

  async function handleSignUp() {
    if (!dob) return;
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError || !data.session) {
      setLoading(false);
      setError(signUpError?.message ?? "Sign-up did not return a session. Please try again.");
      return;
    }

    const timezone = Localization.getCalendars()[0]?.timeZone ?? "UTC";
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ dob, timezone })
      .eq("id", data.session.user.id);

    setLoading(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }

    await refreshProfile();
  }

  return (
    <ScreenContainer>
      <Logo width={56} />
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>Create your account</Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
        Next you&apos;ll set up your profile — games, shows, and how you like to play.
      </Text>

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
      />
      <TextField
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        textContentType="newPassword"
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      <Button label="Create account" onPress={() => void handleSignUp()} loading={loading} />
    </ScreenContainer>
  );
}
