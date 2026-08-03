import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useTheme } from "@/theme/useTheme";

interface ModalHeaderProps {
  title: string;
  onClose?: () => void;
}

/** The shared modal title row: a screen-title on the left, a round close button
 * on the right. Defaults `onClose` to `router.back()` since every current caller
 * is a pushed modal — pass an explicit handler for anything else. */
export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  const { colors, radius, spacing, type } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingBottom: spacing.md,
      }}
    >
      <Text style={[type.screenTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose ?? (() => router.back())}
        hitSlop={8}
        style={{
          width: 34,
          height: 34,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.round,
        }}
      >
        <Ionicons name="close" size={19} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
