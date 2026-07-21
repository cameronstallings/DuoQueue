import { Redirect, Tabs } from "expo-router";

import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function TabsLayout() {
  const status = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);
  const { colors } = useTheme();

  if (status === "signed_out") return <Redirect href="/(auth)/sign-in" />;
  if (!profile?.onboarding_completed) return <Redirect href="/(onboarding)/display-name" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Deck" }} />
      <Tabs.Screen name="matches" options={{ title: "Matches" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
