import type { ReactNode } from "react";
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
  /** Draw in these two inks instead of the theme's. The launch intro passes the dark splash
   * palette, because the native splash it takes over from is always dark. */
  palette?: { ink: string; duo: string };
  /** Where the O starts at progress 0, in points from its locked place (negative is left). The
   * default, -ringTravel(width), is DUO LOCKED's slide in from the left; the Duo Pop card passes
   * popOFrom(width), the middle of the mark, where its countdown ring sits. */
  oFrom?: number;
  /** Where the Q starts at progress 0 (default +ringTravel(width), from the right). */
  qFrom?: number;
  /** The Q ring, nub and weave fade with this (the Duo Pop card brings the Q in from nothing).
   * Omitted, the Q is simply drawn, as before. */
  qOpacity?: SharedValue<number>;
  /** The ink O's opacity (the Duo Pop card hides it under its countdown ring until the lock).
   * Omitted, the O is simply drawn, as before. */
  oOpacity?: SharedValue<number>;
  /** Drawn in the O's layer, under the ink O, travelling with it: the Duo Pop countdown ring
   * (PopCountdownRing), which is the O's own geometry. Fill the layer (absoluteFill) and draw in
   * this mark's viewBox. */
  oOverlay?: ReactNode;
}

/**
 * The O+Q mark in three stacked layers so each ring slides on the UI thread (plain transforms,
 * no animated SVG props): the Q ring and nub, the O ring, then the Q's lower-crossing arc (the
 * weave), which travels with the Q. At progress 1 and woven 1 it draws exactly what
 * <Logo variant="mark"/> draws, in the same order and colours. The weave is held back until the
 * rings touch: drawn during the slide, it only partly covers the crossing and leaves a hard cut.
 *
 * The optional props are the Duo Pop card's (DuoLockedScreen variant "pop"): the O starting in
 * the middle with a countdown ring in its layer, the Q fading in from further right, the ink O
 * taking over from the volt one at the lock. Transforms and opacity only. With none of them
 * passed, the output is what it always was (the launch intro, the tour and DUO LOCKED).
 */
export function RingsLock({ width, progress, woven, palette, oFrom, qFrom, qOpacity, oOpacity, oOverlay }: RingsLockProps) {
  const { colors } = useTheme();
  const height = width * LOGO_MARK_ASPECT;
  const travel = ringTravel(width);
  const oStart = oFrom ?? -travel;
  const qStart = qFrom ?? travel;
  const ink = palette?.ink ?? colors.text;
  const duo = palette?.duo ?? mix(colors.text, colors.background, 0.58);
  const viewBox = `${VB_X} ${VB_Y} ${VB_W} ${VB_H}`;

  const qStyle = useAnimatedStyle(() => {
    const transform = [{ translateX: (1 - progress.value) * qStart }];
    return qOpacity ? { opacity: qOpacity.value, transform } : { transform };
  });
  const oStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - progress.value) * oStart }] }));
  const oInkStyle = useAnimatedStyle(() => (oOpacity ? { opacity: oOpacity.value } : {}));
  const weaveStyle = useAnimatedStyle(() => ({
    opacity: qOpacity ? woven.value * qOpacity.value : woven.value,
    transform: [{ translateX: (1 - progress.value) * qStart }],
  }));

  const oInk = (
    <Svg width={width} height={height} viewBox={viewBox}>
      <Circle cx={CXA} cy={CY} r={R} fill="none" stroke={ink} strokeWidth={W} />
    </Svg>
  );

  // The mark is decoration, so it is hidden from VoiceOver as a whole; with an overlay (the
  // countdown ring, which is a timer VoiceOver should read) only the ring layers are hidden.
  const hideLayer = oOverlay
    ? ({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const)
    : {};

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden={!oOverlay}
      importantForAccessibility={oOverlay ? "auto" : "no-hide-descendants"}
      style={{ width, height }}
    >
      <Animated.View {...hideLayer} style={[StyleSheet.absoluteFill, qStyle]}>
        <Svg width={width} height={height} viewBox={viewBox}>
          <Circle cx={CXB} cy={CY} r={R} fill="none" stroke={duo} strokeWidth={W} />
          <Circle cx={NUB.cx} cy={NUB.cy} r={NUB.r} fill={duo} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, oStyle]}>
        {oOverlay}
        {oOpacity ? (
          <Animated.View {...hideLayer} style={[StyleSheet.absoluteFill, oInkStyle]}>
            {oInk}
          </Animated.View>
        ) : (
          oInk
        )}
      </Animated.View>
      <Animated.View {...hideLayer} style={[StyleSheet.absoluteFill, weaveStyle]}>
        <Svg width={width} height={height} viewBox={viewBox}>
          <Path d={SEG_PATH} fill="none" stroke={duo} strokeWidth={W} />
        </Svg>
      </Animated.View>
    </View>
  );
}
