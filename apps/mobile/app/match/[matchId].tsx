import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { Button } from "@/components/Button";
import { GrainOverlay } from "@/components/GrainOverlay";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useTheme } from "@/theme/useTheme";

const AVATAR_SIZE = 160;
const BRACKET_SIZE = 64;
const BRACKET_OFFSET = 40;
const BRACKET_HUG_INSET = 10;

/** One of the two bracket glyphs that spring together around the avatar — pass a negative
 * `fromX` for the bracket that starts left of the pair, positive for the one starting right.
 * Same shared-value-driven spring the old aura discs used, re-skinned as mono brackets.
 * `flashOpacity`, when given, fires the merge flash once THIS glyph's spring settles —
 * only one of the pair needs to carry it, since both settle together. */
function BracketGlyph({
  glyph,
  edge,
  fromX,
  flashOpacity,
}: {
  glyph: string;
  edge: "left" | "right";
  fromX: number;
  flashOpacity?: SharedValue<number>;
}) {
  const { colors, fonts, motion } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, { damping: 14 }, (finished) => {
      if (finished && flashOpacity) {
        flashOpacity.value = withSequence(
          withTiming(0.18, { duration: motion.base }),
          withTiming(0, { duration: motion.base }),
        );
      }
    });
  }, [progress, flashOpacity, motion.base]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * fromX }],
  }));

  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: (AVATAR_SIZE - BRACKET_SIZE) / 2,
          ...(edge === "left" ? { left: -BRACKET_HUG_INSET } : { right: -BRACKET_HUG_INSET }),
          fontFamily: fonts.monoSemibold,
          fontSize: BRACKET_SIZE,
          lineHeight: BRACKET_SIZE,
          includeFontPadding: false,
          color: colors.volt,
        },
        animatedStyle,
      ]}
    >
      {glyph}
    </Animated.Text>
  );
}

export default function MatchCelebrationScreen() {
  const { colors, spacing, type } = useTheme();
  const { matchId, name, photo } = useLocalSearchParams<{ matchId: string; name?: string; photo?: string }>();
  const flashOpacity = useSharedValue(0);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  return (
    <ScreenContainer aurora="none">
      <GraticuleBackground variant="match" />
      <GrainOverlay />

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
        <Animated.Text
          entering={FadeIn.duration(400)}
          style={{
            ...type.label,
            fontSize: 16,
            lineHeight: 22,
            letterSpacing: 3,
            color: colors.volt,
            textAlign: "center",
          }}
        >
          DUO LOCKED
        </Animated.Text>

        {photo ? (
          <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, alignItems: "center", justifyContent: "center" }}>
            <BracketGlyph glyph="[" edge="left" fromX={-BRACKET_OFFSET} />
            <BracketGlyph glyph="]" edge="right" fromX={BRACKET_OFFSET} flashOpacity={flashOpacity} />

            <Animated.View entering={FadeInUp.springify().delay(150)}>
              <Image
                source={{ uri: photo }}
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: AVATAR_SIZE / 2,
                  borderWidth: 3,
                  borderColor: colors.volt,
                }}
                cachePolicy="memory-disk"
                transition={200}
              />
            </Animated.View>
          </View>
        ) : null}

        <Animated.Text
          entering={FadeIn.duration(400).delay(350)}
          style={{ ...type.body, color: colors.text, textAlign: "center" }}
        >
          You and {name ?? "your new match"} both queued up.
        </Animated.Text>

        <Animated.View entering={FadeInDown.duration(400).delay(500)} style={{ width: "100%", gap: spacing.sm }}>
          <Button
            label="Send a message"
            onPress={() => router.replace({ pathname: "/chat/[matchId]", params: { matchId } })}
          />
          <Button label="Keep swiping" variant="ghost" onPress={() => router.back()} />
        </Animated.View>
      </View>

      {/* Merge-beat flash — fires once the closing brackets' spring settles. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.volt }, flashStyle]}
      />
    </ScreenContainer>
  );
}
