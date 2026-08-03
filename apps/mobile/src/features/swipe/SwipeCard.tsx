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

import { Chip } from "@/components/Chip";
import { Name } from "@/components/Name";
import { PageDots } from "@/components/PageDots";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { ReportModal } from "@/components/ReportModal";
import { useBlockUser, useReportUser } from "@/features/chat/useMatchActions";
import { REGION_LABELS, SKILL_LABELS } from "@/features/onboarding/profile-labels";
import { hapticLight } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

import { ProfileDetailContent } from "./ProfileDetailContent";
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
  /** Position in the deck queue (0-based) — renders as a mono "NO.00X" serial mark
   *  over the photo when provided; omitted hides the mark entirely. */
  index?: number;
}

/** How many games you and this person both play, bucketed for the shared-games chip
 *  ink. This is a property of the pair, not a rating of the person — the same profile
 *  is a strong overlap to one viewer and a weak one to another, which is why it never
 *  appears on your own profile and there is nothing to game. */
function overlapBucket(count: number): "none" | "one" | "two" | "many" {
  if (count <= 0) return "none";
  if (count === 1) return "one";
  if (count === 2) return "two";
  return "many";
}

function overlapLabel(count: number): string {
  if (count <= 0) return ">> NO GAMES IN COMMON";
  if (count === 1) return ">> 1 GAME IN COMMON";
  return `>> ${count} GAMES IN COMMON`;
}

export function SwipeCard({ card, isTop, onSwiped, externalTrigger, index }: SwipeCardProps) {
  const { colors, radius, spacing, type, scrimRgb } = useTheme();
  const bucket = overlapBucket(card.shared_games_count);
  const overlapColor = colors.overlap[bucket];
  const [reportVisible, setReportVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const blockUser = useBlockUser();
  const reportUser = useReportUser();

  // Header photo first, then approved gallery photos by position — falls back to the
  // single-photo "No photo" placeholder below when both are empty. This SwipeCard
  // instance is keyed by profile_id in SwipeDeck, so a fresh card always mounts with
  // photoIndex reset to 0 rather than carrying over the previous card's page.
  const photos = [card.headerPhotoUrl, ...card.galleryUrls].filter((url): url is string => !!url);
  const [photoIndex, setPhotoIndex] = useState(0);
  const currentPhoto = photos[Math.min(photoIndex, photos.length - 1)] ?? null;

  // Tap-to-page rather than a scroll gesture — a horizontal FlatList/ScrollView here
  // would fight the card's own Pan gesture (used for the like/pass swipe), since both
  // want to own horizontal drags. Left/right thirds is the standard dating-app idiom;
  // the middle third is inert so it doesn't collide with taps meant for the like/pass
  // gesture area.
  function goToPhoto(next: number) {
    setPhotoIndex(Math.min(Math.max(next, 0), photos.length - 1));
  }

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
              borderRadius: radius.card,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.xs,
            },
            cardStyle,
          ]}
        >
          {/* A solid surface + 1px seam border — the luminous gradient edge is gone,
              so every card now shares the same plain frame regardless of overlap. */}
          <View style={[styles.window, { borderRadius: radius.window, backgroundColor: colors.surfaceAlt }]}>
            {currentPhoto ? (
              <Image
                source={{ uri: currentPhoto }}
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

            {/* The serial mark — this card's position in the queue, printed like a
                frame counter. Sits under the menu button so the two corner marks
                don't collide on the top card. */}
            {index !== undefined && (
              <Text
                pointerEvents="none"
                style={[type.tick, styles.indexMark, { color: colors.voltRaw, opacity: 0.9 }]}
              >
                {`NO.${String(index + 1).padStart(3, "0")}`}
              </Text>
            )}

            {isTop && photos.length > 1 && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous photo"
                  onPress={() => goToPhoto(photoIndex - 1)}
                  style={styles.tapZoneLeft}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next photo"
                  onPress={() => goToPhoto(photoIndex + 1)}
                  style={styles.tapZoneRight}
                />
              </>
            )}

            {isTop && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Report or block"
                onPress={handleMenu}
                style={[
                  styles.menuButton,
                  { borderRadius: radius.chip, backgroundColor: `rgba(${scrimRgb},0.7)` },
                ]}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#F5F1E8" />
              </Pressable>
            )}

            {/* LIKE and PASS both read as plain outlined mono tags now — volt ink for
                the "yes" stamp, muted ink for the "no" one. No gradient fill, no
                glass pill. */}
            <Animated.View style={[styles.stamp, styles.likeStamp, likeStampStyle]}>
              <Text
                style={[
                  type.screenTitle,
                  styles.stampPill,
                  {
                    borderRadius: radius.chip,
                    color: colors.volt,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.volt,
                  },
                ]}
              >
                LIKE
              </Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.passStamp, passStampStyle]}>
              <Text
                style={[
                  type.screenTitle,
                  styles.stampPill,
                  {
                    borderRadius: radius.chip,
                    color: colors.textMuted,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.textMuted,
                  },
                ]}
              >
                PASS
              </Text>
            </Animated.View>

            <View style={[styles.infoOverlay, { padding: spacing.md, gap: spacing.xs }]}>
              {photos.length > 1 && (
                <View style={{ marginBottom: spacing.xs }}>
                  <PageDots count={photos.length} activeIndex={photoIndex} />
                </View>
              )}
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
                  <Text style={[type.caption, { color: "rgba(245,241,232,0.75)" }]}>
                    {card.age} · {REGION_LABELS[card.region] ?? card.region}
                    {card.languages.length > 0 ? ` · ${card.languages.join(" ").toUpperCase()}` : ""}
                  </Text>
                </View>
              </View>

              {card.topGames[0] && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                  <Chip label={card.topGames[0].name} detail={SKILL_LABELS[card.topGames[0].skillLevel]} />
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
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  marginTop: 4,
                }}
              >
                <Text style={[type.label, { color: "rgba(245,241,232,0.85)" }]}>See full profile</Text>
                <Ionicons name="chevron-up" size={13} color="rgba(245,241,232,0.85)" />
              </Pressable>
            </View>
          </View>

          {/* The overlap read. Always spelled out in words so the ink is never the
              only thing carrying the meaning — now a mono console line instead of a
              tinted chip, but still keyed to the pair's none/one/two/many tier ink,
              not a flat accent color. */}
          <View style={[styles.frameLabel, { paddingHorizontal: spacing.sm }]}>
            <View
              style={{
                flexDirection: "row",
                borderRadius: radius.chip,
                borderWidth: 1,
                borderColor: overlapColor,
                backgroundColor: colors.surface,
                paddingVertical: spacing.sm - 1,
                paddingHorizontal: spacing.md - 2,
              }}
            >
              <Text style={[type.tick, { color: overlapColor }]} numberOfLines={1}>
                {overlapLabel(card.shared_games_count)}
              </Text>
            </View>
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
  /** The inset photo window. Clipping lives here, not on the outer card, so the
   *  printed overlap label stays visible outside it, sitting on the card's own
   *  padding inside its seam border. */
  window: {
    flex: 1,
    overflow: "hidden",
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Tap targets for paging photos — left/right thirds of the window, full height so
   *  they're easy to hit, sitting under the menu button/stamps/info overlay (all
   *  rendered later, so their smaller hit areas take priority over these). */
  tapZoneLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "34%",
  },
  tapZoneRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "34%",
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
  /** The mono serial mark — parked below the menu button's 30px badge so the two
   *  corner marks never overlap on the top card. */
  indexMark: {
    position: "absolute",
    top: 48,
    right: 10,
  },
  infoOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  frameLabel: {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 6,
    alignItems: "center",
  },
  stamp: {
    position: "absolute",
    top: 32,
  },
  likeStamp: {
    left: 18,
    transform: [{ rotate: "-8deg" }],
  },
  passStamp: {
    right: 18,
    transform: [{ rotate: "8deg" }],
  },
  /** LIKE/PASS pill geometry — an outlined mono tag now, not a stamped block. */
  stampPill: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    overflow: "hidden",
  },
});
