import { useEffect } from "react";
import type { DimensionValue, ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/** A pulsing placeholder block — compose a few of these to sketch a screen's shape
 * while its data loads, instead of a single centered spinner. Pulses between the
 * base surface and its lighter shimmer tint, rather than fading opacity. */
export function Skeleton({ width = "100%", height = 16, borderRadius, style }: SkeletonProps) {
  const { colors, radius } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.ease }), -1, true);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surfaceAlt, colors.surface]),
  }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: borderRadius ?? radius.sm }, animatedStyle, style]}
    />
  );
}
