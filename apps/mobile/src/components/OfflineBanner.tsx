import { Text } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

/** A thin persistent banner shown whenever the device has no network connection —
 * distinct from a per-screen error state, since it applies globally regardless of
 * which screen is active. */
export function OfflineBanner() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const netInfo = useNetInfo();

  // `isConnected` starts null until NetInfo's first check resolves — treat that as
  // "assume online" rather than flashing the banner on every cold start.
  const isOffline = netInfo.isConnected === false;

  const animatedStyle = useAnimatedStyle(() => ({
    height: withTiming(isOffline ? 32 + insets.top : 0, { duration: 200 }),
    opacity: withTiming(isOffline ? 1 : 0, { duration: 200 }),
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.danger,
          alignItems: "center",
          justifyContent: "flex-end",
          overflow: "hidden",
          paddingBottom: spacing.xs,
        },
        animatedStyle,
      ]}
    >
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>No internet connection</Text>
    </Animated.View>
  );
}
