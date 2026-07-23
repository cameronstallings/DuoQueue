import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

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
        <Ionicons name="close" size={30} color={colors.danger} />
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
          <Ionicons name="diamond" size={20} color={colors.success} />
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
        <Ionicons name="flash" size={28} color={colors.info} />
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
});
