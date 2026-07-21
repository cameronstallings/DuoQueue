import { Redirect } from "expo-router";

import { useSessionStore } from "@/store/session-store";

export default function Index() {
  const status = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);

  if (status === "signed_out") {
    return <Redirect href="/(auth)/sign-in" />;
  }
  if (status === "signed_in" && !profile?.onboarding_completed) {
    return <Redirect href="/(onboarding)/display-name" />;
  }
  return <Redirect href="/(tabs)" />;
}
