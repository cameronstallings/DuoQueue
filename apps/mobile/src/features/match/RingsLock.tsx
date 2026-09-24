import { StyleSheet, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { CXA, CXB, CY, LOGO_MARK_ASPECT, mix, NUB, R, SEG_PATH, VB_H, VB_W, VB_X, VB_Y, W } from "@/theme/logo-geometry";
import { useTheme } from "@/theme/useTheme";

import { ringTravel } from "./matchMoment";

interface RingsLockProps {
  width: number;
  /** 0 = the rings apart (the O left, the Q right); 1 = locked in place. */
  progress: SharedValue<number>;
  /** 0 = the O lies over the Q at both crossings (the approach); 1 = the true weave. */
  woven: SharedValue<number>;
}

/**
 * The O+Q mark in three stacked layers so each ring slides on the UI thread (plain transforms,
 * no animated SVG props): the Q ring and nub, the O ring, then the Q's lower-crossing arc (the
 * weave), which travels with the Q. At progress 1 and woven 1 it draws exactly what
 * <Logo variant="mark"/> draws, in the same order and colours. The weave is held back until the
 * rings touch: drawn during the slide, it only partly covers the crossing and leaves a hard cut.
 */
export function RingsLock({ width, progress, woven }: RingsLockProps) {
  const { colors } = useTheme();
  const height = width * LOGO_MARK_ASPECT;
  const travel = ringTravel(width);
  const ink = colors.text;
  const duo = mix(colors.text, colors.background, 0.58);
  const viewBox = `${VB_X} ${VB_Y} ${VB_W} ${VB_H}`;

  const qStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - progress.value) * travel }] }));
  const oStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -(1 - progress.value) * travel }] }));
  const weaveStyle = useAnimatedStyle(() => ({
    opacity: woven.value,
    transform: [{ translateX: (1 - progress.value) * travel }],
  }));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, qStyle]}>
        <Svg width={width} height={height} viewBox={viewBox}>
          <Circle cx={CXB} cy={CY} r={R} fill="none" stroke={duo} strokeWidth={W} />
          <Circle cx={NUB.cx} cy={NUB.cy} r={NUB.r} fill={duo} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, oStyle]}>
        <Svg width={width} height={height} viewBox={viewBox}>
          <Circle cx={CXA} cy={CY} r={R} fill="none" stroke={ink} strokeWidth={W} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, weaveStyle]}>
        <Svg width={width} height={height} viewBox={viewBox}>
          <Path d={SEG_PATH} fill="none" stroke={duo} strokeWidth={W} />
        </Svg>
      </Animated.View>
    </View>
  );
}
