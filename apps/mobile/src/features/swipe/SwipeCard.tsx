import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
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

import { ReportModal } from "@/components/ReportModal";
import { useBlockUser, useReportUser } from "@/features/chat/useMatchActions";
import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { hapticLight } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

import { CARD_CELL_LABELS, CardFace } from "./CardFace";
import { type CardCellsMode, cardCells, cardDetailsLine, cardPages, cardPicture } from "./cardChips";
import { ProfileDetailContent } from "./ProfileDetailContent";
import type { DeckCard, SwipeDirection } from "./types";

const SWIPE_THRESHOLD = 120;
const OFFSCREEN_DISTANCE = 500;

export interface SwipeCardTrigger {
  direction: SwipeDirection;
  nonce: number;
}

/** Which deck the card sits in. The party deck's shared_games_count is counted against every
 * party member (get_party_deck), so it is not "games in common with you" and is not shown. */
export type SwipeCardContext = "deck" | "party";

interface SwipeCardProps {
  card: DeckCard;
  isTop: boolean;
  onSwiped: (direction: SwipeDirection) => void;
  externalTrigger: SwipeCardTrigger | null;
  context: SwipeCardContext;
}

export function SwipeCard({ card, isTop, onSwiped, externalTrigger, context }: SwipeCardProps) {
  const { colors, radius, type } = useTheme();
  const [reportVisible, setReportVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  // Both sheets are React Native Modals, drawn over the whole window rather than inside this
  // screen, so leaving the screen does not take them with it: a tapped message push switches to
  // the Matches tab and pushes the chat, and an open profile would stay presented over both.
  // Closed on blur (and unmount), not hidden while blurred, so coming back to the deck does not
  // reopen a profile or a half-filled report out of nowhere.
  useFocusEffect(
    useCallback(
      () => () => {
        setDetailVisible(false);
        setReportVisible(false);
      },
      [],
    ),
  );
  const blockUser = useBlockUser();
  const reportUser = useReportUser();

  // This SwipeCard instance is keyed by profile_id in SwipeDeck, so each new card mounts on its
  // first page. The rules for pages and cells are in cardChips.ts.
  const mode: CardCellsMode =
    context === "deck" ? { kind: "deck", sharedGames: card.shared_games_count } : { kind: "party" };
  const pages = cardPages(cardPicture(card), card.prompts);
  const cells = cardCells(card, mode, CARD_CELL_LABELS);

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
          Alert.alert("Report submitted", "Thanks. Our team will review this.");
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
      transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { rotate: `${rotate}deg` }],
    };
  });

  const likeStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, SWIPE_THRESHOLD], [0, 1]),
  }));
  const passStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -20], [1, 0]),
  }));

  // The drag stamps are the only things ever drawn on the picture. Both are solid, so they read
  // on any image.
  const stamps = (
    <>
      <Animated.View pointerEvents="none" style={[styles.stamp, styles.likeStamp, likeStampStyle]}>
        <Text
          style={[
            type.screenTitle,
            styles.stampPill,
            { borderRadius: radius.chip, color: colors.volt, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.volt },
          ]}
        >
          DUO
        </Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.stamp, styles.passStamp, passStampStyle]}>
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
    </>
  );

  return (
    <>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          <CardFace
            name={card.display_name}
            details={cardDetailsLine(card, REGION_LABELS)}
            isActive={card.isRecentlyActive}
            pages={pages}
            cells={cells}
            interactive={isTop}
            profileRow
            onOpenProfile={() => setDetailVisible(true)}
            onMenu={handleMenu}
            pictureOverlay={stamps}
          />
        </Animated.View>
      </GestureDetector>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportSubmit}
        submitting={reportUser.isPending}
      />

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
  stampPill: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    overflow: "hidden",
  },
});
