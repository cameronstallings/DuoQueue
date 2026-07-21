import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface LikePassButtonsProps {
  onLike: () => void;
  onPass: () => void;
  onSuperPing?: () => void;
  disabled?: boolean;
}

export function LikePassButtons({ onLike, onPass, onSuperPing, disabled }: LikePassButtonsProps) {
  const { colors, spacing } = useTheme();

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
        style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.danger, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={[styles.icon, { color: colors.danger }]}>✕</Text>
      </Pressable>

      {onSuperPing && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Super Ping"
          onPress={onSuperPing}
          disabled={disabled}
          style={[styles.smallButton, { backgroundColor: colors.surface, borderColor: colors.brand, opacity: disabled ? 0.5 : 1 }]}
        >
          <Text style={[styles.smallIcon, { color: colors.brand }]}>★</Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Like"
        onPress={onLike}
        disabled={disabled}
        style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.success, opacity: disabled ? 0.5 : 1 }]}
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
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 28,
    fontWeight: "700",
  },
  smallIcon: {
    fontSize: 20,
    fontWeight: "700",
  },
});
