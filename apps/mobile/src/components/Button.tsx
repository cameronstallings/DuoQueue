import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/theme/useTheme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ label, onPress, loading, disabled, variant = "primary" }: ButtonProps) {
  const { colors, radius, spacing, shadow } = useTheme();
  const isDisabled = disabled || loading;

  const textColor = variant === "primary" ? "#FFFFFF" : colors.text;

  const inner = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <Text style={[styles.label, { color: textColor }]}>{label}</Text>
  );

  if (variant === "primary") {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          {
            borderRadius: radius.pill,
            opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
            transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
            ...shadow,
          },
        ]}
      >
        <LinearGradient
          colors={[colors.brand, colors.brandDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, { borderRadius: radius.pill, paddingVertical: spacing.md, paddingHorizontal: spacing.xl }]}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: variant === "secondary" ? colors.surface : "transparent",
          borderRadius: radius.pill,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
          borderWidth: 1,
          borderColor: colors.border,
        },
      ]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
