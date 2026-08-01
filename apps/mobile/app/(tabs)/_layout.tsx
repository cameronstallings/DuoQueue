import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { useHeartbeat } from "@/features/online-now/useHeartbeat";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

const TAB_CONFIG = {
  index: {
    title: "Deck",
    family: "material-community",
    active: "cards-playing",
    inactive: "cards-playing-outline",
  },
  matches: {
    title: "Matches",
    family: "material-community",
    active: "treasure-chest",
    inactive: "treasure-chest-outline",
  },
  profile: { title: "Profile", family: "ionicons", active: "person-circle", inactive: "person-circle-outline" },
  settings: { title: "Settings", family: "ionicons", active: "settings", inactive: "settings-outline" },
} as const satisfies Record<
  string,
  (
    | { family: "ionicons"; active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
    | {
        family: "material-community";
        active: keyof typeof MaterialCommunityIcons.glyphMap;
        inactive: keyof typeof MaterialCommunityIcons.glyphMap;
      }
  ) & { title: string }
>;

export default function TabsLayout() {
  const status = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);
  const { colors, type, hairline } = useTheme();

  useHeartbeat();

  if (status === "signed_out") return <Redirect href="/(auth)/sign-in" />;
  if (!profile?.onboarding_completed) return <Redirect href="/(onboarding)/display-name" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandInk,
        tabBarInactiveTintColor: colors.textMuted,
        // A hard rule instead of a soft drop shadow: the bar is a printed edge, and a
        // blurred elevation here was one of the things that made every screen read
        // as stock Material.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: hairline,
          borderTopColor: colors.ink,
          elevation: 0,
        },
        tabBarLabelStyle: type.label,
        tabBarItemStyle: { paddingTop: 4 },
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
              tabBarIcon: ({ focused, color, size }) =>
                config.family === "material-community" ? (
                  <MaterialCommunityIcons name={focused ? config.active : config.inactive} color={color} size={size} />
                ) : (
                  <Ionicons name={focused ? config.active : config.inactive} color={color} size={size} />
                ),
            }}
          />
        ),
      )}
    </Tabs>
  );
}
