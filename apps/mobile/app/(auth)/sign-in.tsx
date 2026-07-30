import { useState } from "react";
import { Platform, Text } from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { signInWithApple } from "@/features/auth/appleSignIn";
import { useGoogleSignIn } from "@/features/auth/useGoogleSignIn";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/useTheme";

export default function SignIn() {
  const { colors, spacing } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const google = useGoogleSignIn();

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError(signInError.message);
  }

  async function handleAppleSignIn() {
    setError(null);
    try {
      await signInWithApple();
    } catch (err) {
      if (err instanceof Error && err.message.includes("ERR_REQUEST_CANCELED")) return;
      setError(err instanceof Error ? err.message : "Apple sign-in failed.");
    }
  }

  return (
    <ScreenContainer>
      <Logo width={56} />
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>Welcome back</Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
        Sign in to find your next gaming duo.
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
        textContentType="password"
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      <Button label="Sign in" onPress={() => void handleSignIn()} loading={loading} />

      {Platform.OS === "ios" && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={{ height: 48 }}
          onPress={() => void handleAppleSignIn()}
        />
      )}

      <Button
        label="Continue with Google"
        variant="secondary"
        disabled={!google.request}
        loading={google.signingIn}
        onPress={() => void google.promptAsync()}
      />

      <Button
        label="Create an account"
        variant="ghost"
        onPress={() => router.push("/(auth)/age-gate")}
      />
    </ScreenContainer>
  );
}
