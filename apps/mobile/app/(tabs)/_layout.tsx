import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSessionRoute } from "@/features/auth/useSessionRoute";
import { useHeartbeat } from "@/features/online-now/useHeartbeat";
import { useMatchesBadge } from "@/features/chat/useMatchesBadge";
import { usePushAskWarmup } from "@/features/push/usePushAskWarmup";
import { usePartyFreshness } from "@/features/party/usePartyFreshness";
import { usePopPushes } from "@/features/queue/usePopPushes";
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
  // The session guard's question, asked unconditionally with the other hooks; answered below.
  const route = useSessionRoute();
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();

  useHeartbeat();
  // Here because the tab layout stays mounted under every party screen: a party push or a
  // return to the app refreshes the banner, "Your parties" and an open party alike.
  usePartyFreshness();
  // Above the redirects (rules of hooks). Unread chats, party invites and unseen matches; it
  // keeps its RPCs off by itself while signed out or mid-signup.
  const matchesBadge = useMatchesBadge();
  // Keeps the notification ask's two inputs warm, so DUO LOCKED can decide in its first render.
  usePushAskWarmup();
  // Duo Pops landing while the app is open, and the sender's DUO LOCKED (from the push or on resume).
  usePopPushes();

  /**
   * The chokepoint for every tab route, which is why the age-gate branch has to be here and
   * not only in app/index.tsx. A deep link naming a tab (`duoqueue://(tabs)/matches`) and the
   * notification tap's `router.navigate("/(tabs)")` both arrive here without passing through
   * index at all, and an age-unverified session landing on the deck is the failure the whole
   * change exists to prevent.
   *
   * Everything that is not the app or the wizard goes to "/", which knows which of the front
   * door, the signup draft, the post-auth age gate or the commit it is (sessionRouting.ts).
   */
  if (route === "start" || route === "draft" || route === "complete-signup" || route === "commit-draft") {
    return <Redirect href="/" />;
  }
  if (route === "onboarding") return <Redirect href="/(onboarding)/display-name" />;
  // A profile read that has not landed is not permission to render the app, and it is not
  // grounds to eject somebody into the signup wizard either, which is what the old
  // `!profile?.onboarding_completed` did on any failed fetch.
  if (route === "hold") return null;

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
        tabBarBadgeStyle: matchesBadge.style,
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
              tabBarBadge: name === "matches" ? matchesBadge.label : undefined,
            }}
          />
        ),
      )}
    </Tabs>
  );
}
