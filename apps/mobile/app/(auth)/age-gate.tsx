import { Text } from "react-native";
import { router } from "expo-router";
import { MIN_AGE } from "@duoqueue/shared-types";

import { AgeGateForm } from "@/features/auth/AgeGateForm";
import { AppleSignInButton } from "@/features/auth/AppleSignInButton";
import { CompleteSignupScreen } from "@/features/auth/CompleteSignupScreen";
import { sessionRoute } from "@/features/auth/sessionRouting";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

/**
 * The age gate on the email path: asked BEFORE the account exists, because that is the only
 * moment `handle_new_user` can be handed a date of birth, and it will not create a profile
 * without one. The answer rides to sign-up as a route param and goes in as signUp metadata.
 *
 * The Apple path cannot work that way, so it asks the same question after authentication
 * instead — same form, different Continue. That screen is `CompleteSignupScreen`, rendered by
 * app/index.tsx rather than pushed here, because (auth)/_layout.tsx redirects every signed-in
 * session to "/" and a screen in this group would never get a frame.
 */
export default function AgeGate() {
  const { colors, spacing, type } = useTheme();
  const status = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);
  const profileStatus = useSessionStore((s) => s.profileStatus);

  const route = sessionRoute({ status, profileStatus, onboardingCompleted: profile?.onboarding_completed });

  // Belt and braces. (auth)/_layout.tsx redirects a signed-in session to "/" before this
  // renders, so this branch is normally unreachable — but the mode is decided by the account's
  // actual state rather than by which file the user happens to be in, so if that guard ever
  // changes, an authenticated visitor gets the gate that can finish their account instead of
  // being pushed into an email sign-up form for an account that already exists.
  if (route === "complete-signup") return <CompleteSignupScreen />;

  return (
    <AgeGateForm
      title="Confirm your age"
      blurb={`DuoQueue is for players ${MIN_AGE} and older. Your date of birth is kept private. Only your age is ever shown on your profile.`}
      submitLabel="Continue"
      onSubmit={(dobIso) => router.push({ pathname: "/(auth)/sign-up", params: { dob: dobIso } })}
    >
      {/* The other way to make an account, on the screen where account-making starts. Somebody
          who taps "Create an account" should not have to go back to the sign-in screen to find
          the Apple button. */}
      <Text style={[type.caption, { color: colors.textMuted, textAlign: "center", marginTop: spacing.sm }]}>or</Text>
      <AppleSignInButton intent="sign-up" />
      <Text style={[type.caption, { color: colors.textMuted }]}>
        Apple does not share your date of birth, so we will ask for it here once you are signed in.
      </Text>
    </AgeGateForm>
  );
}
