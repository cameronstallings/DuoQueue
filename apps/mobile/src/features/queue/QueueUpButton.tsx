import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { usePressScale } from "@/hooks/usePressScale";
import { hapticLight } from "@/lib/haptics";
import { quickEntering, quickExiting } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { QUEUE_UP_PILL, queueUpButtonLabel } from "./queueState";
import { useQueueUpSheetStore } from "./queueUpSheetStore";
import { useQueueState } from "./useQueueState";

/**
 * The deck header's Queue up control, exactly where the small "Online" link was (Cameron's
 * decision 7: it replaces that link and the free-to-duo switch, and must not clog the header).
 *
 * A fixed 84 x 28pt box, so nothing beside it ever moves: deckHeaderFit.ts measured the header
 * with this box at every iPhone width, and every label it can show (Queue up with its icon,
 * Queued 1m to Queued 60m) fits inside it. Not a pill shape: radius.button, a 1px volt edge.
 *
 *   idle     transparent, the radio icon in voltDim and "QUEUE UP" in volt
 *   queued   volt fill, "QUEUED 42M" in onVolt, no icon
 *
 * The label is keyed, so the two states (and each minute) cross-fade rather than snap, and the
 * fill fades with them (a fade, so it plays under Reduce Motion too). A press springs it down
 * (usePressScale) with a light tap and opens the Queue Up sheet.
 */
export function QueueUpButton() {
  const { colors, motion, radius, type } = useTheme();
  const state = useQueueState();
  const press = usePressScale(0.96);
  const queued = state.kind === "queued";
  const label = queueUpButtonLabel(state);

  const fill = useSharedValue(queued ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(queued ? 1 : 0, { duration: motion.quick, reduceMotion: ReduceMotion.Never });
  }, [queued, fill, motion.quick]);
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

  const spoken =
    state.kind === "queued"
      ? `Queued, ${state.minutesLeft} ${state.minutesLeft === 1 ? "minute" : "minutes"} left`
      : "Queue up";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      hitSlop={8}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        hapticLight();
        useQueueUpSheetStore.getState().open();
      }}
    >
      <Animated.View
        style={[
          {
            width: QUEUE_UP_PILL.width,
            height: QUEUE_UP_PILL.height,
            borderRadius: radius.button,
            borderWidth: QUEUE_UP_PILL.border,
            borderColor: colors.volt,
            overflow: "hidden",
          },
          press.style,
        ]}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.volt }, fillStyle]} />
        <Animated.View
          key={label}
          entering={quickEntering()}
          exiting={quickExiting()}
          style={[
            StyleSheet.absoluteFill,
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: QUEUE_UP_PILL.iconGap,
              paddingHorizontal: QUEUE_UP_PILL.paddingX,
            },
          ]}
        >
          {!queued && (
            <View>
              <Ionicons name="radio-outline" size={QUEUE_UP_PILL.iconSize} color={colors.voltDim} />
            </View>
          )}
          {/* Fixed size on purpose: the box is measured for 10pt (deckHeaderFit.ts), and the
              spoken label carries the same words for VoiceOver at any text size. */}
          <Animated.Text
            numberOfLines={1}
            maxFontSizeMultiplier={1}
            style={[type.chipText, { color: queued ? colors.onVolt : colors.volt }]}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * The control's face, standing still and touching nothing: the tour's Queue up page draws it
 * (TourPictures.tsx) so a new player knows the control before their first deck. Idle by default;
 * with `minutesLeft`, the queued face the control turns into once tapped ("QUEUED 60M"), which is
 * the whole picture outside North America, where a Queue up sends no Duo Pop. The same box, edge,
 * icon, fill and labels as QueueUpButton's two states above; change one, change both. Hidden from
 * VoiceOver: it is a picture of a button, and the page's heading says the words.
 */
export function QueueUpFace({ minutesLeft }: { minutesLeft?: number } = {}) {
  const { colors, radius, type } = useTheme();
  const queued = minutesLeft !== undefined;
  // The label reads only the minutes; a still picture has no expiry to count down to.
  const label = queueUpButtonLabel(queued ? { kind: "queued", minutesLeft, untilMs: 0 } : { kind: "idle" });
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: QUEUE_UP_PILL.width,
        height: QUEUE_UP_PILL.height,
        borderRadius: radius.button,
        borderWidth: QUEUE_UP_PILL.border,
        borderColor: colors.volt,
        backgroundColor: queued ? colors.volt : undefined,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: QUEUE_UP_PILL.iconGap,
        paddingHorizontal: QUEUE_UP_PILL.paddingX,
      }}
    >
      {queued ? null : <Ionicons name="radio-outline" size={QUEUE_UP_PILL.iconSize} color={colors.voltDim} />}
      <Text numberOfLines={1} maxFontSizeMultiplier={1} style={[type.chipText, { color: queued ? colors.onVolt : colors.volt }]}>
        {label}
      </Text>
    </View>
  );
}
