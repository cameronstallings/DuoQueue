import { useEffect, useState } from "react";
import { Text } from "react-native";
import Animated from "react-native-reanimated";
import * as Localization from "expo-localization";
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { AUTH_COPY, signUpOutcome } from "@/features/auth/authErrors";
import { SIGN_UP_COPY } from "@/features/auth/frontDoorCopy";
import { LegalConsentNotice } from "@/features/auth/LegalConsentNotice";
import { describePasswordProblem, passwordsMatchProblem } from "@/features/auth/passwordPolicy";
import { setPendingConfirmationEmail } from "@/features/auth/pendingConfirmation";
import { isCaptchaConfigured, TurnstileCaptcha } from "@/features/auth/TurnstileCaptcha";
import { InviteBanner } from "@/features/invite/InviteBanner";
import { hapticError } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { abortAccountEntry, beginAccountEntry } from "@/store/commit-store";
import { useOnboardingStore } from "@/store/onboarding-store";
import { layoutTransition, quickEntering, quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

/**
 * The email half of "Save your card" (1.0.2). The card is already built (the draft), so this
 * screen only makes the account it is saved to: an email and a password. The date of birth comes
 * from the draft (the age gate ran first), and goes in as signUp metadata, because
 * `handle_new_user` (0067) creates the profile from it and will not create one without it. That
 * is where 18+ is enforced on this path. Never `display_name`: a name failing the profiles
 * constraints would abort the trigger, and the commit writes the name with the rest of the card.
 *
 * `beginAccountEntry()` runs BEFORE `signUp`: with email confirmation off it returns a session,
 * and the auth listener that fires inside the call must already route to the commit rather than
 * to an empty wizard (sessionRouting.ts).
 *
 * An email that already has an account is its own answer, not an error: a card offering "Sign in
 * instead" with the email filled in, and the draft kept (signing in commits it, or keeps the
 * account's finished card).
 */
export default function SignUp() {
  const { colors, spacing, type } = useTheme();
  const dob = useOnboardingStore((s) => s.ageConfirmedDob);
  const readyToSave = useOnboardingStore((s) => s.readyToSave);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingEmail, setExistingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Only a finished draft can be saved. Anything else (a deep link, a draft discarded elsewhere)
  // goes back to "/", which knows where the card stands.
  useEffect(() => {
    if (!dob || !readyToSave) router.replace("/");
  }, [dob, readyToSave]);

  function showError(message: string) {
    hapticError();
    setError(message);
  }

  async function handleSignUp() {
    if (!dob) return;
    setError(null);
    setExistingEmail(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes("@")) {
      showError(AUTH_COPY.invalidEmail);
      return;
    }
    const problem = describePasswordProblem(password) ?? passwordsMatchProblem(password, confirmPassword);
    if (problem) {
      showError(problem);
      return;
    }
    if (isCaptchaConfigured && !captchaToken) {
      showError("Please complete the verification check.");
      return;
    }

    setLoading(true);
    const timezone = Localization.getCalendars()[0]?.timeZone ?? "UTC";

    beginAccountEntry();
    // dob/timezone go in as user metadata rather than a follow-up UPDATE: when email
    // confirmation is on, signUp returns no session, so an authenticated write here
    // would be impossible. handle_new_user() reads them while creating the row.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { dob, timezone },
        ...(captchaToken ? { captchaToken } : {}),
      },
    });

    setLoading(false);

    if (signUpError) {
      abortAccountEntry();
      // A token is single-use: force a fresh challenge before the next attempt.
      setCaptchaToken(null);
      const outcome = signUpOutcome(signUpError);
      if (outcome.kind === "existing-account") {
        hapticError();
        setExistingEmail(trimmedEmail);
        return;
      }
      showError(outcome.message);
      return;
    }

    // With confirmation on, GoTrue answers an existing email with an obfuscated user that has no
    // identities, instead of an error. Same answer as above.
    if (data.user?.identities?.length === 0) {
      abortAccountEntry();
      hapticError();
      setExistingEmail(trimmedEmail);
      return;
    }

    // No session means Supabase is holding the account until the address is confirmed (the
    // expected path with confirmations on, not an error; dormant while they are off). The
    // session is issued by verifyOtp() on the code screen, which marks the draft again.
    if (!data.session) {
      abortAccountEntry();
      // Remembered across a cold start: confirming means leaving for the inbox, and
      // coming back to the front door instead of the code screen reads as the app
      // having forgotten the account they just created.
      await setPendingConfirmationEmail(trimmedEmail);
      router.replace({ pathname: "/(auth)/confirm-email", params: { email: trimmedEmail } });
    }
    // With a session there is nothing to do here: the auth listener and the guards take it to
    // "/", where the commit saves the card.
  }

  return (
    <ScreenContainer showBack>
      <Logo width={56} />
      <Text style={[type.screenTitle, { color: colors.text }]}>{SIGN_UP_COPY.title}</Text>
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing.md }]}>{SIGN_UP_COPY.body}</Text>

      {/* Read-only: the code was entered on the front door, and its inviter is named here. */}
      <InviteBanner allowEntry={false} />

      {existingEmail ? (
        <Animated.View entering={revealEntering()} exiting={quickExiting()} layout={layoutTransition()}>
          <Card style={{ gap: spacing.md }}>
            <Text style={[type.body, { color: colors.text }]}>{SIGN_UP_COPY.existingAccount}</Text>
            <Button
              label={SIGN_UP_COPY.signInInstead}
              variant="secondary"
              onPress={() => router.replace({ pathname: "/(auth)/sign-in", params: { email: existingEmail } })}
            />
          </Card>
        </Animated.View>
      ) : null}

      <TextField
        label={SIGN_UP_COPY.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={SIGN_UP_COPY.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
      />
      <TextField
        label={SIGN_UP_COPY.confirmPassword}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        textContentType="newPassword"
      />
      <TurnstileCaptcha onToken={setCaptchaToken} />
      {error ? (
        <Animated.Text
          key={error}
          entering={quickEntering()}
          exiting={quickExiting()}
          layout={layoutTransition()}
          style={[type.caption, { color: colors.danger }]}
        >
          {error}
        </Animated.Text>
      ) : null}

      <Animated.View layout={layoutTransition()} style={{ gap: spacing.md }}>
        {/* Above the button, because the button is the tap that creates the account. No
            notifications sentence: nothing asks for push before the deck any more. */}
        <LegalConsentNotice />

        <Button label={SIGN_UP_COPY.submit} onPress={() => void handleSignUp()} loading={loading} />
      </Animated.View>
    </ScreenContainer>
  );
}
