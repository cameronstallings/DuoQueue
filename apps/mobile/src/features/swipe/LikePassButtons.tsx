import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface LikePassButtonsProps {
  onLike: () => void;
  onPass: () => void;
  onSuperPing?: () => void;
  disabled?: boolean;
}

export function LikePassButtons({ onLike, onPass, onSuperPing, disabled }: LikePassButtonsProps) {
  const { colors, spacing, shadow } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: spacing.lg,
        paddingVertical: spacing.md,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pass"
        onPress={onPass}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          shadow,
          {
            backgroundColor: colors.surface,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: pressed && !disabled ? 0.92 : 1 }],
          },
        ]}
      >
        <Text style={[styles.icon, { color: colors.danger }]}>✕</Text>
      </Pressable>

      {onSuperPing && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Super Ping"
          onPress={onSuperPing}
          disabled={disabled}
          style={({ pressed }) => [
            styles.smallButton,
            shadow,
            {
              backgroundColor: colors.surface,
              opacity: disabled ? 0.5 : 1,
              transform: [{ scale: pressed && !disabled ? 0.92 : 1 }],
            },
          ]}
        >
          <Text style={[styles.smallIcon, { color: colors.brand }]}>★</Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Like"
        onPress={onLike}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          shadow,
          {
            backgroundColor: colors.surface,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: pressed && !disabled ? 0.92 : 1 }],
          },
        ]}
      >
        <Text style={[styles.icon, { color: colors.success }]}>♥</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 26,
    fontWeight: "700",
  },
  smallIcon: {
    fontSize: 18,
    fontWeight: "700",
  },
});
