import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

import { signInWithApple } from "@/features/auth/appleSignIn";
import { useTheme } from "@/theme/useTheme";

import { APPLE_SIGN_IN_ENABLED, appleButtonStyleFor, appleSignInMessage, isAppleCancellation } from "./socialSignIn";

/**
 * Apple's own button, rendered only where it can actually work.
 *
 * `isAvailableAsync()` was never called anywhere in this app: the button was gated on
 * `Platform.OS === "ios"` alone, so an iOS device with no Apple ID signed in, or one below the
 * OS floor, got a button that threw a raw native error the moment it was tapped. Availability
 * is asked once here and the button simply does not render when the answer is no, which is what
 * Apple's own guidance asks for.
 *
 * There is no matching state to render while the answer is in flight. A button that appears a
 * frame late is better than one that appears and then vanishes under a thumb already moving
 * toward it.
 *
 * WHAT HAPPENS NEXT, since this component deliberately does not navigate: a successful
 * `signInWithApple` produces a session, the store's auth listener picks it up, and routing takes
 * over. A brand new Apple account has no profile row — Apple sends no birthdate and
 * `handle_new_user` cannot invent one — so `sessionRoute` sends it to the post-auth age gate,
 * which is the only thing that can create one.
 */
export function AppleSignInButton({ intent }: { intent: "sign-in" | "sign-up" }) {
  const { colors, radius, scheme, spacing, type } = useTheme();
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!APPLE_SIGN_IN_ENABLED || Platform.OS !== "ios") return;
    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .then((value) => {
        if (!cancelled) setAvailable(value);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePress() {
    setError(null);
    try {
      await signInWithApple();
    } catch (err) {
      // Dismissing the sheet is a decision, not a failure. Saying anything about it makes a
      // working button look broken.
      if (isAppleCancellation(err)) return;
      console.error("apple sign-in failed", err);
      setError(appleSignInMessage(err));
    }
  }

  if (!APPLE_SIGN_IN_ENABLED || Platform.OS !== "ios" || !available) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      {/* `key={scheme}` makes a theme switch a remount of the native button. The module
          version pinned today does rebuild its ASAuthorizationAppleIDButton when buttonStyle
          changes (updateChildIfNeeded in AppleAuthenticationButton.swift), so this is belt and
          braces: older versions read the style once at creation, and a stale black button on a
          dark screen is exactly the review finding this style choice exists to fix. A remount
          of one button is cheap insurance against that coming back with an upgrade. */}
      <AppleAuthentication.AppleAuthenticationButton
        key={scheme}
        buttonType={
          intent === "sign-up"
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
        }
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle[appleButtonStyleFor(scheme)]}
        cornerRadius={radius.button}
        style={{ height: 48 }}
        onPress={() => void handlePress()}
      />
      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}
