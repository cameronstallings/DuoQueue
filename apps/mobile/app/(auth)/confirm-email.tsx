import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { isCaptchaConfigured, TurnstileCaptcha } from "@/features/auth/TurnstileCaptcha";
import { supabase } from "@/lib/supabase";
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
 */
export default function ConfirmEmail() {
  const { colors, spacing, type } = useTheme();
  const { email } = useLocalSearchParams<{ email?: string }>();

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

  useEffect(() => {
    if (!email) router.replace("/(auth)/sign-in");
  }, [email]);

  async function handleVerify() {
    if (!email) return;
    setError(null);
    setNotice(null);

    if (code.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from your email.`);
      return;
    }

    setVerifying(true);
    // On success this returns a session, which fires onAuthStateChange in the session
    // store — that listener drives navigation, so there's nothing to route to here.
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });
    setVerifying(false);

    if (verifyError) {
      setError(verifyError.message);
      setCode("");
    }
  }

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setError(null);
    setNotice(null);

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
      setError(resendError.message);
      return;
    }
    setNotice("We sent a new code.");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <ScreenContainer>
      <Logo width={56} />
      <Text style={[type.screenTitle, { color: colors.text }]}>Check your email</Text>
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
        We sent a {CODE_LENGTH}-digit code to {email}. Enter it below to finish creating your account.
      </Text>

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
      <Button
        label="Back to sign in"
        variant="secondary"
        onPress={() => router.replace("/(auth)/sign-in")}
      />
    </ScreenContainer>
  );
}
