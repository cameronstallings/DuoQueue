import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { ReportReason } from "@duoqueue/shared-types";

import { ReportModal } from "@/components/ReportModal";
import { useBlockUser, useReportUser } from "@/features/chat/useMatchActions";
import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { hapticLight, hapticMedium, hapticSelection, hapticWarning } from "@/lib/haptics";
import { SPRINGS } from "@/theme/motion";
import { motion } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

import { CARD_CELL_LABELS, CardFace } from "./CardFace";
import { type CardCellsMode, cardCells, cardDetailsLine, cardPages, cardPicture } from "./cardChips";
import { ProfileDetailContent } from "./ProfileDetailContent";
import { BLOCKED_NUDGE, SWIPE_THRESHOLD, exitDuration, exitY, offscreenX, releaseDecision } from "./swipeRelease";
import type { DeckCard, SwipeDirection } from "./types";

/**
 * A button press reaching the top card. "commit" (the default) sends it off the way the button
 * says; "nudge" is the free limit: the card leans BLOCKED_NUDGE toward that side and springs back,
 * with one warning tap, and nothing is swiped.
 */
export interface SwipeCardTrigger {
  direction: SwipeDirection;
  nonce: number;
  kind?: "commit" | "nudge";
}

/** Which deck the card sits in. The party deck's shared_games_count is counted against every
 * party member (get_party_deck), so it is not "games in common with you" and is not shown. */
export type SwipeCardContext = "deck" | "party";

interface SwipeCardProps {
  card: DeckCard;
  isTop: boolean;
  /** The card has left the screen. */
  onSwiped: (direction: SwipeDirection) => void;
  externalTrigger: SwipeCardTrigger | null;
  context: SwipeCardContext;
  /** The swipe is decided: the finger let go past the line (or flicked), or a button sent it. Fires
   * as the card starts to leave, up to 320ms before onSwiped, so the Deck can start perform_swipe
   * (and open DUO LOCKED) without waiting for the exit to finish. */
  onDecided?: (direction: SwipeDirection) => void;
  /** A release that would have counted, refused because canCommit is false. */
  onBlocked?: (direction: SwipeDirection) => void;
  /** False at the free daily limit: a release past the line bounces back instead of leaving.
   * Defaults to true (the party deck has no limit check). */
  canCommit?: boolean;
  /** A card coming back after its swipe failed starts off screen on the side it left and springs
   * back into place, instead of reappearing on top from nowhere. */
  enterFrom?: SwipeDirection;
}

export function SwipeCard({
  card,
  isTop,
  onSwiped,
  externalTrigger,
  context,
  onDecided,
  onBlocked,
  canCommit = true,
  enterFrom,
}: SwipeCardProps) {
  const { colors, radius, type } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const offscreen = offscreenX(windowWidth);
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

  // A restored card starts where it left the screen (enterFrom) and springs home in the effect
  // below; every other card starts in place.
  const translateX = useSharedValue(enterFrom === "like" ? offscreen : enterFrom === "pass" ? -offscreen : 0);
  const translateY = useSharedValue(0);
  const hasCrossedThreshold = useSharedValue(false);
  /** Set the moment a swipe is decided. From then on the card is leaving: the pan ignores a
   * second grab (which would cancel the exit and strand a card the server has already been told
   * about) and a second button tap is dropped. The card unmounts when it is popped, so it never
   * needs resetting. */
  const leaving = useSharedValue(false);

  useEffect(() => {
    if (enterFrom) translateX.value = withSpring(0, SPRINGS.release);
    // Mount only: enterFrom is fixed for the life of this card (a restore remounts it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function decided(direction: SwipeDirection) {
    onDecided?.(direction);
  }

  function blocked(direction: SwipeDirection) {
    onBlocked?.(direction);
  }

  /** A button sent the card: it is decided now (so the RPC starts), then it leaves on an
   * ease-out over motion.deliberate, faster at the start like a throw rather than the old linear
   * 250ms that set off slowly. */
  function animateOff(direction: SwipeDirection) {
    if (leaving.value) return;
    leaving.value = true;
    decided(direction);
    const targetX = direction === "like" ? offscreen : -offscreen;
    translateX.value = withTiming(
      targetX,
      { duration: motion.deliberate, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(complete)(direction);
      },
    );
  }

  /** The free limit: lean toward the side the button asked for, spring back, one warning tap. */
  function nudge(direction: SwipeDirection) {
    if (leaving.value) return;
    hapticWarning();
    const lean = direction === "like" ? BLOCKED_NUDGE : -BLOCKED_NUDGE;
    translateX.value = withSequence(
      withTiming(lean, { duration: motion.instant, easing: Easing.out(Easing.quad) }),
      withSpring(0, SPRINGS.release),
    );
  }

  useEffect(() => {
    if (externalTrigger && isTop) {
      if (externalTrigger.kind === "nudge") nudge(externalTrigger.direction);
      else animateOff(externalTrigger.direction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTrigger?.nonce]);

  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((event) => {
      if (leaving.value) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;

      const crossed = Math.abs(event.translationX) > SWIPE_THRESHOLD;
      if (crossed !== hasCrossedThreshold.value) {
        hasCrossedThreshold.value = crossed;
        if (crossed) runOnJS(hapticSelection)();
      }
    })
    .onEnd((event) => {
      if (leaving.value) return;
      hasCrossedThreshold.value = false;
      const direction = releaseDecision(event.translationX, event.velocityX);
      if (direction && canCommit) {
        // Decided at the release, not when the card has gone: the like (medium) or pass (light)
        // lands under the finger, and the Deck starts perform_swipe now.
        leaving.value = true;
        runOnJS(direction === "like" ? hapticMedium : hapticLight)();
        runOnJS(decided)(direction);
        // The card leaves at the speed it was thrown (swipeRelease.ts), keeping its vertical drift.
        const targetX = direction === "like" ? offscreen : -offscreen;
        const speed = direction === "like" ? event.velocityX : -event.velocityX;
        const ms = exitDuration(Math.abs(targetX - event.translationX), speed);
        const easing = Easing.out(Easing.quad);
        translateY.value = withTiming(exitY(event.translationY, event.velocityY, ms), { duration: ms, easing });
        translateX.value = withTiming(targetX, { duration: ms, easing }, (finished) => {
          if (finished) runOnJS(complete)(direction);
        });
        return;
      }
      if (direction) {
        // At the free limit: the release would have counted, so say why it bounced.
        runOnJS(hapticWarning)();
        runOnJS(blocked)(direction);
      }
      // Home on a full-config spring that starts at the release speed, so the snap-back carries
      // the throw instead of stopping dead and then springing.
      translateX.value = withSpring(0, { ...SPRINGS.release, velocity: event.velocityX });
      translateY.value = withSpring(0, { ...SPRINGS.release, velocity: event.velocityY });
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
