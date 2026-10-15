import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from "react-native-reanimated";

import { useToastStore } from "@/store/toast-store";
import { quickExiting, revealEntering } from "@/theme/entering";
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
 * place.
 *
 * REDUCE MOTION. Normally the toast rises 25pt as it fades in and sinks as it fades out
 * (FadeInDown / FadeOutDown). Those builders carry the slide and the fade together, and a
 * builder's reduceMotion setting covers every property it animates: passing ReduceMotion.Never
 * would keep the slide, and leaving the default would cut the fade too, so the toast would pop.
 * So under Reduce Motion it swaps to the plain fades from theme/entering.ts (revealEntering in,
 * quickExiting out), which pass Never: the toast still arrives and leaves gently, it just does
 * not move. `reduced` is Reanimated's launch-time reading, the same one its default
 * ReduceMotion.System resolves against, so the two paths always agree.
 *
 * Error toasts buzz (hapticError) from the store, not from here. */
export function Toast() {
  const { colors, motion, radius, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
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
          entering={reduced ? revealEntering() : FadeInDown.duration(motion.base)}
          exiting={reduced ? quickExiting() : FadeOutDown.duration(motion.base)}
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
