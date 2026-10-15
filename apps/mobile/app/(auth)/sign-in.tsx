import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import { AppleSignInButton } from "@/features/auth/AppleSignInButton";
import { signInMessage } from "@/features/auth/authErrors";
import { SIGN_IN_COPY } from "@/features/auth/frontDoorCopy";
import { GOOGLE_SIGN_IN_ENABLED } from "@/features/auth/socialSignIn";
import { isCaptchaConfigured, TurnstileCaptcha } from "@/features/auth/TurnstileCaptcha";
import { useGoogleSignIn } from "@/features/auth/useGoogleSignIn";
import { InviteBanner } from "@/features/invite/InviteBanner";
import { hapticError } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { abortAccountEntry, beginAccountEntry } from "@/store/commit-store";
import { useOnboardingStore } from "@/store/onboarding-store";
import { layoutTransition, quickEntering, quickExiting } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

/**
 * "I already have an account" (1.0.2). No longer the first screen: the front door ((auth)/start)
 * is, and this is the way in for everyone who already has a card. It is also reached from the
 * intro and from Save your card, by a player holding a draft who turns out to have an account.
 *
 * Continue with Apple is FIRST (D2: 22 of 38 accounts are Apple), then email and password. Both
 * mark the draft for commit before the call (`beginAccountEntry`, a no-op unless the draft is
 * ready to save), so an account with no finished card gets the draft written onto it, and one
 * with a finished card keeps it (the draft is then discarded with the "Welcome back" toast).
 *
 * The confirmation-code button is gone (email confirmation is off, Cameron's call 2 Oct); the
 * code screen is reachable only from sign-up's no-session branch now.
 */
export default function SignIn() {
  const { colors, spacing, type } = useTheme();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const hasDraft = useOnboardingStore((s) => s.ageConfirmedDob !== null);
  const [email, setEmail] = useState(emailParam ?? "");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const google = useGoogleSignIn();

  function showError(message: string) {
    hapticError();
    setError(message);
  }

  async function handleSignIn() {
    setError(null);
    if (isCaptchaConfigured && !captchaToken) {
      showError("Please complete the verification check.");
      return;
    }
    setLoading(true);
    // Before the call: the session it creates fires the auth listener inside it, and the guards
    // must already know whether this account is for the draft (sessionRouting.ts).
    beginAccountEntry();
    // Supabase enforces captcha on password sign-in too once bot protection is on,
    // so the token has to be sent here as well or every login is rejected.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });
    setLoading(false);
    if (signInError) {
      abortAccountEntry();
      setCaptchaToken(null);
      // ONE line for every credential failure. "email_not_confirmed" (vs. the generic
      // "invalid_credentials") only fires once the supplied password is actually correct, so a
      // distinguishable response would turn this form into an oracle: try a guessed password
      // against a target email, and the answer confirms the account exists. Only an unreachable
      // server gets its own line (authErrors.ts), which says nothing about any account.
      console.error("sign-in failed", signInError.code);
      showError(signInMessage(signInError));
    }
  }

  return (
    <ScreenContainer showBack>
      <Logo width={56} />
      <Text style={[type.screenTitle, { color: colors.text }]}>{SIGN_IN_COPY.title}</Text>
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing.md }]}>{SIGN_IN_COPY.body}</Text>

      {/* Read-only here: a code can only be attached to a NEW account, and this screen's job is
          the returning one. The entry field lives on the front door. The inviter is named only
          once the age gate is behind the player (a draft holds its DOB): this screen is also
          one tap from the front door, and no real player is shown before the age gate. */}
      <InviteBanner allowEntry={false} revealInviter={hasDraft} />

      {/* SIGN IN WITH APPLE, FIRST. Apple's identity token carries no date of birth, so a brand new
          Apple ID that signs in here (no draft to commit) has no profile row and is routed to the
          post-auth age gate, the only thing that can make one. With a draft ready to save, the
          draft's own DOB creates it instead.

          GOOGLE STAYS OFF, and they are separate flags for that reason. Guideline 4.8 is
          triggered by a third-party login service, and Google Sign-In is one of the ones Apple
          names: offering it obliges an equivalent option, and a first-party email and password
          form is not one. Apple alone is compliant; Google without Apple is a rejection. Both
          flags, and the full argument, live in features/auth/socialSignIn.ts. */}
      <AppleSignInButton
        intent="continue"
        onStart={beginAccountEntry}
        onSettled={(ok) => {
          if (!ok) abortAccountEntry();
        }}
      />

      {GOOGLE_SIGN_IN_ENABLED && (
        <Button
          label="Continue with Google"
          variant="secondary"
          disabled={!google.request}
          loading={google.signingIn}
          onPress={() => void google.promptAsync()}
        />
      )}

      <Text style={[type.caption, { color: colors.textMuted, textAlign: "center" }]}>{SIGN_IN_COPY.or}</Text>

      <TextField
        label={SIGN_IN_COPY.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={SIGN_IN_COPY.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
      />
      <View style={{ alignItems: "flex-end" }}>
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() =>
            router.push({
              pathname: "/(auth)/reset-password",
              params: email.trim() ? { email: email.trim() } : {},
            })
          }
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={[type.caption, { color: colors.voltDim }]}>{SIGN_IN_COPY.forgot}</Text>
        </Pressable>
      </View>
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
        <Button label={SIGN_IN_COPY.submit} onPress={() => void handleSignIn()} loading={loading} />

        {hasDraft ? (
          <Button label={SIGN_IN_COPY.backToCard} variant="ghost" onPress={() => router.replace("/")} />
        ) : (
          <Button label={SIGN_IN_COPY.newHere} variant="ghost" onPress={() => router.replace("/(auth)/start")} />
        )}
      </Animated.View>
    </ScreenContainer>
  );
}
