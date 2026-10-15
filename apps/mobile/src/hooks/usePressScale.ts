import { useCallback } from "react";
import {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

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
 *
 * A VIEW WITH ITS OWN ANIMATED OPACITY PASSES IT IN AS `dim`. Never put a second animated style
 * that writes `opacity` on the same view as `press.style`: each useAnimatedStyle pushes only the
 * keys that changed in it, so whichever wrote last wins. Under Reduce Motion this style writes
 * opacity on every press, and a press-out that lands late (Pressability can fire it on a JS timer
 * up to 130ms after the press-in, later still when the JS thread is busy) would put a button that
 * had just faded to disabled back at full opacity, with nothing left to correct it. With `dim`
 * given, this one style writes opacity, always, as `dim` times the press dim:
 *
 *   const dim = useSharedValue(1);   // withTiming to 0.45 when disabled
 *   const press = usePressScale(0.94, dim);
 *   <Animated.View style={[styles.body, press.style]}>   // no separate dim style
 *
 * Button does this, and so must the chat send button and anything else that fades a disabled
 * state on the view it presses.
 */
export function usePressScale(pressedScale = 0.97, dim?: SharedValue<number>) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);

  const onPressIn = useCallback(() => {
    pressed.value = withSpring(1, SPRINGS.press);
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, SPRINGS.release);
  }, [pressed]);

  const style = useAnimatedStyle(() => {
    const base = dim ? dim.value : 1;
    if (reduced) return { opacity: base * (1 - 0.15 * pressed.value) };
    const scale = { transform: [{ scale: 1 - (1 - pressedScale) * pressed.value }] };
    return dim ? { opacity: base, ...scale } : scale;
  }, [reduced, pressedScale, dim]);

  return { style, onPressIn, onPressOut };
}
