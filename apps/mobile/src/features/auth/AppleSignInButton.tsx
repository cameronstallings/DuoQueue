import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import * as AppleAuthentication from "expo-apple-authentication";

import { signInWithApple } from "@/features/auth/appleSignIn";
import { quickEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { APPLE_SIGN_IN_ENABLED, appleButtonStyleFor, appleSignInMessage, isAppleCancellation } from "./socialSignIn";

/** The button's height: the same as a full-size Button (18 + 21 + 18), so the two line up. */
export const APPLE_BUTTON_HEIGHT = 57;

const BUTTON_TYPES = {
  "sign-in": AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN,
  "sign-up": AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP,
  continue: AppleAuthentication.AppleAuthenticationButtonType.CONTINUE,
} as const;

interface AppleSignInButtonProps {
  /** "continue" is 1.0.2's: "Continue with Apple" on Save your card and "I already have an account". */
  intent: "sign-in" | "sign-up" | "continue";
  /**
   * Called BEFORE the Apple sheet opens. Save passes `beginAccountEntry`, which marks the draft for
   * commit: the session `signInWithIdToken` creates fires the auth listener inside the call, and
   * the guards must already know this account is for the draft (sessionRouting.ts).
   */
  onStart?: () => void;
  /** Called once it is over: true when signed in, false on a cancel or a failure (before its message). */
  onSettled?: (signedIn: boolean) => void;
}

/**
 * Apple's own button, rendered only where it can actually work.
 *
 * `isAvailableAsync()` was never called anywhere in this app: the button was gated on
 * `Platform.OS === "ios"` alone, so an iOS device with no Apple ID signed in, or one below the
 * OS floor, got a button that threw a raw native error the moment it was tapped. Availability
 * is asked once here and the button simply does not render when the answer is no, which is what
 * Apple's own guidance asks for.
 *
 * NO JUMP WHILE IT ASKS (1.0.2). The answer takes a frame or two, and the button used to appear
 * late and push everything under it down. Now, where it can exist (iOS, Apple enabled), the slot
 * is reserved at the button's height while the answer is unknown, and the button fades into it.
 * A "no" collapses the slot, which only happens on a device that cannot use Apple at all.
 *
 * WHAT HAPPENS NEXT, since this component deliberately does not navigate: a successful
 * `signInWithApple` produces a session, the store's auth listener picks it up, and routing takes
 * over. On Save your card that is the commit of the draft (the draft's DOB creates the profile).
 * A brand new Apple account from the sign-in screen has no profile row and no draft to commit,
 * so `sessionRoute` sends it to the post-auth age gate, which is the only thing that can make one.
 */
export function AppleSignInButton({ intent, onStart, onSettled }: AppleSignInButtonProps) {
  const { colors, radius, scheme, spacing, type } = useTheme();
  const possible = APPLE_SIGN_IN_ENABLED && Platform.OS === "ios";
  // null = still asking. Only ever null where the button could exist.
  const [available, setAvailable] = useState<boolean | null>(possible ? null : false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!possible) return;
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
  }, [possible]);

  async function handlePress() {
    setError(null);
    onStart?.();
    try {
      await signInWithApple();
      onSettled?.(true);
    } catch (err) {
      onSettled?.(false);
      // Dismissing the sheet is a decision, not a failure. Saying anything about it makes a
      // working button look broken.
      if (isAppleCancellation(err)) return;
      console.error("apple sign-in failed", err);
      setError(appleSignInMessage(err));
    }
  }

  if (available === false) return null;
  if (available === null) return <View style={{ height: APPLE_BUTTON_HEIGHT }} />;

  return (
    <Animated.View entering={quickEntering()} style={{ gap: spacing.sm }}>
      {/* `key={scheme}` makes a theme switch a remount of the native button. The module
          version pinned today does rebuild its ASAuthorizationAppleIDButton when buttonStyle
          changes (updateChildIfNeeded in AppleAuthenticationButton.swift), so this is belt and
          braces: older versions read the style once at creation, and a stale black button on a
          dark screen is exactly the review finding this style choice exists to fix. A remount
          of one button is cheap insurance against that coming back with an upgrade. */}
      <AppleAuthentication.AppleAuthenticationButton
        key={scheme}
        buttonType={BUTTON_TYPES[intent]}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle[appleButtonStyleFor(scheme)]}
        cornerRadius={radius.button}
        style={{ height: APPLE_BUTTON_HEIGHT }}
        onPress={() => void handlePress()}
      />
      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}
    </Animated.View>
  );
}
