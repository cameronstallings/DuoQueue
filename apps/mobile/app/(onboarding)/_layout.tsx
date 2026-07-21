import { Redirect, Stack } from "expo-router";

import { useSessionStore } from "@/store/session-store";

export default function OnboardingLayout() {
  const status = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);

  if (status === "signed_out") return <Redirect href="/(auth)/sign-in" />;
  if (profile?.onboarding_completed) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
