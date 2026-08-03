import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

type TabIconConfig = (typeof TAB_CONFIG)[keyof typeof TAB_CONFIG];

/**
 * The active tab used to slot into a gradient cartridge with its own glow. Now it
 * just switches to volt — icon and label both — and grounds itself with a 2px
 * underline bar instead. The bar renders (transparent when inactive) on every tab
 * so the label never jumps up and down as focus moves between tabs.
 */
function TabIcon({ config, focused, color }: { config: TabIconConfig; focused: boolean; color: string }) {
  const { colors } = useTheme();

  const icon =
    config.family === "material-community" ? (
      <MaterialCommunityIcons name={focused ? config.active : config.inactive} color={color} size={22} />
    ) : (
      <Ionicons name={focused ? config.active : config.inactive} color={color} size={22} />
    );

  return (
    <View style={{ alignItems: "center" }}>
      {icon}
      <View
        style={{
          width: 16,
          height: 2,
          marginTop: 2,
          backgroundColor: focused ? colors.volt : "transparent",
        }}
      />
    </View>
  );
}

export default function TabsLayout() {
  const status = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();

  useHeartbeat();

  if (status === "signed_out") return <Redirect href="/(auth)/sign-in" />;
  if (!profile?.onboarding_completed) return <Redirect href="/(onboarding)/display-name" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.volt,
        tabBarInactiveTintColor: colors.textMuted,
        // Full-width and solid, not floating glass — a translucent bar over swipe
        // cards and chat threads muddied the content underneath. Separation comes
        // from the top seam against the scene, not blur or elevation.
        tabBarStyle: {
          backgroundColor: colors.surfaceSolid,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: 60 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: type.tick,
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
              tabBarIcon: ({ focused, color }) => <TabIcon config={config} focused={focused} color={color} />,
            }}
          />
        ),
      )}
    </Tabs>
  );
}
