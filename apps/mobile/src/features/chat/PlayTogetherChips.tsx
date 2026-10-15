import { useEffect } from "react";
import { Platform, ScrollView, View, type ViewProps } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Chip } from "@/components/Chip";
import { hapticSelection } from "@/lib/haptics";
import { layoutTransition, quickExiting } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { PLAY_TOGETHER_COPY, type DiscordChipState } from "./playTogether";

/** TalkBack's double tap arrives as this action. Android only: on iOS an "activate" entry would
 * show up as an extra custom action in the VoiceOver rotor, and onAccessibilityTap covers it. */
const ANDROID_ACTIVATE = [{ name: "activate" as const }];

/** How far a disabled chip dims. */
const DISABLED_OPACITY = 0.5;

/**
 * A chip's wrapper that FADES to half when it is disabled and back, as Button and the Like and
 * Pass buttons do, instead of snapping. A static opacity flipped 1, 0.5, 1 in single frames, so a
 * chip that is disabled for the length of a request (Share my Discord in flight) blinked.
 * ReduceMotion.Never: it is a fade.
 */
function DimmedWhenDisabled({ disabled, ...rest }: ViewProps & { disabled: boolean }) {
  const { motion } = useTheme();
  const dim = useSharedValue(disabled ? DISABLED_OPACITY : 1);
  useEffect(() => {
    dim.value = withTiming(disabled ? DISABLED_OPACITY : 1, { duration: motion.quick, reduceMotion: ReduceMotion.Never });
  }, [disabled, dim, motion.quick]);
  const style = useAnimatedStyle(() => ({ opacity: dim.value }));
  return <Animated.View {...rest} style={[rest.style, style]} />;
}

interface PlayTogetherChipsProps {
  /** "hidden" once shared (the chip fades out and the others slide left). */
  discord: DiscordChipState;
  /** The thread has loaded. Until then the band keeps its height but is invisible and inert. */
  ready: boolean;
  freeNowDisabled: boolean;
  discordBusy: boolean;
  onDiscord: () => void;
  onFreeNow: () => void;
  onPickTime: () => void;
}

/**
 * The chat's play-together row, one tap above the composer: Add or Share my Discord, I'm free
 * now, Pick a time. The decisions (which chips, what the Discord one says, the cooldown, the fit
 * at 375pt) are in playTogether.ts; this only draws them.
 *
 * NO JUMP. The band is laid out from the very first frame, at opacity 0 and ignoring touches
 * until the thread has loaded, then fades in. So the composer under it never moves when the
 * thread arrives. Under Reduce Motion the fade is skipped (the band simply appears).
 *
 * Plain Chips with no icons (an icon per chip overflows 343pt), in a horizontal ScrollView so a
 * large text size scrolls instead of wrapping. A chip that leaves fades out and the rest glide
 * into place; a disabled chip fades to half and ignores its tap. Every press is a selection tick
 * (the haptic map: chips); the screen's handler does the rest.
 */
export function PlayTogetherChips({
  discord,
  ready,
  freeNowDisabled,
  discordBusy,
  onDiscord,
  onFreeNow,
  onPickTime,
}: PlayTogetherChipsProps) {
  const { colors, motion, spacing } = useTheme();

  const opacity = useSharedValue(ready ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(ready ? 1 : 0, { duration: motion.base });
  }, [ready, opacity, motion.base]);
  const bandStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const chips: { key: string; label: string; disabled: boolean; onPress: () => void }[] = [];
  if (discord !== "hidden") {
    chips.push({
      key: "discord",
      label: discord === "share" ? PLAY_TOGETHER_COPY.shareDiscord : PLAY_TOGETHER_COPY.addDiscord,
      disabled: discordBusy,
      onPress: onDiscord,
    });
  }
  chips.push({ key: "free-now", label: PLAY_TOGETHER_COPY.freeNow, disabled: freeNowDisabled, onPress: onFreeNow });
  chips.push({ key: "pick-time", label: PLAY_TOGETHER_COPY.pickTime, disabled: false, onPress: onPickTime });

  return (
    <Animated.View
      pointerEvents={ready ? "auto" : "none"}
      style={[{ borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm }, bandStyle]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
      >
        {chips.map((chip) => {
          const press = () => {
            if (chip.disabled) return;
            hapticSelection();
            chip.onPress();
          };
          return (
            <Animated.View key={chip.key} layout={layoutTransition()} exiting={quickExiting()}>
              {/* The screen-reader element is this wrapper, not the chip: Chip's Pressable has no
                  disabled state to announce, so during the 5-minute cooldown or a Discord share in
                  flight VoiceOver read an active button that did nothing. Here it is a button with
                  the chip's words that says "dimmed" when disabled. VoiceOver's double tap lands on
                  onAccessibilityTap, TalkBack's on the activate action; both run `press`, which
                  ignores a disabled chip like a finger does. The chip inside is hidden from the
                  reader so it is not announced twice. */}
              <DimmedWhenDisabled
                disabled={chip.disabled}
                accessible
                accessibilityRole="button"
                accessibilityLabel={chip.label}
                accessibilityState={{ disabled: chip.disabled }}
                onAccessibilityTap={press}
                accessibilityActions={Platform.OS === "android" ? ANDROID_ACTIVATE : undefined}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "activate") press();
                }}
              >
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Chip label={chip.label} onPress={press} />
                </View>
              </DimmedWhenDisabled>
            </Animated.View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}
