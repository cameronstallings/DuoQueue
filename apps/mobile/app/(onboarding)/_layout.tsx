import { Redirect, Stack } from "expo-router";

import { sessionRoute } from "@/features/auth/sessionRouting";
import { useSessionStore } from "@/store/session-store";

export default function OnboardingLayout() {
  const status = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);
  const profileStatus = useSessionStore((s) => s.profileStatus);

  const route = sessionRoute({ status, profileStatus, onboardingCompleted: profile?.onboarding_completed });

  if (route === "sign-in") return <Redirect href="/(auth)/sign-in" />;
  // The wizard is the last place a profile-less session should end up, and until now it was the
  // first: `profile?.onboarding_completed` is falsy for a missing row too, so every route into
  // this group accepted one. It then walked all ten steps and died on a foreign key at the first
  // insert, after uploading two photos. "/" is where the age gate renders.
  if (route === "complete-signup") return <Redirect href="/" />;
  if (route === "app") return <Redirect href="/(tabs)" />;
  // Nothing known yet, or the read failed with nothing cached. Holding is the only honest
  // answer: rendering the wizard here is what used to eject a real user into a signup flow the
  // moment one request timed out.
  if (route === "hold") return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
