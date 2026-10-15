import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { usePressScale } from "@/hooks/usePressScale";
import { hapticLight, hapticMedium, hapticSelection } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

type Variant = "primary" | "secondary" | "ghost" | "premium";

/** Which haptic a press fires, from the haptic map in lib/haptics.ts. */
export type ButtonHaptic = "light" | "medium" | "selection";

const HAPTICS: Record<ButtonHaptic, () => void> = {
  light: hapticLight,
  medium: hapticMedium,
  selection: hapticSelection,
};

/** How far a disabled (or loading) button fades. */
const DISABLED_OPACITY = 0.45;

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  /** `sm` for buttons that live inside cards or rows — quieter padding, hugs its
   * label instead of stretching. `md` (default) is the full-size screen-level CTA. */
  size?: "sm" | "md";
  /** A haptic fired on press, just before `onPress`, and never while disabled or loading. Use
   * this rather than calling a haptic inside `onPress`, so a button never buzzes twice. The map
   * in lib/haptics.ts says which: "light" for the wizard's Continue, "medium" for Queue up. */
  haptic?: ButtonHaptic;
}

/** The label while `loading` — pulses in place of a spinner so an in-flight button
 * matches the skeleton loading style used everywhere else, instead of a spinning wheel. */
function ButtonLabel({ label, color, loading }: { label: string; color: string; loading?: boolean }) {
  const { type, motion } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (loading) {
      opacity.value = withRepeat(withTiming(0.4, { duration: 700, easing: Easing.ease }), -1, true);
    } else {
      opacity.value = withTiming(1, { duration: motion.quick });
    }
  }, [loading, opacity, motion.quick]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.Text style={[type.bodyStrong, { color }, animatedStyle]}>{label}</Animated.Text>;
}

/** Solid fills only: volt = act, amber = pay. Paper resolves volt to olive ink, so no scheme branch here.
 *
 * Motion (1.0.2): a press springs the button down to 0.97 and back (usePressScale) instead of
 * snapping a whole step in one frame, and becoming disabled or busy fades it to 0.45 over
 * motion.quick (and back) instead of flashing. The fade is not movement, so it plays under
 * Reduce Motion too. */
export function Button({ label, onPress, loading, disabled, variant = "primary", size = "md", haptic }: ButtonProps) {
  const { colors, motion, radius, spacing } = useTheme();
  const isDisabled = !!(disabled || loading);
  const press = usePressScale(0.97);

  // Starts at the right value on the first frame (a button mounted disabled never fades down),
  // and only animates when the state actually changes.
  const dim = useSharedValue(isDisabled ? DISABLED_OPACITY : 1);
  useEffect(() => {
    dim.value = withTiming(isDisabled ? DISABLED_OPACITY : 1, {
      duration: motion.quick,
      reduceMotion: ReduceMotion.Never,
    });
  }, [isDisabled, dim, motion.quick]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  const textColor =
    variant === "primary" ? colors.onVolt : variant === "premium" ? colors.onAmber : colors.text;
  const fill =
    variant === "primary" ? colors.volt : variant === "premium" ? colors.amber : undefined;

  const contentStyle = {
    borderRadius: radius.button,
    paddingVertical: size === "sm" ? spacing.sm + 2 : spacing.md + 2,
    paddingHorizontal: size === "sm" ? spacing.lg : spacing.xl,
  };

  const handlePress = () => {
    if (isDisabled) return;
    if (haptic) HAPTICS[haptic]();
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      onPress={handlePress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={isDisabled}
      style={{ borderRadius: radius.button }}
    >
      <Animated.View
        style={[
          styles.content,
          contentStyle,
          fill ? { backgroundColor: fill } : null,
          variant === "secondary" ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } : null,
          press.style,
          dimStyle,
        ]}
      >
        <ButtonLabel label={label} color={textColor} loading={loading} />
      </Animated.View>
    </Pressable>
  );
}

/** A row of buttons that share a baseline. Exported so screens stop hand-rolling it. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return <View style={{ flexDirection: "row", gap: spacing.md }}>{children}</View>;
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
});
