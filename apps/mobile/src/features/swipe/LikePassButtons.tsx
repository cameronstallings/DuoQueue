import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { hapticLight } from "@/lib/haptics";
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

  function handlePressIn() {
    if (disabled) return;
    scale.value = withSpring(0.86, { damping: 14, stiffness: 380 });
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 9, stiffness: 220 });
  }

  function handlePress() {
    if (disabled) return;
    hapticLight();
    pulse.value = 0;
    pulse.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) });
    onPress();
  }

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
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
      <Animated.View style={[{ width: size, height: size }, style, { opacity: disabled ? 0.5 : 1 }, buttonStyle]}>
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
  const { colors, radius, spacing, type } = useTheme();

  // Glass: the shared surface+hairline pairing every non-primary circle uses now that
  // the dead `shadow` shim is gone — flat colors.surface alone had no edge to read by.
  const glassStyle = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border };

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

      {onSuperPing && (
        <View style={styles.smallButtonWrap}>
          <AnimatedIconButton
            size={48}
            ringColor={colors.success}
            accessibilityLabel="Super Ping — notify them you want to duo"
            onPress={onSuperPing}
            disabled={disabled}
            style={[{ borderRadius: radius.round }, glassStyle]}
          >
            <Ionicons name="diamond" size={20} color={colors.success} />
          </AnimatedIconButton>
          <Text style={[type.caption, { color: colors.textMuted }]}>Ping</Text>
        </View>
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  smallButtonWrap: {
    alignItems: "center",
    gap: 2,
  },
});
