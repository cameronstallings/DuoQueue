import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import {
  AUTH_COPY,
  resetRequestOutcome,
  updatePasswordOutcome,
  verifyRecoveryMessage,
} from "@/features/auth/authErrors";
import { RESET_COPY, resendLabel, resetSentBody } from "@/features/auth/frontDoorCopy";
import { describePasswordProblem, passwordsMatchProblem } from "@/features/auth/passwordPolicy";
import { isCaptchaConfigured, TurnstileCaptcha } from "@/features/auth/TurnstileCaptcha";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { abortAccountEntry, beginAccountEntry } from "@/store/commit-store";
import { useRecoveryStore } from "@/store/recovery-store";
import { useToastStore } from "@/store/toast-store";
import { layoutTransition, quickEntering, quickExiting } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

const CODE_LENGTH = 6;
const CODE_SHAPE = /^\d{6}$/;
/** Matches `max_frequency` in supabase/config.toml: a resend inside it is refused anyway. */
const RESEND_COOLDOWN_SECONDS = 60;

type Step = "email" | "code" | "set-password";

/**
 * "Forgot password?": a reset by a 6-digit CODE, not a link (1.0.2).
 *
 * A link would have to open the app from wherever the mail is read, and it opened localhost (the
 * hosted recovery template was the link version). The hosted template now sends `{{ .Token }}`
 * (Group S, S4), so the code is typed here, the same way the old signup code was.
 *
 * Three steps on one screen, cross-faded: the email; the code with the new password; and, only
 * when the code worked but the new password was refused, the new password alone (the player is
 * signed in by then, and held here).
 *
 * THE HOLD. `verifyOtp({ type: "recovery" })` signs the player in and emits PASSWORD_RECOVERY
 * before it resolves, and (auth)/_layout redirects every signed-in session to "/". The recovery
 * store keeps this screen up until `updateUser` has set the new password (or the player keeps the
 * old one); `end()` then lets the layout send them on. Leaving the screen ends it too.
 *
 * The "sent" copy never says whether an account uses that email (resetRequestOutcome).
 */
export default function ResetPassword() {
  const { colors, motion, spacing, type } = useTheme();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const begin = useRecoveryStore((s) => s.begin);
  const end = useRecoveryStore((s) => s.end);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(emailParam ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // A Turnstile token is single-use and the widget mints one per mount, so a resend remounts it.
  const [captchaEpoch, setCaptchaEpoch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [samePassword, setSamePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Leaving the screen (Back, or the success path) releases the hold, so a signed-in session is
  // never left parked inside (auth).
  useEffect(() => () => useRecoveryStore.getState().end(), []);

  function showError(message: string) {
    hapticError();
    setError(message);
  }

  async function sendCode() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      showError(AUTH_COPY.enterEmail);
      return;
    }
    if (isCaptchaConfigured && !captchaToken) {
      showError("Please complete the verification check.");
      return;
    }
    setBusy(true);
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(
      trimmed,
      captchaToken ? { captchaToken } : undefined,
    );
    setBusy(false);
    setCaptchaToken(null);
    setCaptchaEpoch((n) => n + 1);

    const message = resetRequestOutcome(sendError);
    if (message) {
      showError(message);
      return;
    }
    setEmail(trimmed);
    setStep("code");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  function finished() {
    hapticSuccess();
    useToastStore.getState().showToast(RESET_COPY.successToast, "success");
    end();
  }

  async function setNewPassword() {
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (!updateError) {
      finished();
      return;
    }
    // Signed in by now: stay here, held, with only the password left to choose.
    setStep("set-password");
    const outcome = updatePasswordOutcome(updateError);
    if (outcome.kind === "same-password") {
      setSamePassword(true);
      showError(AUTH_COPY.samePassword);
      return;
    }
    showError(outcome.message);
  }

  async function saveWithCode() {
    setError(null);
    setSamePassword(false);
    if (!CODE_SHAPE.test(code)) {
      showError(AUTH_COPY.enterCode);
      return;
    }
    const problem = describePasswordProblem(password) ?? passwordsMatchProblem(password, confirmPassword);
    if (problem) {
      showError(problem);
      return;
    }

    setBusy(true);
    // Both before the call: the session it creates fires the auth listener inside it. The hold
    // keeps this screen up; the draft mark sends a card ready to save to the commit afterwards.
    begin();
    beginAccountEntry();
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
    if (verifyError) {
      end();
      abortAccountEntry();
      setBusy(false);
      setCode("");
      showError(verifyRecoveryMessage(verifyError));
      return;
    }
    await setNewPassword();
    setBusy(false);
  }

  async function saveNewPassword() {
    setError(null);
    setSamePassword(false);
    const problem = describePasswordProblem(password) ?? passwordsMatchProblem(password, confirmPassword);
    if (problem) {
      showError(problem);
      return;
    }
    setBusy(true);
    await setNewPassword();
    setBusy(false);
  }

  const passwordFields = (
    <>
      <TextField
        label={RESET_COPY.newPassword}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
      />
      <TextField
        label={RESET_COPY.confirmPassword}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        textContentType="newPassword"
      />
    </>
  );

  const errorLine = error ? (
    <Animated.Text
      key={error}
      entering={quickEntering()}
      exiting={quickExiting()}
      layout={layoutTransition()}
      style={[type.caption, { color: colors.danger }]}
    >
      {error}
    </Animated.Text>
  ) : null;

  const fade = FadeIn.duration(motion.base).reduceMotion(ReduceMotion.Never);

  return (
    // Back is there on every step: on the last one, leaving releases the hold and keeps the old
    // password, the same as "Keep my old password".
    <ScreenContainer showBack>
      <Logo width={56} />

      {step === "email" ? (
        <Animated.View key="email" entering={fade} exiting={quickExiting()} style={{ gap: spacing.md }}>
          <Text style={[type.screenTitle, { color: colors.text }]}>{RESET_COPY.title}</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>{RESET_COPY.body}</Text>
          <TextField
            label={RESET_COPY.email}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          {isCaptchaConfigured && <TurnstileCaptcha key={captchaEpoch} onToken={setCaptchaToken} />}
          {errorLine}
          <Animated.View layout={layoutTransition()}>
            <Button label={RESET_COPY.send} onPress={() => void sendCode()} loading={busy} />
          </Animated.View>
        </Animated.View>
      ) : step === "code" ? (
        <Animated.View key="code" entering={fade} exiting={quickExiting()} style={{ gap: spacing.md }}>
          <Text style={[type.screenTitle, { color: colors.text }]}>{RESET_COPY.codeTitle}</Text>
          <View style={{ gap: spacing.sm }}>
            <Text style={[type.body, { color: colors.textMuted }]}>{resetSentBody(email)}</Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>{RESET_COPY.appleLine}</Text>
          </View>
          <TextField
            label={RESET_COPY.code}
            value={code}
            onChangeText={(next) => setCode(next.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
          />
          {passwordFields}
          {isCaptchaConfigured && <TurnstileCaptcha key={captchaEpoch} onToken={setCaptchaToken} />}
          {errorLine}
          <Animated.View layout={layoutTransition()} style={{ gap: spacing.sm }}>
            <Button label={RESET_COPY.save} onPress={() => void saveWithCode()} loading={busy} />
            <Button
              label={resendLabel(cooldown)}
              variant="ghost"
              disabled={cooldown > 0 || busy}
              onPress={() => void sendCode()}
            />
            <Button
              label={RESET_COPY.differentEmail}
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setError(null);
                setCode("");
                setStep("email");
              }}
            />
          </Animated.View>
        </Animated.View>
      ) : (
        <Animated.View key="set-password" entering={fade} exiting={quickExiting()} style={{ gap: spacing.md }}>
          <Text style={[type.screenTitle, { color: colors.text }]}>{RESET_COPY.setTitle}</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>{RESET_COPY.setBody}</Text>
          {passwordFields}
          {errorLine}
          <Animated.View layout={layoutTransition()} style={{ gap: spacing.sm }}>
            <Button label={RESET_COPY.save} onPress={() => void saveNewPassword()} loading={busy} />
            {samePassword ? (
              // Already signed in with the code; keeping the old password just lets them through.
              <Button label={RESET_COPY.keepOld} variant="ghost" onPress={end} />
            ) : null}
          </Animated.View>
        </Animated.View>
      )}
    </ScreenContainer>
  );
}
