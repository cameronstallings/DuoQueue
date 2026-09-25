import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotionLive } from "@/features/pager/useAccessibilityFlags";
import { useTheme } from "@/theme/useTheme";

import { TAP_HINT } from "./tourPages";

/**
 * Page 1's hint over Kai's picture: the right third outlined (CardFace's next-page zone), a ring
 * that pulses twice, and the two zone tags. It never takes a touch (the card's own tap zones are
 * under it) and it fades once the player has turned a page. Reduce Motion: no pulse.
 */
export function TapHint({ visible }: { visible: boolean }) {
  const { colors, radius, type } = useTheme();
  const reduced = useReduceMotionLive();
  const pulse = useSharedValue(1);
  const shown = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      // Switched on mid-pulse: stop where it is and stand still at rest.
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    // Twice, then still: a hint, not a loop.
    pulse.value = withRepeat(withSequence(withTiming(1.3, { duration: 420 }), withTiming(1, { duration: 420 })), 2, false);
  }, [reduced, pulse]);

  useEffect(() => {
    // A fade, so it stays under Reduce Motion, as CardFace's page cross-fade does.
    shown.value = withTiming(visible ? 1 : 0, { duration: 200, reduceMotion: ReduceMotion.Never });
  }, [visible, shown]);

  const hintStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const tag = {
    position: "absolute",
    borderWidth: 1,
    borderRadius: radius.chip,
    borderColor: colors.cardEdge,
    backgroundColor: colors.cardHero,
    paddingHorizontal: 8,
    paddingVertical: 5,
  } as const;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, hintStyle]}
    >
      <View
        style={{
          position: "absolute",
          top: 8,
          bottom: 8,
          right: 8,
          width: "31%",
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: colors.volt,
          borderRadius: radius.sm,
        }}
      />
      <Animated.View
        style={[
          {
            position: "absolute",
            right: "11%",
            top: "42%",
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: colors.volt,
            alignItems: "center",
            justifyContent: "center",
          },
          ringStyle,
        ]}
      >
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.volt }} />
      </Animated.View>
      <View style={[tag, { right: "5%", top: "58%" }]}>
        <Text style={[type.tick, { color: colors.textMuted }]}>{TAP_HINT.next}</Text>
      </View>
      <View style={[tag, { left: "8%", top: "48%" }]}>
        <Text style={[type.tick, { color: colors.textMuted }]}>{TAP_HINT.back}</Text>
      </View>
    </Animated.View>
  );
}
