import { forwardRef, type ReactNode, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { quickExiting } from "@/theme/entering";
import { SPRINGS } from "@/theme/motion";
import { motion } from "@/theme/tokens";

import { STACK_DEPTH, initialSlotDepth, initialSlotOpacity, slotTransform } from "./deckStack";
import { SwipeCard, type SwipeCardContext, type SwipeCardTrigger } from "./SwipeCard";
import type { DeckCard, SwipeDirection } from "./types";

export interface SwipeDeckHandle {
  like: () => void;
  pass: () => void;
}

/** A card put back on top after its swipe failed. The nonce changes on every restore, so the same
 * card restored twice in one burst still mounts afresh and slides in again. */
export interface RestoredCard {
  profileId: string;
  direction: SwipeDirection;
  nonce: number;
}

interface SwipeDeckProps {
  cards: DeckCard[];
  /** A card has left the screen: the card that left, which by then may no longer be the first in
   * `cards` (a card put back after a failed swipe goes in front of it). */
  onSwiped: (card: DeckCard, direction: SwipeDirection) => void;
  /** "party" for the party deck, whose pair counts are not about you. Defaults to "deck". */
  context?: SwipeCardContext;
  /** The top card's swipe is decided (released past the line, flicked, or sent by a button), up
   * to 320ms before onSwiped. The Deck starts perform_swipe here. */
  onDecided?: (card: DeckCard, direction: SwipeDirection) => void;
  /** A swipe refused because canCommit is false (the free daily limit). */
  onBlocked?: (card: DeckCard, direction: SwipeDirection) => void;
  /** False at the free limit: releases bounce back and the buttons nudge the card. Default true. */
  canCommit?: boolean;
  /** The card being put back after a failed swipe, so it slides in from the side it left. */
  restored?: RestoredCard | null;
}

/**
 * The stack of three cards. The Deck passes the decide-early, limit and restore props
 * (useDeckSwipeFlow); the party deck passes none of them and keeps its own flow, but both get the
 * same rise: each card sits in a StackSlot whose depth springs to its new place when the card
 * above it leaves.
 */
export const SwipeDeck = forwardRef<SwipeDeckHandle, SwipeDeckProps>(function SwipeDeck(
  { cards, onSwiped, context = "deck", onDecided, onBlocked, canCommit = true, restored = null },
  ref,
) {
  const [trigger, setTrigger] = useState<SwipeCardTrigger | null>(null);
  // A counter, not Date.now(): two taps in the same millisecond are still two presses.
  const triggerCountRef = useRef(0);
  const visibleCards = cards.slice(0, STACK_DEPTH);
  // False through the deck's first commit: the cards it mounts with are simply in place (the
  // whole deck fades in on the Deck screen). Any card that mounts after that joins a stack already
  // on screen and rises into place. Read by StackSlot only when it first mounts.
  const deckMountedRef = useRef(false);
  useEffect(() => {
    deckMountedRef.current = true;
  }, []);

  useImperativeHandle(ref, () => ({
    like: () => press("like"),
    pass: () => press("pass"),
  }));

  /** A Duo or Pass tap, for the card on top right now. The trigger names that card, and only that
   * card is handed it (below), so it can never fire on a card that reaches the top later. */
  function press(direction: SwipeDirection) {
    const top = cards[0];
    if (!top) return;
    triggerCountRef.current += 1;
    const nonce = triggerCountRef.current;
    if (!canCommit) {
      setTrigger({ direction, nonce, kind: "nudge", profileId: top.profile_id });
      onBlocked?.(top, direction);
      return;
    }
    setTrigger({ direction, nonce, kind: "commit", profileId: top.profile_id });
  }

  /** A card's exit finished. Bound per card (like onDecided), so it reports the card that actually
   * left, never whichever card is on top by the time the exit's callback runs. */
  function handleSwiped(card: DeckCard, direction: SwipeDirection) {
    setTrigger(null);
    onSwiped(card, direction);
  }

  return (
    <View style={styles.container}>
      {visibleCards.map((card, indexFromTop) => {
        const isRestored = restored?.profileId === card.profile_id;
        // A restored card gets a fresh key, so it mounts again (and slides in) even when the
        // same profile was already in this batch's stack.
        const key = isRestored ? `${card.profile_id}:r${restored.nonce}` : card.profile_id;
        return (
          <StackSlot
            key={key}
            index={indexFromTop}
            count={visibleCards.length}
            deckMounted={deckMountedRef.current}
            restored={isRestored}
          >
            <SwipeCard
              card={card}
              isTop={indexFromTop === 0}
              onSwiped={(direction) => handleSwiped(card, direction)}
              externalTrigger={indexFromTop === 0 && trigger?.profileId === card.profile_id ? trigger : null}
              context={context}
              onDecided={onDecided ? (direction) => onDecided(card, direction) : undefined}
              onBlocked={onBlocked ? (direction) => onBlocked(card, direction) : undefined}
              canCommit={canCommit}
              enterFrom={isRestored ? restored.direction : undefined}
            />
          </StackSlot>
        );
      })}
    </View>
  );
});

/**
 * One place in the stack. `depth` springs to the card's index on SPRINGS.stack whenever it
 * changes (the card above left), so the card behind rises to full size instead of jumping; the
 * transform comes from slotTransform. A card that joins a deck already on screen starts one step
 * behind the stack, hidden, and rises while it fades up (deckStack.ts). The slot fades out quickly
 * if its card leaves without being swiped (a refresh replacing the deck).
 */
function StackSlot({
  index,
  count,
  deckMounted,
  restored,
  children,
}: {
  index: number;
  count: number;
  deckMounted: boolean;
  restored: boolean;
  children: ReactNode;
}) {
  const start = { index, deckMounted, restored };
  // Read once: useSharedValue ignores its argument after the first render.
  const depth = useSharedValue(initialSlotDepth(start));
  const appear = useSharedValue(initialSlotOpacity(start));

  useEffect(() => {
    depth.value = withSpring(index, SPRINGS.stack);
  }, [index, depth]);

  useEffect(() => {
    // A new back card fades up as it rises. A fade, so Reduce Motion keeps it.
    if (appear.value < 1) {
      appear.value = withTiming(1, { duration: motion.reveal, reduceMotion: ReduceMotion.Never });
    }
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const { scale, translateY } = slotTransform(depth.value);
    return { opacity: appear.value, transform: [{ scale }, { translateY }] };
  });

  const isTop = index === 0;
  // Two views: the exit fade on the outer one, the rise on the inner one. A layout animation and
  // an animated style writing the same opacity on one view fight (Reanimated warns about it).
  return (
    <Animated.View
      exiting={quickExiting()}
      style={[StyleSheet.absoluteFill, { zIndex: count - index }]}
      pointerEvents={isTop ? "auto" : "none"}
      // The two cards peeking under the top one are scenery: VoiceOver and TalkBack skip
      // them, or they read two more names and two dimmed "See full profile" buttons.
      accessibilityElementsHidden={!isTop}
      importantForAccessibility={isTop ? "auto" : "no-hide-descendants"}
    >
      <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
