import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
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

  // The glow has to sit on a plain wrapper, not the gradient itself — a boxShadow
  // on a LinearGradient gets clipped to the gradient's own bounds instead of
  // spreading past them. Same split Button.tsx uses for its glow.
  // Slimmer and quieter than the first pass (34×34 solid + heavy glow read as a thick
  // slab crowding the label): shorter tile, gradient at partial opacity, softer glow,
  // and a couple px of air above the label.
  return (
    <View style={[{ width: 34, height: 28, borderRadius: radius.sm, marginBottom: 3 }, glow(colors.glowViolet, 9)]}>
      <LinearGradient
        {...heroGradient}
        style={{
          flex: 1,
          borderRadius: radius.sm,
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.82,
        }}
      >
        {icon}
      </LinearGradient>
    </View>
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
