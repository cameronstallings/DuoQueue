import { useCallback } from "react";
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

import { SPRINGS } from "@/theme/motion";

/**
 * The press every tappable surface shares: the thing gives way under the finger (scale to
 * `pressedScale`, 0.97 by default) on SPRINGS.press, and comes back on SPRINGS.release, which is a
 * touch livelier so letting go reads as a small bounce. It replaces the instant `pressed ? 0.97 :
 * 1` snap of a Pressable style function, which jumped a whole step in one frame.
 *
 * Spread the handlers onto the Pressable and put `style` on an Animated.View inside it (or
 * wrapping it):
 *
 *   const press = usePressScale();
 *   <Pressable onPressIn={press.onPressIn} onPressOut={press.onPressOut} ...>
 *     <Animated.View style={[styles.body, press.style]}>...</Animated.View>
 *   </Pressable>
 *
 * One `pressed` value runs 0 (up) to 1 (down) and the style maps it, so the spring is shared by
 * both styles below. Under Reduce Motion nothing scales: the surface dims by 0.15 instead (and the
 * spring itself cuts, as Reanimated does by default), so a press is still visible.
 */
export function usePressScale(pressedScale = 0.97) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);

  const onPressIn = useCallback(() => {
    pressed.value = withSpring(1, SPRINGS.press);
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, SPRINGS.release);
  }, [pressed]);

  const style = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1 - 0.15 * pressed.value };
    return { transform: [{ scale: 1 - (1 - pressedScale) * pressed.value }] };
  }, [reduced, pressedScale]);

  return { style, onPressIn, onPressOut };
}
