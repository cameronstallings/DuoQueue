import { Text } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

/** A thin persistent banner shown whenever the device has no network connection —
 * distinct from a per-screen error state, since it applies globally regardless of
 * which screen is active. */
export function OfflineBanner() {
  const { colors, spacing, type } = useTheme();
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
          backgroundColor: colors.dangerDark,
          alignItems: "center",
          justifyContent: "flex-end",
          overflow: "hidden",
          // No padding on this container: Yoga treats padding as a height floor, so
          // even at height 0 a padded box occupies its padding — which rendered as a
          // permanent 4px seam above every screen. The text carries the spacing
          // instead; overflow: hidden clips it away when collapsed.
        },
        animatedStyle,
      ]}
    >
      <Text style={[type.caption, { color: colors.onFill, marginBottom: spacing.xs }]}>
        No internet connection
      </Text>
    </Animated.View>
  );
}
