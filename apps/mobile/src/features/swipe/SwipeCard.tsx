import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

import { SkillBadge } from "./SkillBadge";
import type { DeckCard, SwipeDirection } from "./types";

const SWIPE_THRESHOLD = 120;
const OFFSCREEN_DISTANCE = 500;

export interface SwipeCardTrigger {
  direction: SwipeDirection;
  nonce: number;
}

interface SwipeCardProps {
  card: DeckCard;
  isTop: boolean;
  onSwiped: (direction: SwipeDirection) => void;
  externalTrigger: SwipeCardTrigger | null;
}

export function SwipeCard({ card, isTop, onSwiped, externalTrigger }: SwipeCardProps) {
  const { colors, radius, spacing } = useTheme();
  const [photoIndex, setPhotoIndex] = useState(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  function complete(direction: SwipeDirection) {
    onSwiped(direction);
  }

  function animateOff(direction: SwipeDirection) {
    const targetX = direction === "like" ? OFFSCREEN_DISTANCE : -OFFSCREEN_DISTANCE;
    translateX.value = withTiming(targetX, { duration: 250 }, (finished) => {
      if (finished) runOnJS(complete)(direction);
    });
  }

  useEffect(() => {
    if (externalTrigger && isTop) {
      animateOff(externalTrigger.direction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTrigger?.nonce]);

  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction: SwipeDirection = event.translationX > 0 ? "like" : "pass";
        const targetX = direction === "like" ? OFFSCREEN_DISTANCE : -OFFSCREEN_DISTANCE;
        translateX.value = withTiming(targetX, { duration: 200 }, (finished) => {
          if (finished) runOnJS(complete)(direction);
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(translateX.value, [-300, 300], [-15, 15]);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, SWIPE_THRESHOLD], [0, 1]),
  }));
  const passStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -20], [1, 0]),
  }));

  const photo = card.photoUrls[photoIndex] ?? card.photoUrls[0];

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, { borderRadius: radius.lg, backgroundColor: colors.surface }, cardStyle]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, { alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ color: colors.textMuted }}>No photo</Text>
          </View>
        )}

        {card.photoUrls.length > 1 && (
          <>
            <View style={styles.dotsRow}>
              {card.photoUrls.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, { backgroundColor: i === photoIndex ? "#fff" : "rgba(255,255,255,0.4)" }]}
                />
              ))}
            </View>
            <Pressable
              style={styles.tapZoneLeft}
              onPress={() => setPhotoIndex((i) => Math.max(0, i - 1))}
            />
            <Pressable
              style={styles.tapZoneRight}
              onPress={() => setPhotoIndex((i) => Math.min(card.photoUrls.length - 1, i + 1))}
            />
          </>
        )}

        <Animated.View style={[styles.stamp, styles.likeStamp, likeStampStyle]}>
          <Text style={[styles.stampText, { color: colors.success, borderColor: colors.success }]}>LIKE</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.passStamp, passStampStyle]}>
          <Text style={[styles.stampText, { color: colors.danger, borderColor: colors.danger }]}>PASS</Text>
        </Animated.View>

        <View style={[styles.infoOverlay, { padding: spacing.md, gap: spacing.xs }]}>
          <Text style={styles.name}>
            {card.display_name}, {card.age}
          </Text>
          <Text style={styles.subtext}>
            {REGION_LABELS[card.region] ?? card.region}
            {card.languages.length > 0 ? ` · ${card.languages.join(", ").toUpperCase()}` : ""}
          </Text>

          {card.topGames.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {card.topGames.map((g) => (
                <SkillBadge key={g.name} gameName={g.name} skillLevel={g.skillLevel} />
              ))}
            </View>
          )}

          {card.topShows.length > 0 && (
            <Text style={styles.subtext} numberOfLines={1}>
              Watching: {card.topShows.join(", ")}
            </Text>
          )}

          {card.playstyles.length > 0 && (
            <Text style={styles.subtext} numberOfLines={1}>
              {card.playstyles.join(" · ")}
            </Text>
          )}

          {card.bio ? (
            <Text style={styles.bio} numberOfLines={3}>
              {card.bio}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const REGION_LABELS: Record<string, string> = {
  na_east: "NA East",
  na_west: "NA West",
  sa: "South America",
  eu: "Europe",
  mena: "MENA",
  africa: "Africa",
  asia: "Asia",
  sea: "SEA",
  oce: "Oceania",
};

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  photo: {
    ...StyleSheet.absoluteFill,
  },
  dotsRow: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  tapZoneLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 120,
    width: "35%",
  },
  tapZoneRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 120,
    width: "35%",
  },
  infoOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  name: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  subtext: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
  },
  bio: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
  },
  stamp: {
    position: "absolute",
    top: 40,
  },
  likeStamp: {
    left: 24,
    transform: [{ rotate: "-20deg" }],
  },
  passStamp: {
    right: 24,
    transform: [{ rotate: "20deg" }],
  },
  stampText: {
    fontSize: 32,
    fontWeight: "800",
    borderWidth: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
});
