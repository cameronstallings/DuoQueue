import { type ReactNode, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { hapticLight } from "@/lib/haptics";
import { layoutTransition, quickExiting, revealEntering } from "@/theme/entering";
import { SPRINGS } from "@/theme/motion";
import { motion, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

// No Legendary Like button in 1.0. send_rose spends a credit and then performs an
// ordinary like — the recipient sees nothing that distinguishes it — so the button
// promised something the app does not deliver, and its out-of-credits alert offered to
// sell more from a paywall that no longer lists them. The RPC and credits are intact;
// this comes back when a Legendary Like actually reads differently to whoever gets it.
interface LikePassButtonsProps {
  onLike: () => void;
  onPass: () => void;
  onSuperPing?: () => void;
  disabled?: boolean;
}

/** The Super Ping column's 48pt button. */
const PING_SIZE = 48;

/**
 * The row's height, which the Deck reserves whether or not the row is showing: the tallest column
 * (Super Ping's 48pt button, a 2pt gap and the 18pt "Ping" caption) plus spacing.md above and
 * below. Reserving it means the card area never changes height: not while the deck loads, not
 * when the row fades in with the first cards, and not when Super Ping appears for DuoQueue+.
 */
export const LIKE_PASS_ROW_HEIGHT = PING_SIZE + 2 + 18 + 2 * spacing.md;

/** A round icon button that springs down on press and pops back with a brief
 * expanding "ping" ring in the icon's own color on release — replaces the old
 * instant, non-animated pressed-state snap, which read as flat/unresponsive. */
function AnimatedIconButton({
  size,
  ringColor,
  disabled,
  accessibilityLabel,
  onPress,
  style,
  children,
}: {
  size: number;
  ringColor: string;
  disabled?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const pulse = useSharedValue(0);
  // The disabled state fades (and so never flashes) instead of snapping to 0.5. A fade, so it
  // plays under Reduce Motion too.
  const dim = useSharedValue(disabled ? 0.5 : 1);

  useEffect(() => {
    dim.value = withTiming(disabled ? 0.5 : 1, { duration: motion.quick, reduceMotion: ReduceMotion.Never });
  }, [disabled, dim]);

  function handlePressIn() {
    if (disabled) return;
    // Full configs (motion.ts): the old { damping: 14, stiffness: 380 } ran at Reanimated's
    // default mass of 4 and wobbled.
    scale.value = withSpring(0.86, SPRINGS.press);
  }

  function handlePressOut() {
    scale.value = withSpring(1, SPRINGS.release);
  }

  function handlePress() {
    if (disabled) return;
    hapticLight();
    pulse.value = 0;
    pulse.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) });
    onPress();
  }

  // One style writes the opacity and the scale, so nothing else can overwrite the dim.
  const buttonStyle = useAnimatedStyle(() => ({ opacity: dim.value, transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.55,
    transform: [{ scale: 1 + pulse.value * 0.7 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
    >
      <Animated.View style={[{ width: size, height: size }, style, buttonStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: size / 2, borderWidth: 2, borderColor: ringColor },
            ringStyle,
          ]}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{children}</View>
      </Animated.View>
    </Pressable>
  );
}

export function LikePassButtons({ onLike, onPass, onSuperPing, disabled }: LikePassButtonsProps) {
  const { colors, radius, type } = useTheme();

  // Glass: the shared surface+hairline pairing every non-primary circle uses now that
  // the dead `shadow` shim is gone — flat colors.surface alone had no edge to read by.
  const glassStyle = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border };

  // The row fades in with the first cards and out when the deck drains; the Deck keeps its
  // height reserved either way (LIKE_PASS_ROW_HEIGHT), so nothing around it moves. Pass and Duo
  // glide aside when Super Ping fades in between them, rather than jumping.
  return (
    <Animated.View
      entering={revealEntering()}
      exiting={quickExiting()}
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: LIKE_PASS_ROW_HEIGHT,
      }}
    >
      <Animated.View layout={layoutTransition()}>
        <AnimatedIconButton
          size={64}
          ringColor={colors.danger}
          accessibilityLabel="Pass"
          onPress={onPass}
          disabled={disabled}
          style={[{ borderRadius: radius.round }, glassStyle]}
        >
          <Ionicons name="close" size={30} color={colors.danger} />
        </AnimatedIconButton>
      </Animated.View>

      {onSuperPing && (
        <Animated.View entering={revealEntering()} exiting={quickExiting()} style={styles.smallButtonWrap}>
          <AnimatedIconButton
            size={PING_SIZE}
            ringColor={colors.success}
            accessibilityLabel="Super Ping, notify them you want to duo"
            onPress={onSuperPing}
            disabled={disabled}
            style={[{ borderRadius: radius.round }, glassStyle]}
          >
            <Ionicons name="diamond" size={20} color={colors.success} />
          </AnimatedIconButton>
          <Text style={[type.caption, { color: colors.textMuted }]}>Ping</Text>
        </Animated.View>
      )}

      <Animated.View layout={layoutTransition()}>
        <AnimatedIconButton
          size={64}
          ringColor={colors.volt}
          accessibilityLabel="Duo"
          onPress={onLike}
          disabled={disabled}
          style={[{ borderRadius: radius.round, backgroundColor: colors.volt }]}
        >
          <Ionicons name="flash" size={28} color={colors.onVolt} />
        </AnimatedIconButton>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  smallButtonWrap: {
    alignItems: "center",
    gap: 2,
  },
});
