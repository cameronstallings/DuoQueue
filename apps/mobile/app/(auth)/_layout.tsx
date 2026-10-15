import { Redirect, Stack } from "expo-router";

import { useRecoveryStore } from "@/store/recovery-store";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

/**
 * The signed-out screens: the front door, the age gate, "I already have an account", the email
 * half of "Save your card", the dormant code screen, and the password reset.
 *
 * A signed-in session belongs at "/", which knows where to send it (the commit of a draft, the
 * post-auth age gate, the wizard or the app). ONE EXCEPTION: a password reset in flight.
 * `verifyOtp({ type: "recovery" })` creates a session and emits PASSWORD_RECOVERY before it
 * resolves, so without the hold this layout would unmount reset-password.tsx before it could
 * call `updateUser` with the new password (recovery-store.ts).
 */
export default function AuthLayout() {
  const status = useSessionStore((s) => s.status);
  const recoveryInFlight = useRecoveryStore((s) => s.inFlight);
  const { colors } = useTheme();

  if (status === "signed_in" && !recoveryInFlight) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="start" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="age-gate" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="confirm-email" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
