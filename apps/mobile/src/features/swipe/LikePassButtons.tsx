import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface LikePassButtonsProps {
  onLike: () => void;
  onPass: () => void;
  disabled?: boolean;
}

export function LikePassButtons({ onLike, onPass, disabled }: LikePassButtonsProps) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.xl,
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
  icon: {
    fontSize: 28,
    fontWeight: "700",
  },
});
