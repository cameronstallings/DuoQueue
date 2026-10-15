import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { SwipeQuota, SwipeResult } from "@duoqueue/shared-types";

import { matchParams } from "@/features/match/matchMoment";
import { hapticError } from "@/lib/haptics";
import { toUserMessage } from "@/lib/userMessage";

import { cardPicture, showsDuoLabel } from "./cardChips";
import { canCommitSwipe } from "./deckStripCopy";
import type { RestoredCard } from "./SwipeDeck";
import type { DeckCard, SwipeDirection } from "./types";
import { SwipeLimitReachedError, useSwipeAction } from "./useSwipeAction";

interface DeckSwipeFlowOptions {
  /** useDeck's: drop the top card from the queue once it has left the screen. */
  popTop: () => void;
  /** useDeck's: put a card back on top after its swipe failed. */
  restoreTop: (card: DeckCard) => void;
  /** The cached swipe quota (useSwipeQuota), for the free-limit check. */
  quota: SwipeQuota | undefined;
  /** Opens the paywall on its page about the daily limit. */
  openLimitPaywall: () => void;
  /** A like went through without making a match (the push pre-ask listens for it). */
  onLiked?: (card: DeckCard) => void;
}

/**
 * The Deck's swipe, from the release to the server and back. SwipeDeck reports three moments:
 *
 * - onDecided: the finger let go past the line (or flicked), or a button sent the card. The swipe
 *   STARTS here, while the card is still leaving, so perform_swipe is in flight up to 320ms
 *   earlier than it used to be and DUO LOCKED opens the moment the server says it is a match,
 *   often before the card has finished going.
 * - onSwiped: the card has left. It comes off the queue, and the swipe started at onDecided is
 *   awaited (or started now, if nothing decided it first). A failure puts the card back, sliding in
 *   from the side it left (`restored`, with a fresh nonce so it remounts even in the same batch).
 * - onBlocked: the free limit stopped a release or a tap (canCommit false). The card has already
 *   bounced back with its warning tap; this opens the paywall.
 *
 * One swipe per card: the pending promises are kept by profile_id, so a decision and its exit
 * share one RPC however the two arrive. The map is cleared on unmount, and nothing navigates once
 * the Deck is gone.
 *
 * Only the Deck uses this. Highlights, Requests and the party deck keep their own flows.
 */
export function useDeckSwipeFlow({ popTop, restoreTop, quota, openLimitPaywall, onLiked }: DeckSwipeFlowOptions) {
  const swipeAction = useSwipeAction({ optimisticQuota: true });
  const pendingRef = useRef(new Map<string, Promise<SwipeResult>>());
  const aliveRef = useRef(true);
  const restoreCountRef = useRef(0);
  const [restored, setRestored] = useState<RestoredCard | null>(null);

  // ONE PAYWALL PER BURST AT THE LIMIT. Swiping fast at 25 of 25 sends several refusals (or
  // several blocked releases) within a second; each opening the paywall would stack the modal or
  // throw the router a push while one is already presenting. The flag resets whenever the Deck
  // regains focus, which is also what closing the paywall does, so the next attempt after that
  // opens it again.
  const paywallOpenRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      paywallOpenRef.current = false;
    }, []),
  );

  useEffect(() => {
    const pending = pendingRef.current;
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      pending.clear();
    };
  }, []);

  const canCommit = canCommitSwipe(quota);

  function openPaywallOnce() {
    if (paywallOpenRef.current) return;
    paywallOpenRef.current = true;
    // Straight to the paywall rather than an alert that asks permission to show it.
    //
    // This is the app's highest-intent moment: somebody who has just spent every free swipe
    // is, by definition, using the thing the subscription unlocks. An OS alert in front of it
    // added a tap, put "Not now" in the reflexive-dismiss position, and named a price and a
    // benefit the paywall was about to state properly anyway.
    //
    // Nothing is lost by skipping it, because the paywall is a modal with the close X on every
    // page: dismissing is one gesture, and the deck is still underneath with the card
    // restored above.
    //
    // It opens on page one, which for this entry is about the limit ("Out of swipes for today").
    openLimitPaywall();
  }

  function start(card: DeckCard, direction: SwipeDirection): Promise<SwipeResult> {
    const pending = pendingRef.current.get(card.profile_id);
    if (pending) return pending;
    const promise = swipeAction.mutateAsync({ targetId: card.profile_id, direction });
    pendingRef.current.set(card.profile_id, promise);
    promise.then(
      (result) => {
        if (!aliveRef.current) return;
        if (result.matched && result.match_id) {
          // DUO LOCKED fires the one success haptic at the moment the rings lock.
          router.push({
            pathname: "/match/[matchId]",
            params: matchParams({
              matchId: result.match_id,
              name: card.display_name,
              photo: cardPicture(card),
              canDuo: showsDuoLabel(card),
              sharedGames: card.shared_games_count,
            }),
          });
        } else if (direction === "like") {
          onLiked?.(card);
        }
      },
      // The failure is handled once, in onSwiped, after the card has left.
      () => {},
    );
    return promise;
  }

  function onDecided(card: DeckCard, direction: SwipeDirection) {
    void start(card, direction);
  }

  async function onSwiped(card: DeckCard, direction: SwipeDirection) {
    popTop();
    try {
      await start(card, direction);
    } catch (err) {
      if (!aliveRef.current) return;
      // The card already animated off and the RPC failed, so put it back at the front of the
      // deck instead of silently discarding an unrecorded swipe.
      restoreTop(card);
      restoreCountRef.current += 1;
      setRestored({ profileId: card.profile_id, direction, nonce: restoreCountRef.current });
      if (err instanceof SwipeLimitReachedError) {
        openPaywallOnce();
      } else {
        hapticError();
        Alert.alert("Something went wrong", toUserMessage(err, "Please try again."));
      }
    } finally {
      pendingRef.current.delete(card.profile_id);
    }
  }

  /** SwipeDeck's onBlocked (it passes the card and direction; the paywall needs neither). */
  function onBlocked() {
    openPaywallOnce();
  }

  return { onDecided, onSwiped, onBlocked, canCommit, restored };
}
