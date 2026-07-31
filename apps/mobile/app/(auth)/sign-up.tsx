import { useEffect, useState } from "react";
import { Text } from "react-native";
import * as Localization from "expo-localization";
import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { isCaptchaConfigured, TurnstileCaptcha } from "@/features/auth/TurnstileCaptcha";
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

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
    if (isCaptchaConfigured && !captchaToken) {
      setError("Please complete the verification check.");
      return;
    }

    setLoading(true);
    const timezone = Localization.getCalendars()[0]?.timeZone ?? "UTC";

    // dob/timezone go in as user metadata rather than a follow-up UPDATE: when email
    // confirmation is on, signUp returns no session, so an authenticated write here
    // would be impossible. handle_new_user() (0030) reads them while creating the row.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { dob, timezone },
        ...(captchaToken ? { captchaToken } : {}),
      },
    });

    setLoading(false);

    if (signUpError) {
      // A token is single-use — force a fresh challenge before the next attempt.
      setCaptchaToken(null);
      setError(signUpError.message);
      return;
    }

    // No session means Supabase is (correctly) holding the account until the address
    // is confirmed. That's the expected path with email confirmation enabled, not an
    // error — the session arrives via onAuthStateChange once they click the link.
    if (!data.session) {
      setAwaitingConfirmation(true);
      return;
    }

    await refreshProfile();
  }

  if (awaitingConfirmation) {
    return (
      <ScreenContainer>
        <Logo width={56} />
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>Check your email</Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          We sent a confirmation link to {email}. Confirm your address, then come back here to finish
          setting up your profile.
        </Text>
        <Button label="Back to sign in" variant="secondary" onPress={() => router.replace("/(auth)/sign-in")} />
      </ScreenContainer>
    );
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
      <TurnstileCaptcha onToken={setCaptchaToken} />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      <Button label="Create account" onPress={() => void handleSignUp()} loading={loading} />
    </ScreenContainer>
  );
}
