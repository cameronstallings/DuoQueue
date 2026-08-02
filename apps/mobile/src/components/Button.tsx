import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/theme/useTheme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "solar";
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

/**
 * The Pressable is a bare shell — it only ever carries press scale, the glow, and
 * disabled opacity. The fill lives one level in: a gradient for primary/solar, a
 * glass tint for secondary, nothing for ghost. That split is what lets the glow
 * sit outside the gradient's own bounding box instead of getting clipped by it.
 */
export function Button({ label, onPress, loading, disabled, variant = "primary" }: ButtonProps) {
  const { colors, radius, spacing, glow, heroGradient, solarGradient } = useTheme();
  const isDisabled = disabled || loading;

  const textColor =
    variant === "primary" ? colors.onFill : variant === "solar" ? colors.onSolar : colors.text;

  const glowStyle =
    variant === "primary"
      ? glow(colors.glowViolet)
      : variant === "solar"
        ? glow(colors.glowSolar)
        : null;

  const contentStyle = {
    borderRadius: radius.button,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        { borderRadius: radius.button, opacity: isDisabled ? 0.45 : 1 },
        !isDisabled ? glowStyle : null,
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      {variant === "primary" || variant === "solar" ? (
        <LinearGradient
          {...(variant === "primary" ? heroGradient : solarGradient)}
          style={[styles.content, contentStyle]}
        >
          <ButtonLabel label={label} color={textColor} loading={loading} />
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.content,
            contentStyle,
            variant === "secondary"
              ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
              : null,
          ]}
        >
          <ButtonLabel label={label} color={textColor} loading={loading} />
        </View>
      )}
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
