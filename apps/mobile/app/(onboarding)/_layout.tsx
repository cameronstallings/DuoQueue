import { Redirect, Stack } from "expo-router";

import { useSessionRoute } from "@/features/auth/useSessionRoute";
import { useTheme } from "@/theme/useTheme";

/**
 * The card-building screens: the intro, the eight steps and "Save your card".
 *
 * Since 1.0.2 they serve two routes. "draft" is a signed-out player building their card before
 * the account exists (every answer persisted on the phone, onboarding-store.ts); "onboarding" is
 * a signed-in account with an unfinished card (an Apple-first sign-in, or an account left half
 * done). Everything else is sent where it belongs: the front door, the post-auth age gate and
 * the commit all render at "/", and a finished card goes to the app.
 *
 * `animation: "fade"`: every step draws the same header (Back, the progress bar, the step label),
 * so a fade makes it look stationary between steps while only the newest segment of the bar moves.
 */
export default function OnboardingLayout() {
  const route = useSessionRoute();
  const { colors } = useTheme();

  // Nothing known yet, or the read failed with nothing cached, or the draft is still being read
  // back. Holding is the only honest answer: rendering the wizard here is what used to eject a
  // real user into a signup flow the moment one request timed out.
  if (route === "hold") return null;
  // The front door, the post-auth age gate and the commit all live at "/". The wizard is the
  // last place a profile-less session should end up: its first insert would die on a foreign key.
  if (route === "start" || route === "complete-signup" || route === "commit-draft") return <Redirect href="/" />;
  if (route === "app") return <Redirect href="/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        animationDuration: 200,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
