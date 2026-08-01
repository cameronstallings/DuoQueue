import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
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

  return <Animated.Text style={[type.label, { color }, animatedStyle]}>{label}</Animated.Text>;
}

/**
 * A pressed button does not fade — it moves into its own shadow plate, the way a
 * physical key does. The plate is a hard zero-blur offset rather than a soft
 * elevation blur, which is what gives every surface in the app its printed feel.
 */
export function Button({ label, onPress, loading, disabled, variant = "primary" }: ButtonProps) {
  const { colors, radius, spacing, shadow, hairline } = useTheme();
  const isDisabled = disabled || loading;

  const fill =
    variant === "primary" ? colors.brand : variant === "secondary" ? colors.surface : "transparent";
  const textColor = variant === "primary" ? colors.onFill : colors.text;
  // In dark mode the pale keyline is what reads as the card edge; in light it is the
  // near-black stroke. Ghost buttons carry no plate and no stroke at all.
  const strokeColor = variant === "ghost" ? "transparent" : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: fill,
          borderRadius: radius.md,
          borderWidth: variant === "ghost" ? 0 : hairline,
          borderColor: strokeColor,
          paddingVertical: spacing.md + 2,
          paddingHorizontal: spacing.xl,
          opacity: isDisabled ? 0.45 : 1,
        },
        variant !== "ghost" && !isDisabled && !pressed ? shadow : null,
        // Travel exactly the distance the plate occupies, so the button lands on it.
        pressed && !isDisabled ? { transform: [{ translateX: 2 }, { translateY: 2 }] } : null,
      ]}
    >
      <ButtonLabel label={label} color={textColor} loading={loading} />
    </Pressable>
  );
}

/** A row of buttons that share a baseline. Exported so screens stop hand-rolling it. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return <View style={{ flexDirection: "row", gap: spacing.md }}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});
