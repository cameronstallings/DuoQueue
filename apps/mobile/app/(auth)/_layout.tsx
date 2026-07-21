import { Redirect, Stack } from "expo-router";

import { useSessionStore } from "@/store/session-store";

export default function AuthLayout() {
  const status = useSessionStore((s) => s.status);

  if (status === "signed_in") {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="age-gate" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
