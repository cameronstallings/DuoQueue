import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ label, onPress, loading, disabled, variant = "primary" }: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;

  const background =
    variant === "primary" ? colors.brand : variant === "secondary" ? colors.surface : "transparent";
  const textColor = variant === "primary" ? "#FFFFFF" : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: colors.border,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
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
