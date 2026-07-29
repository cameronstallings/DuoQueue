import { useEffect, useState } from "react";
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
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

export function SwipeCard({ card, isTop, onSwiped, externalTrigger }: SwipeCardProps) {
  const { colors, radius, spacing } = useTheme();
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
        <Animated.View style={[styles.card, { borderRadius: radius.lg, backgroundColor: colors.surface }, cardStyle]}>
          {card.headerPhotoUrl ? (
            <Image source={{ uri: card.headerPhotoUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={[styles.photo, { alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ color: colors.textMuted }}>No photo</Text>
            </View>
          )}

          {isTop && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Report or block"
              onPress={handleMenu}
              style={styles.menuButton}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
            </Pressable>
          )}

          <Animated.View style={[styles.stamp, styles.likeStamp, likeStampStyle]}>
            <Text style={[styles.stampText, { color: colors.info, borderColor: colors.info }]}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.passStamp, passStampStyle]}>
            <Text style={[styles.stampText, { color: colors.danger, borderColor: colors.danger }]}>PASS</Text>
          </Animated.View>

          <View style={[styles.infoOverlay, { padding: spacing.md, gap: spacing.xs }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <PresenceAvatar
                uri={card.profilePhotoUrl}
                size={44}
                isActive={card.isRecentlyActive}
                backdropColor="rgba(0,0,0,0.55)"
                borderColor="#fff"
                borderWidth={2}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {card.display_name}, {card.age}
                </Text>
              </View>
            </View>
            <Text style={styles.subtext}>
              {REGION_LABELS[card.region] ?? card.region}
              {card.languages.length > 0 ? ` · ${card.languages.join(", ").toUpperCase()}` : ""}
            </Text>

            {card.topGames[0] && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                <SkillBadge gameName={card.topGames[0].name} skillLevel={card.topGames[0].skillLevel} />
              </View>
            )}

            {card.prompts[0] && (
              <View style={{ marginTop: 2 }}>
                <Text style={styles.promptQuestion} numberOfLines={1}>
                  {card.prompts[0].question}
                </Text>
                <Text style={styles.promptAnswer} numberOfLines={2}>
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
              <Text style={styles.seeMoreText}>See full profile</Text>
              <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.85)" />
            </Pressable>
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
    overflow: "hidden",
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  menuButton: {
    position: "absolute",
    top: 16,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
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
  promptAnswer: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
  },
  promptQuestion: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  seeMoreText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
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
