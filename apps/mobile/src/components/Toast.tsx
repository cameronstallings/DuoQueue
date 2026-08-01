import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

/** A brief bottom-anchored confirmation, e.g. "Saved" after an edit. Mounted once at
 * the root so it survives navigation triggered right after the action it confirms
 * (edit-prompts calls router.back() the moment it saves). */
export function Toast() {
  const { colors, radius, spacing, shadow, type, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const message = useToastStore((s) => s.message);

  if (!message) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: insets.bottom + spacing.xl,
        alignItems: "center",
      }}
    >
      <Animated.View
        entering={FadeInDown.duration(200)}
        exiting={FadeOutDown.duration(200)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          maxWidth: "85%",
          backgroundColor: colors.brand,
          borderWidth: scheme === "light" ? 1.5 : 1,
          borderColor: colors.ink,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          ...shadow,
        }}
      >
        <Ionicons name="checkmark-circle" size={16} color={colors.onFill} />
        <Text style={[type.caption, { color: colors.onFill }]}>{message}</Text>
      </Animated.View>
    </View>
  );
}
