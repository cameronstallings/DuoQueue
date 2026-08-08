import { useEffect, useState } from "react";
import { Text } from "react-native";
import * as Localization from "expo-localization";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { setPendingConfirmationEmail } from "@/features/auth/pendingConfirmation";
import { isCaptchaConfigured, TurnstileCaptcha } from "@/features/auth/TurnstileCaptcha";
import { LEGAL_URLS } from "@/lib/legal";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

// Mirrors the Supabase Auth password policy for this project (minimum length 10, plus
// lowercase + uppercase + digit). Keeping them in sync matters: if the client is more
// permissive, the user gets a generic API error instead of a message telling them what
// to fix. Change both together.
const PASSWORD_MIN_LENGTH = 10;

function describePasswordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include a lowercase letter, an uppercase letter, and a number.";
  }
  return null;
}

export default function SignUp() {
  const { colors, spacing, type } = useTheme();
  const { dob } = useLocalSearchParams<{ dob?: string }>();
  const refreshProfile = useSessionStore((s) => s.refreshProfile);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dob) router.replace("/(auth)/age-gate");
  }, [dob]);

  async function handleSignUp() {
    if (!dob) return;
    setError(null);

    const passwordProblem = describePasswordProblem(password);
    if (passwordProblem) {
      setError(passwordProblem);
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

    // No session means Supabase is (correctly) holding the account until the address is
    // confirmed — the expected path with confirmations on, not an error. The session is
    // issued by verifyOtp() on the next screen, not by anything happening in the inbox.
    if (!data.session) {
      // Remembered across a cold start: confirming means leaving for the inbox, and
      // coming back to the sign-in screen instead of the code screen reads as the app
      // having forgotten the account they just created.
      await setPendingConfirmationEmail(email);
      router.replace({ pathname: "/(auth)/confirm-email", params: { email } });
      return;
    }

    await refreshProfile();
  }

  return (
    <ScreenContainer>
      <Logo width={56} />
      <Text style={[type.screenTitle, { color: colors.text }]}>Create your account</Text>
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
        Next you&apos;ll set up your profile: games, shows, and how you like to play.
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
      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}

      <Text style={[type.caption, { color: colors.textMuted }]}>
        By creating an account, you agree to our{" "}
        <Text style={{ color: colors.voltDim }} onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.termsOfService)}>
          Terms of Service
        </Text>{" "}
        and{" "}
        <Text style={{ color: colors.voltDim }} onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.privacyPolicy)}>
          Privacy Policy
        </Text>
        . We&apos;ll also notify you about new matches, messages, and reminders when a duo&apos;s waiting on
        you. Fine-tune or turn any of these off anytime in Settings.
      </Text>

      <Button label="Create account" onPress={() => void handleSignUp()} loading={loading} />
    </ScreenContainer>
  );
}
