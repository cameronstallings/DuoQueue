import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

type Variant = "primary" | "secondary" | "ghost" | "premium"
  /** @deprecated Volt migration alias — DELETE in Task 11 */
  | "solar";

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  /** `sm` for buttons that live inside cards or rows — quieter padding, hugs its
   * label instead of stretching. `md` (default) is the full-size screen-level CTA. */
  size?: "sm" | "md";
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

/** Solid fills only: volt = act, amber = pay. Paper resolves volt to olive ink, so no scheme branch here. */
export function Button({ label, onPress, loading, disabled, variant = "primary", size = "md" }: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;
  const v = variant === "solar" ? "premium" : variant;

  const textColor =
    v === "primary" ? colors.onVolt : v === "premium" ? colors.onAmber : colors.text;
  const fill =
    v === "primary" ? colors.volt : v === "premium" ? colors.amber : undefined;

  const contentStyle = {
    borderRadius: radius.button,
    paddingVertical: size === "sm" ? spacing.sm + 2 : spacing.md + 2,
    paddingHorizontal: size === "sm" ? spacing.lg : spacing.xl,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        { borderRadius: radius.button, opacity: isDisabled ? 0.45 : 1 },
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <View
        style={[
          styles.content,
          contentStyle,
          fill ? { backgroundColor: fill } : null,
          v === "secondary" ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } : null,
        ]}
      >
        <ButtonLabel label={label} color={textColor} loading={loading} />
      </View>
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
