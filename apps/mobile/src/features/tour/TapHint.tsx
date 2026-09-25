import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotionLive } from "@/features/pager/useAccessibilityFlags";
import { useTheme } from "@/theme/useTheme";

import { TAP_HINT } from "./tourPages";

/** The ring's size and its pulse. At the pulse's peak the ring reaches (RING * (PULSE - 1)) / 2 =
 * 6pt past its box, so the tag sits RING_TAG_GAP below it and the two never touch. */
const RING = 40;
const PULSE = 1.3;
const RING_TAG_GAP = 12;
/** The room the NEXT PAGE tag is laid out in: more than the zone's width (about 100pt). */
const TAG_ROOM = 160;

/**
 * Page 1's hint over Kai's picture: the right third outlined (CardFace's next-page zone), a ring
 * that pulses twice, and the two zone tags. It never takes a touch (the card's own tap zones are
 * under it) and it fades once the player has turned a page. Reduce Motion: no pulse.
 *
 * The ring and its tag are one column centred in the zone, so a short picture (an iPhone SE, a
 * larger text size) moves them together instead of sliding the tag over the ring.
 *
 * Colour: voltRaw, never volt. The hint is drawn over Kai's artwork, which is dark in both
 * schemes, and Paper's volt is an olive ink (about 2:1 on the art, under the 3:1 a graphic needs).
 * voltRaw is chartreuse in both schemes (about 10:1 on the art). scripts/audit-contrast.mjs cannot
 * check a colour on a picture, so this one is checked on the render (b17-tour-1-paper).
 */
export function TapHint({ visible }: { visible: boolean }) {
  const { colors, radius, spacing, type } = useTheme();
  const reduced = useReduceMotionLive();
  const pulse = useSharedValue(1);
  const shown = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      // Switched on mid-pulse: stop where it is and stand still at rest.
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    // Twice, then still: a hint, not a loop.
    pulse.value = withRepeat(withSequence(withTiming(PULSE, { duration: 420 }), withTiming(1, { duration: 420 })), 2, false);
  }, [reduced, pulse]);

  useEffect(() => {
    // A fade, so it stays under Reduce Motion, as CardFace's page cross-fade does.
    shown.value = withTiming(visible ? 1 : 0, { duration: 200, reduceMotion: ReduceMotion.Never });
  }, [visible, shown]);

  const hintStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const tag = {
    borderWidth: 1,
    borderRadius: radius.chip,
    borderColor: colors.cardEdge,
    backgroundColor: colors.cardHero,
    paddingHorizontal: 8,
    paddingVertical: 5,
  } as const;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, hintStyle]}
    >
      <View
        style={{
          position: "absolute",
          top: 8,
          bottom: 8,
          right: 8,
          width: "31%",
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: colors.voltRaw,
          borderRadius: radius.sm,
          alignItems: "center",
          justifyContent: "center",
          gap: RING_TAG_GAP,
        }}
      >
        <Animated.View
          style={[
            {
              width: RING,
              height: RING,
              borderRadius: RING / 2,
              borderWidth: 2,
              borderColor: colors.voltRaw,
              alignItems: "center",
              justifyContent: "center",
            },
            ringStyle,
          ]}
        >
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.voltRaw }} />
        </Animated.View>
        {/* Wider than the zone and centred on it, so a larger text size never wraps the tag
            inside the zone's third of the picture. */}
        <View style={{ width: TAG_ROOM, alignItems: "center" }}>
          <View style={tag}>
            <Text style={[type.tick, { color: colors.textMuted }]}>{TAP_HINT.next}</Text>
          </View>
        </View>
      </View>
      <View style={{ position: "absolute", top: 0, bottom: 0, left: spacing.lg, justifyContent: "center" }}>
        <View style={tag}>
          <Text style={[type.tick, { color: colors.textMuted }]}>{TAP_HINT.back}</Text>
        </View>
      </View>
    </Animated.View>
  );
}
