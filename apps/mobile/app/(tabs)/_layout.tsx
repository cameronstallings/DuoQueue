import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

const TAB_CONFIG = {
  index: { title: "Deck", active: "flame", inactive: "flame-outline" },
  matches: { title: "Matches", active: "chatbubble-ellipses", inactive: "chatbubble-ellipses-outline" },
  profile: { title: "Profile", active: "person-circle", inactive: "person-circle-outline" },
  settings: { title: "Settings", active: "settings", inactive: "settings-outline" },
} as const satisfies Record<
  string,
  { title: string; active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
>;

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
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {(Object.entries(TAB_CONFIG) as [keyof typeof TAB_CONFIG, (typeof TAB_CONFIG)[keyof typeof TAB_CONFIG]][]).map(
        ([name, config]) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: config.title,
              tabBarIcon: ({ focused, color, size }) => (
                <Ionicons name={focused ? config.active : config.inactive} color={color} size={size} />
              ),
            }}
          />
        ),
      )}
    </Tabs>
  );
}
