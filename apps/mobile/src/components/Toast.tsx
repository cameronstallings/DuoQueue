import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from "react-native-reanimated";

import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

/** A brief bottom-anchored confirmation, e.g. "Saved" after an edit. Mounted once at
 * the root so it survives navigation triggered right after the action it confirms
 * (edit-prompts calls router.back() the moment it saves).
 *
 * THE CONTAINER IS ALWAYS MOUNTED (1.0.2). It used to return null when there was no message,
 * which unmounted the parent together with the toast, so the FadeOutDown never ran: Reanimated
 * only plays an exiting animation for a view whose parent stays mounted. Now the absolutely
 * positioned, touch-transparent container stays, only the toast itself comes and goes, and the
 * toast fades out instead of vanishing. `key={message}` makes a new toast that replaces an old one
 * a new view: the old one fades out as the new one fades in, rather than its text swapping in
 * place. Both animations pass ReduceMotion.Never, so under Reduce Motion the toast still arrives
 * and leaves gently instead of popping.
 *
 * Error toasts buzz (hapticError) from the store, not from here. */
export function Toast() {
  const { colors, motion, radius, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  const message = useToastStore((s) => s.message);
  const status = useToastStore((s) => s.status);

  const tint = status === "error" ? colors.danger : status === "info" ? colors.volt : colors.success;
  const icon = status === "error" ? "close-circle" : status === "info" ? "information-circle" : "checkmark-circle";

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
      {message ? (
        <Animated.View
          key={message}
          entering={FadeInDown.duration(motion.base).reduceMotion(ReduceMotion.Never)}
          exiting={FadeOutDown.duration(motion.base).reduceMotion(ReduceMotion.Never)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            maxWidth: "85%",
            backgroundColor: colors.surfaceSolid,
            borderWidth: 1,
            borderColor: colors.border,
            borderLeftWidth: 2,
            borderLeftColor: tint,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
          }}
        >
          <Ionicons name={icon} size={16} color={tint} />
          <Text style={[type.caption, { color: tint }]}>{message}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
