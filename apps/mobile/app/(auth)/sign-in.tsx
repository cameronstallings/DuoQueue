import { useState } from "react";
import { Platform, Text } from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { signInWithApple } from "@/features/auth/appleSignIn";
import { isCaptchaConfigured, TurnstileCaptcha } from "@/features/auth/TurnstileCaptcha";
import { useGoogleSignIn } from "@/features/auth/useGoogleSignIn";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/useTheme";

export default function SignIn() {
  const { colors, spacing, type, radius } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const google = useGoogleSignIn();

  async function handleSignIn() {
    setError(null);
    if (isCaptchaConfigured && !captchaToken) {
      setError("Please complete the verification check.");
      return;
    }
    setLoading(true);
    // Supabase enforces captcha on password sign-in too once bot protection is on,
    // so the token has to be sent here as well or every login is rejected.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });
    setLoading(false);
    if (signInError) {
      setCaptchaToken(null);
      // Supabase's "email_not_confirmed" error (vs. the generic "invalid_credentials"
      // for a wrong password or an unregistered address) only fires once the supplied
      // password is actually correct — but surfacing a DIFFERENT message, or worse,
      // auto-navigating to the code-entry screen, for that one case turns this form
      // into an oracle: try a guessed password against a target email, and a
      // distinguishable response confirms the account exists and is unconfirmed. Every
      // failure gets the same generic text and the same lack of navigation, regardless
      // of which of these it actually was.
      //
      // The legitimate case (someone who closed the app on the code screen and is now
      // stuck, since sign-up won't take a confirmed... er, unconfirmed email and
      // sign-in keeps failing) still has a way out: the message hints at it, and the
      // "Enter confirmation code" button below is always visible, not conditionally
      // rendered on this error, so its presence discloses nothing either.
      console.error("sign-in failed", signInError.code, signInError.message);
      setError(
        "That email and password didn't work. If you just signed up, check your email for a confirmation code.",
      );
    }
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
      <Text style={[type.screenTitle, { color: colors.text }]}>Welcome back</Text>
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
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
      <TurnstileCaptcha onToken={setCaptchaToken} />
      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}

      <Button label="Sign in" onPress={() => void handleSignIn()} loading={loading} />

      {Platform.OS === "ios" && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.button}
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

      {/* Always rendered, never conditioned on the sign-in error above — a stuck
          "signed up but never confirmed" user needs a way back to the code screen, but
          showing this button only when that specific case occurs would itself leak
          which case occurred. See the comment in handleSignIn. */}
      <Button
        label="Enter confirmation code"
        variant="ghost"
        onPress={() => router.push({ pathname: "/(auth)/confirm-email", params: { email } })}
      />
    </ScreenContainer>
  );
}
