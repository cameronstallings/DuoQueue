import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { AUTH_COPY, resetRequestOutcome, verifyRecoveryMessage } from "@/features/auth/authErrors";
import { CONFIRM_EMAIL_COPY } from "@/features/auth/frontDoorCopy";
import { clearPendingConfirmationEmail } from "@/features/auth/pendingConfirmation";
import { isCaptchaConfigured, TurnstileCaptcha } from "@/features/auth/TurnstileCaptcha";
import { supabase } from "@/lib/supabase";
import { abortAccountEntry, beginAccountEntry } from "@/store/commit-store";
import { useTheme } from "@/theme/useTheme";

const CODE_LENGTH = 6;
/** Matches `max_frequency` in supabase/config.toml — Supabase rejects a resend inside
 * this window anyway, so the button stays disabled rather than surfacing that error. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Email confirmation by typed code rather than a tapped link.
 *
 * A link would have to survive being opened wherever the mail happens to be read. On
 * mobile that is usually a webmail app whose in-app browser can't hand off to us, and
 * app.json declares no associatedDomains/intentFilters, so `duoqueue://` has no https
 * fallback and does nothing at all on a desktop. PKCE makes it worse: the verifier is
 * bound to the device that called signUp(), so reading the mail on a laptop could never
 * produce a session on the phone. Six digits the user retypes sidesteps every one of
 * those failure modes, and verifyOtp() issues the session directly.
 *
 * DORMANT IN 1.0.2. Email confirmation is off (`mailer_autoconfirm`, Cameron's call), so sign-up
 * returns a session and never comes here, and the sign-in screen's button for typing a code is
 * gone. It stays reachable only from sign-up's no-session branch, so turning
 * confirmation back on needs no client change. Its way out goes to the start ("/"), and a code
 * that works commits the signup draft like any other account entry.
 */
export default function ConfirmEmail() {
  const { colors, spacing, type } = useTheme();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();

  // Editable, and always shown, rather than read from the param alone: a cold start reopens
  // this screen from the remembered address, and a typo in it should be fixable here instead
  // of only by backing out and signing up again.
  const [email, setEmail] = useState(emailParam ?? "");
  const [code, setCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // A Turnstile token is single-use, and the widget only mints one per mount — so a
  // resend after a consumed token needs the widget remounted, not just the state cleared.
  const [captchaEpoch, setCaptchaEpoch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    intervalRef.current = setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cooldown]);


  async function handleVerify() {
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError(AUTH_COPY.enterEmail);
      return;
    }

    if (code.length !== CODE_LENGTH) {
      setError(AUTH_COPY.enterCode);
      return;
    }

    setVerifying(true);
    // Before the call: the session it creates fires onAuthStateChange inside it, and the guards
    // must already know this account is for the draft (sessionRouting.ts). That listener drives
    // navigation, so there's nothing to route to here.
    beginAccountEntry();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });
    setVerifying(false);

    if (verifyError) {
      abortAccountEntry();
      setError(verifyRecoveryMessage(verifyError));
      setCode("");
      return;
    }

    // Confirmed — stop redirecting cold starts back here.
    await clearPendingConfirmationEmail();
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError(AUTH_COPY.enterEmail);
      return;
    }

    if (isCaptchaConfigured && !captchaToken) {
      setError("Please complete the verification check.");
      return;
    }

    setResending(true);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });
    setResending(false);

    setCaptchaToken(null);
    setCaptchaEpoch((n) => n + 1);

    if (resendError) {
      setError(resetRequestOutcome(resendError) ?? AUTH_COPY.generic);
      return;
    }
    setNotice("We sent a new code.");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <ScreenContainer showBack>
      <Logo width={56} />
      <Text style={[type.screenTitle, { color: colors.text }]}>Check your email</Text>
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
        {email
          ? `We sent a ${CODE_LENGTH}-digit code to ${email}. Enter it below to finish creating your account.`
          : `Enter the email you signed up with and the ${CODE_LENGTH}-digit code we sent you.`}
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
        label="Confirmation code"
        value={code}
        onChangeText={(next) => setCode(next.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
      />

      {error && <Text style={[type.caption, { color: colors.danger, marginBottom: spacing.sm }]}>{error}</Text>}
      {notice && <Text style={[type.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>{notice}</Text>}

      {isCaptchaConfigured && <TurnstileCaptcha key={captchaEpoch} onToken={setCaptchaToken} />}

      <Button label="Confirm" onPress={handleVerify} loading={verifying} />
      <Button
        label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        variant="secondary"
        onPress={handleResend}
        loading={resending}
        disabled={cooldown > 0}
      />
      {/* The escape hatch. Clearing the pending email is what stops the cold-start
          redirect from dragging them straight back here; without it, "back to start"
          would be a door that reopens onto the same room. "/" knows whether that is the front
          door or a card in progress. */}
      <Button
        label={CONFIRM_EMAIL_COPY.backToStart}
        variant="secondary"
        onPress={() => {
          void clearPendingConfirmationEmail();
          router.replace("/");
        }}
      />
    </ScreenContainer>
  );
}
