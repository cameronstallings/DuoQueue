import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
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
 * The active tab reads as a small cartridge slotted into the bar: a gradient tile
 * with its own glow. Inactive tabs stay bare icons in the muted tint — the glow is
 * reserved for "where you are," not spent on every icon at once.
 */
function TabIcon({ config, focused, color }: { config: TabIconConfig; focused: boolean; color: string }) {
  const { colors, radius, heroGradient, glow } = useTheme();

  const icon =
    config.family === "material-community" ? (
      <MaterialCommunityIcons
        name={focused ? config.active : config.inactive}
        color={focused ? colors.onFill : color}
        size={focused ? 19 : 22}
      />
    ) : (
      <Ionicons
        name={focused ? config.active : config.inactive}
        color={focused ? colors.onFill : color}
        size={focused ? 19 : 22}
      />
    );

  if (!focused) return icon;

  return (
    <LinearGradient
      {...heroGradient}
      style={[
        { width: 34, height: 34, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
        glow(colors.glowViolet, 14),
      ]}
    >
      {icon}
    </LinearGradient>
  );
}

export default function TabsLayout() {
  const status = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();

  useHeartbeat();

  if (status === "signed_out") return <Redirect href="/(auth)/sign-in" />;
  if (!profile?.onboarding_completed) return <Redirect href="/(onboarding)/display-name" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        // Full-width and solid, not floating glass — a translucent bar over swipe
        // cards and chat threads muddied the content underneath. Separation comes
        // from the color step against the scene, not a border or elevation.
        tabBarStyle: {
          backgroundColor: colors.surfaceSolid,
          borderTopWidth: 0,
          elevation: 0,
          height: 60 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0 },
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
