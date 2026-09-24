import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Name } from "@/components/Name";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { type MatchExit, matchExitSteps, matchReason, type MatchRouteParams } from "@/features/match/matchMoment";
import { RingsLock } from "@/features/match/RingsLock";
import { ownPictureState } from "@/features/profile/pictureStatus";
import { useOwnProfilePhotos } from "@/features/profile/useOwnProfilePhotos";
import { useRequireSession } from "@/hooks/useRequireSession";
import { hapticSuccess } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { LOGO_MARK_ASPECT } from "@/theme/logo-geometry";
import { useTheme } from "@/theme/useTheme";

const MARK_W = 168;
const MARK_H = MARK_W * LOGO_MARK_ASPECT;
const BRACKET_SIZE = 96;
/** Room each side of the rings for a bracket glyph. Measured from the Plex Mono SemiBold outlines
 * against the mark's geometry: at 36 the "]" lower arm crosses the Q's tail (the nub) by ~6pt at
 * rest and ~10pt at the spring's peak (10% of BRACKET_TRAVEL). 52 leaves ~9.6pt at rest and
 * ~5.5pt at the peak, and the 272pt box still fits a 320pt-wide iPhone inside the 24pt gutters.
 * Vertical placement is still to confirm on the device. */
const BRACKET_SIDE = 52;
const LOCK_BOX_W = MARK_W + BRACKET_SIDE * 2;
const BRACKET_TRAVEL = 40;
const PLAYER_SIZE = 40;
/** The screen is a modal sheet that is still sliding up for about this long. */
const START_MS = 250;
const RINGS_MS = 520;
const LOCK_MS = START_MS + RINGS_MS;
/** The brackets set off late enough that their spring first reaches its target at the lock. */
const BRACKETS_AT_MS = START_MS + 380;
const FLASH_MS = 200;
/** Ease-in-out with no overshoot: the weave only reads right from 1.3R to 1.52R apart, so the
 * rings must never rebound past their place. The brackets carry the overshoot. Matches the site. */
const RING_EASING = Easing.bezier(0.65, 0, 0.35, 1);
const STAMP_EASING = Easing.bezier(0.23, 1, 0.32, 1);
/** Full config on purpose: Reanimated 4 merges a partial config over mass 4 / stiffness 900,
 * which turned the old { damping: 14 } into a five-second wobble with a late flash. This one is
 * a damping ratio of ~0.59: ~10% overshoot, settled in under a second. */
const BRACKET_SPRING = { mass: 1, stiffness: 420, damping: 24 } as const;

function BracketGlyph({
  glyph,
  edge,
  progress,
  opacity,
}: {
  glyph: "[" | "]";
  edge: "left" | "right";
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
}) {
  const { colors, fonts } = useTheme();
  const fromX = edge === "left" ? -BRACKET_TRAVEL : BRACKET_TRAVEL;
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: (1 - progress.value) * fromX }],
  }));

  return (
    <Animated.Text
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        {
          position: "absolute",
          top: (MARK_H - BRACKET_SIZE) / 2,
          ...(edge === "left" ? { left: 0 } : { right: 0 }),
          fontFamily: fonts.monoSemibold,
          fontSize: BRACKET_SIZE,
          lineHeight: BRACKET_SIZE,
          includeFontPadding: false,
          color: colors.volt,
        },
        style,
      ]}
    >
      {glyph}
    </Animated.Text>
  );
}

function PlayerChip({ label, name, uri }: { label: string; name: string; uri: string | null }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ width: LOCK_BOX_W / 2, alignItems: "center", gap: spacing.xs }}>
      <PresenceAvatar uri={uri} name={name} size={PLAYER_SIZE} />
      <Name variant="bodyStrong" numberOfLines={1} style={{ color: colors.text, maxWidth: LOCK_BOX_W / 2 - 8 }}>
        {label}
      </Name>
    </View>
  );
}

/**
 * DUO LOCKED: the logo made real. The O+Q rings start apart, one from each side, slide together
 * and interlock; the brackets snap shut around them with a slight overshoot; one flash, one
 * success haptic; "DUO LOCKED" stamps in (scale 1.25 to 1). Then the two players, the reason
 * strip (facts only), the sentence and the buttons. It works with or without pictures, and under
 * Reduce Motion the rings are already locked and everything fades in.
 */
export default function MatchCelebrationScreen() {
  useRequireSession();
  const { colors, radius, spacing, type } = useTheme();
  const params = useLocalSearchParams<MatchRouteParams>();
  const reason = matchReason(params);
  const theirName = params.name || "your new match";
  const reduced = useReducedMotion();
  const profile = useSessionStore((s) => s.profile);
  const { data: ownPhotos } = useOwnProfilePhotos(profile?.id);
  const ownPicture = ownPhotos ? ownPictureState(ownPhotos).url : null;

  const rings = useSharedValue(reduced ? 1 : 0);
  const woven = useSharedValue(reduced ? 1 : 0);
  const brackets = useSharedValue(reduced ? 1 : 0);
  const bracketsOpacity = useSharedValue(reduced ? 1 : 0);
  const stamp = useSharedValue(reduced ? 1 : 0);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      hapticSuccess();
      return;
    }
    rings.value = withDelay(
      START_MS,
      withTiming(1, { duration: RINGS_MS, easing: RING_EASING }, (finished) => {
        if (!finished) return;
        // The lock: the weave snaps in, one flash, the stamp, one haptic.
        woven.value = 1;
        flash.value = withSequence(withTiming(0.18, { duration: FLASH_MS }), withTiming(0, { duration: FLASH_MS }));
        stamp.value = withTiming(1, { duration: 260, easing: STAMP_EASING });
        runOnJS(hapticSuccess)();
      }),
    );
    bracketsOpacity.value = withDelay(BRACKETS_AT_MS, withTiming(1, { duration: 140 }));
    brackets.value = withDelay(BRACKETS_AT_MS, withSpring(1, BRACKET_SPRING));

    // "Keep swiping" can close the screen mid-animation.
    return () => {
      cancelAnimation(rings);
      cancelAnimation(brackets);
      cancelAnimation(bracketsOpacity);
      cancelAnimation(stamp);
      cancelAnimation(flash);
    };
  }, [reduced, rings, woven, brackets, bracketsOpacity, stamp, flash]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [{ scale: 1.25 - 0.25 * stamp.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  /** Everything after the lock fades in on a schedule counted from it; Reduce Motion keeps the
   * fades (ReduceMotion.Never) and drops the waiting. */
  function fadeAfterLock(ms: number) {
    return FadeIn.duration(300)
      .delay(reduced ? 0 : LOCK_MS + ms)
      .reduceMotion(ReduceMotion.Never);
  }
  const lockEntering = reduced ? FadeIn.duration(300).reduceMotion(ReduceMotion.Never) : undefined;
  const buttonsEntering = reduced
    ? FadeIn.duration(300).reduceMotion(ReduceMotion.Never)
    : FadeInDown.duration(400).delay(LOCK_MS + 500);

  function leave(exit: MatchExit) {
    const chat = { pathname: "/chat/[matchId]", params: { matchId: params.matchId } } as const;
    for (const step of matchExitSteps(exit, router.canGoBack())) {
      if (step === "back") router.back();
      else if (step === "replace-with-tabs") router.replace("/(tabs)");
      else if (step === "replace-with-chat") router.replace(chat);
      else router.push(chat);
    }
  }

  return (
    <ScreenContainer
      atmosphere="match"
      // The lock flash, edge to edge: among the children it would fill only the padded content.
      overlay={
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.volt }, flashStyle]} />
      }
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
        <Animated.View entering={lockEntering} style={{ alignItems: "center", gap: spacing.md }}>
          <View style={{ width: LOCK_BOX_W, height: MARK_H, alignItems: "center", justifyContent: "center" }}>
            <RingsLock width={MARK_W} progress={rings} woven={woven} />
            <BracketGlyph glyph="[" edge="left" progress={brackets} opacity={bracketsOpacity} />
            <BracketGlyph glyph="]" edge="right" progress={brackets} opacity={bracketsOpacity} />
          </View>
          <Animated.Text
            accessibilityRole="header"
            style={[
              { ...type.label, fontSize: 16, lineHeight: 22, letterSpacing: 3, color: colors.volt, textAlign: "center" },
              stampStyle,
            ]}
          >
            DUO LOCKED
          </Animated.Text>
        </Animated.View>

        {/* "You" under the O, them under the Q. */}
        <Animated.View entering={fadeAfterLock(120)} style={{ flexDirection: "row", width: LOCK_BOX_W }}>
          <PlayerChip label="You" name={profile?.display_name ?? "You"} uri={ownPicture} />
          <PlayerChip label={theirName} name={theirName} uri={params.photo || null} />
        </Animated.View>

        {reason && (
          <Animated.View
            entering={fadeAfterLock(350)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: radius.picture,
              borderWidth: 1,
              borderColor: colors.cardEdge,
              backgroundColor: colors.cardPanel,
            }}
          >
            {reason.kind === "duo" && <Ionicons name="people" size={16} color={colors.success} />}
            <Text style={[type.bodyStrong, { color: colors.text }]}>{reason.text}</Text>
          </Animated.View>
        )}

        <Animated.Text entering={fadeAfterLock(420)} style={{ ...type.body, color: colors.text, textAlign: "center" }}>
          You and {theirName} both queued up.
        </Animated.Text>

        <Animated.View entering={buttonsEntering} style={{ width: "100%", gap: spacing.sm }}>
          <Button label="Send a message" onPress={() => leave("message")} />
          <Button label="Keep swiping" variant="ghost" onPress={() => leave("keep-swiping")} />
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}
