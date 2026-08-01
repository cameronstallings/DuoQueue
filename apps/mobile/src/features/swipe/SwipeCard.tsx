import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { ReportReason } from "@duoqueue/shared-types";

import { LinearGradient } from "expo-linear-gradient";

import { Name } from "@/components/Name";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { ReportModal } from "@/components/ReportModal";
import { useBlockUser, useReportUser } from "@/features/chat/useMatchActions";
import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { hapticLight } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

import { ProfileDetailContent } from "./ProfileDetailContent";
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

/** How many games you and this person both play, bucketed for the frame ink.
 *  This is a property of the pair, not a rating of the person — the same profile is
 *  a strong overlap to one viewer and a weak one to another, which is why it never
 *  appears on your own profile and there is nothing to game. */
function overlapBucket(count: number): "none" | "one" | "two" | "many" {
  if (count <= 0) return "none";
  if (count === 1) return "one";
  if (count === 2) return "two";
  return "many";
}

function overlapLabel(count: number): string {
  if (count <= 0) return "NO GAMES IN COMMON";
  if (count === 1) return "1 GAME IN COMMON";
  return `${count} GAMES IN COMMON`;
}

export function SwipeCard({ card, isTop, onSwiped, externalTrigger }: SwipeCardProps) {
  const { colors, radius, spacing, type, scrimRgb, shadowLifted, scheme } = useTheme();
  const bucket = overlapBucket(card.shared_games_count);
  const frameColor = colors.overlap[bucket];
  const [reportVisible, setReportVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const blockUser = useBlockUser();
  const reportUser = useReportUser();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const hasCrossedThreshold = useSharedValue(false);

  function handleMenu() {
    Alert.alert(card.display_name, undefined, [
      { text: "Report", onPress: () => setReportVisible(true) },
      {
        text: "Block",
        style: "destructive",
        onPress: () => {
          Alert.alert("Block this user?", "They will be removed from your deck.", [
            { text: "Cancel", style: "cancel" },
            { text: "Block", style: "destructive", onPress: () => blockUser.mutate(card.profile_id) },
          ]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function handleReportSubmit(reason: ReportReason, details: string) {
    reportUser.mutate(
      { reportedId: card.profile_id, reason, details: details || undefined },
      {
        onSuccess: () => {
          setReportVisible(false);
          Alert.alert("Report submitted", "Thanks — our team will review this.");
        },
        onError: (err) => {
          Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
        },
      },
    );
  }

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

      const crossed = Math.abs(event.translationX) > SWIPE_THRESHOLD;
      if (crossed !== hasCrossedThreshold.value) {
        hasCrossedThreshold.value = crossed;
        if (crossed) runOnJS(hapticLight)();
      }
    })
    .onEnd((event) => {
      hasCrossedThreshold.value = false;
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

  return (
    <>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.card,
            {
              borderRadius: radius.lg,
              // The card is a printed object: a coloured frame around an inset photo
              // window, not a full-bleed photo with text floating on it.
              backgroundColor: frameColor,
              borderWidth: scheme === "light" ? 2 : 1.5,
              borderColor: colors.ink,
              padding: 6,
            },
            shadowLifted,
            cardStyle,
          ]}
        >
          <View style={[styles.window, { borderRadius: radius.window, backgroundColor: colors.surfaceAlt }]}>
            {card.headerPhotoUrl ? (
              <Image
                source={{ uri: card.headerPhotoUrl }}
                style={styles.photo}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <View style={[styles.photo, { alignItems: "center", justifyContent: "center" }]}>
                <Text style={[type.label, { color: colors.textMuted }]}>No photo</Text>
              </View>
            )}

            {/* A real scrim rather than a flat 55% black bar — the type sits in a
                gradient so the photo stays visible right up to the copy. */}
            <LinearGradient
              colors={[`rgba(${scrimRgb},0)`, `rgba(${scrimRgb},0.72)`, `rgba(${scrimRgb},0.94)`]}
              locations={[0, 0.55, 1]}
              style={styles.scrim}
              pointerEvents="none"
            />

            {isTop && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Report or block"
                onPress={handleMenu}
                style={[styles.menuButton, { borderRadius: radius.chip, backgroundColor: `rgba(${scrimRgb},0.7)` }]}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#F5F1E8" />
              </Pressable>
            )}

            <Animated.View style={[styles.stamp, styles.likeStamp, likeStampStyle]}>
              <Text
                style={[
                  type.marquee,
                  styles.stampText,
                  { color: colors.onFill, backgroundColor: colors.accent, borderColor: colors.ink },
                ]}
              >
                LIKE
              </Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.passStamp, passStampStyle]}>
              <Text
                style={[
                  type.marquee,
                  styles.stampText,
                  { color: "#F5F1E8", backgroundColor: `rgba(${scrimRgb},0.92)`, borderColor: "#F5F1E8" },
                ]}
              >
                PASS
              </Text>
            </Animated.View>

            <View style={[styles.infoOverlay, { padding: spacing.md, gap: spacing.xs }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <PresenceAvatar
                  uri={card.profilePhotoUrl}
                  size={44}
                  isActive={card.isRecentlyActive}
                  backdropColor={`rgba(${scrimRgb},0.55)`}
                  borderColor="#F5F1E8"
                  borderWidth={2}
                />
                <View style={{ flex: 1 }}>
                  <Name variant="cardName" style={{ color: "#F5F1E8" }} numberOfLines={1}>
                    {card.display_name}
                  </Name>
                  <Text style={[type.stat, { color: "rgba(245,241,232,0.75)" }]}>
                    {card.age} · {REGION_LABELS[card.region] ?? card.region}
                    {card.languages.length > 0 ? ` · ${card.languages.join(" ").toUpperCase()}` : ""}
                  </Text>
                </View>
              </View>

              {card.topGames[0] && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                  <SkillBadge gameName={card.topGames[0].name} skillLevel={card.topGames[0].skillLevel} />
                </View>
              )}

              {card.prompts[0] && (
                <View style={{ marginTop: 2 }}>
                  <Text style={[type.label, { color: "rgba(245,241,232,0.6)" }]} numberOfLines={1}>
                    {card.prompts[0].question}
                  </Text>
                  <Text style={[type.quote, { color: "#F5F1E8" }]} numberOfLines={2}>
                    {card.prompts[0].answer}
                  </Text>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See full profile"
                onPress={() => setDetailVisible(true)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}
              >
                <Text style={[type.label, { color: "rgba(245,241,232,0.85)" }]}>See full profile</Text>
                <Ionicons name="chevron-up" size={13} color="rgba(245,241,232,0.85)" />
              </Pressable>
            </View>
          </View>

          {/* The overlap read, printed on the frame itself. Always spelled out in words
              so the frame colour is never the only thing carrying the meaning. */}
          <View style={styles.frameLabel}>
            <Text style={[type.statSm, { color: colors.onFill }]} numberOfLines={1}>
              {overlapLabel(card.shared_games_count)}
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>

      <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} onSubmit={handleReportSubmit} />

      <Modal visible={detailVisible} animationType="slide" onRequestClose={() => setDetailVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <ProfileDetailContent card={card} onClose={() => setDetailVisible(false)} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFillObject,
  },
  /** The inset photo window. Clipping lives here, not on the card, so the frame
   *  and its printed label stay visible outside it. */
  window: {
    flex: 1,
    overflow: "hidden",
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
  },
  menuButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  infoOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  frameLabel: {
    position: "absolute",
    left: 10,
    bottom: -1,
    height: 7,
    justifyContent: "center",
  },
  stamp: {
    position: "absolute",
    top: 36,
  },
  likeStamp: {
    left: 20,
    transform: [{ rotate: "-11deg" }],
  },
  passStamp: {
    right: 20,
    transform: [{ rotate: "11deg" }],
  },
  /** A stamped-on block, not outlined display text — it reads as ink applied to the
   *  card rather than a floating label. */
  stampText: {
    borderWidth: 2.5,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
});
