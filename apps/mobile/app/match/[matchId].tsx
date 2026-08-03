import { useEffect } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { Button } from "@/components/Button";
import { GrainOverlay } from "@/components/GrainOverlay";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useTheme } from "@/theme/useTheme";

const DISC_SIZE = 180;
const AVATAR_SIZE = 160;

/** One of the two glow discs that spring together behind the avatar — pass a negative
 * `fromX` for the disc that starts left of center, positive for the one starting right. */
function GlowDisc({ color, fromX }: { color: string; fromX: number }) {
  const { radius } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, { damping: 14 });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1 - progress.value) * fromX },
      { scale: 0.8 + progress.value * 0.2 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: (AVATAR_SIZE - DISC_SIZE) / 2,
          left: (AVATAR_SIZE - DISC_SIZE) / 2,
          width: DISC_SIZE,
          height: DISC_SIZE,
          borderRadius: radius.round,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function MatchCelebrationScreen() {
  const { colors, spacing, type } = useTheme();
  const { matchId, name, photo } = useLocalSearchParams<{ matchId: string; name?: string; photo?: string }>();

  return (
    <ScreenContainer aurora="none">
      <GraticuleBackground variant="match" />
      <GrainOverlay />

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
        <Animated.Text
          entering={FadeIn.duration(400)}
          style={{ ...type.screenTitle, color: colors.text, textAlign: "center" }}
        >
          It&apos;s a duo!
        </Animated.Text>

        {photo ? (
          <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, alignItems: "center", justifyContent: "center" }}>
            <GlowDisc color={colors.glowPink} fromX={-90} />
            <GlowDisc color={colors.glowViolet} fromX={90} />

            <Animated.View entering={FadeInUp.springify().delay(150)}>
              <Image
                source={{ uri: photo }}
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: AVATAR_SIZE / 2,
                  borderWidth: 3,
                  borderColor: colors.pink,
                }}
                cachePolicy="memory-disk"
                transition={200}
              />
            </Animated.View>
          </View>
        ) : null}

        <Animated.Text
          entering={FadeIn.duration(400).delay(350)}
          style={{ ...type.body, color: colors.textMuted, textAlign: "center" }}
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
    </ScreenContainer>
  );
}
