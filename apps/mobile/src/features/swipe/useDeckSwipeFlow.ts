import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { SwipeQuota, SwipeResult } from "@duoqueue/shared-types";

import { matchParams } from "@/features/match/matchMoment";
import { useOnAppResume } from "@/hooks/useOnAppResume";
import { hapticError } from "@/lib/haptics";
import { toUserMessage } from "@/lib/userMessage";

import { cardPicture, showsDuoLabel } from "./cardChips";
import { canCommitSwipe } from "./deckStripCopy";
import type { RestoredCard } from "./SwipeDeck";
import type { DeckCard, SwipeDirection } from "./types";
import { SwipeLimitReachedError, useSwipeAction } from "./useSwipeAction";
import { SWIPE_QUOTA_QUERY_KEY } from "./useSwipeQuota";

/** How long a blocked swipe waits for the server's quota before trusting the cached one. Offline,
 * react-query holds the fetch until the network is back, and a paywall opening seconds after the
 * player has moved on would be worse than one opened on the cache. */
const FRESH_QUOTA_WAIT_MS = 1500;

interface DeckSwipeFlowOptions {
  /** useDeck's queue. Read only to notice a leaving card that left the queue without finishing its
   * exit (see the effect on it below). */
  cards: DeckCard[];
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
 *   bounced back with its warning tap; this checks the quota with the server and opens the paywall.
 *
 * One swipe per card: the pending promises are kept by profile_id, so a decision and its exit
 * share one RPC however the two arrive. The map is cleared on unmount, and nothing navigates once
 * the Deck is gone.
 *
 * PUTTING A CARD BACK WAITS FOR THE CARD THAT IS LEAVING. useDeck's popTop drops whatever is first
 * in the queue, and the card that is leaving stays first until its exit ends and onSwiped pops it.
 * Duo and Pass stay live while swipes are in flight, so a swipe can fail while the next card is on
 * its way out. Putting the failed card in front of it then would make the leaving card's onSwiped
 * pop the card just put back, and leave the swiped one first in the queue, off screen with its
 * input locked (the whole deck stops). So a failure that lands while a card is leaving waits, and
 * goes back the moment that card has been popped. Nothing else changes order under an exit: only
 * the top card can be decided, and SwipeCard drops a second decision while it leaves.
 *
 * Only the Deck uses this. Highlights, Requests and the party deck keep their own flows.
 */
export function useDeckSwipeFlow({ cards, popTop, restoreTop, quota, openLimitPaywall, onLiked }: DeckSwipeFlowOptions) {
  const queryClient = useQueryClient();
  const swipeAction = useSwipeAction({ optimisticQuota: true });
  const pendingRef = useRef(new Map<string, Promise<SwipeResult>>());
  const aliveRef = useRef(true);
  const restoreCountRef = useRef(0);
  const [restored, setRestored] = useState<RestoredCard | null>(null);
  /** The card that is decided and still leaving the screen, if any. At most one: only the top card
   * can be decided, and it stays first in the queue until its onSwiped pops it. */
  const leavingRef = useRef<string | null>(null);
  /** Failed swipes waiting for the leaving card to go before they are put back, oldest first. */
  const waitingRef = useRef<{ card: DeckCard; direction: SwipeDirection }[]>([]);

  // THE CACHED QUOTA IS A HINT. canCommit reads it, and nothing else refreshes it while the app sits
  // in memory: react-query is not wired to AppState here, and the Deck tab never remounts. A free
  // player who ran out yesterday and comes back after the reset would bounce off a count from
  // yesterday. So it is refetched when the app comes back to the foreground and when the Deck gains
  // focus, and a blocked swipe asks the server before it opens the paywall (onBlocked).
  const refreshQuota = useCallback(() => {
    // A swipe in flight is already counted in the cache; a refetch that lands before the server
    // has counted it would hand a swipe back for a moment. Its own success refetches anyway.
    if (pendingRef.current.size > 0) return;
    // cancelRefetch false: a fetch already in flight (the first one, on mount) is reused.
    void queryClient.invalidateQueries({ queryKey: SWIPE_QUOTA_QUERY_KEY }, { cancelRefetch: false });
  }, [queryClient]);
  useOnAppResume(refreshQuota);

  // ONE PAYWALL PER BURST AT THE LIMIT. Swiping fast at 25 of 25 sends several refusals (or
  // several blocked releases) within a second; each opening the paywall would stack the modal or
  // throw the router a push while one is already presenting. The flag resets whenever the Deck
  // regains focus, which is also what closing the paywall does, so the next attempt after that
  // opens it again.
  const paywallOpenRef = useRef(false);
  const checkingQuotaRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      paywallOpenRef.current = false;
      refreshQuota();
    }, [refreshQuota]),
  );

  useEffect(() => {
    const pending = pendingRef.current;
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      pending.clear();
      waitingRef.current = [];
    };
  }, []);

  const canCommit = canCommitSwipe(quota);

  function putBack(card: DeckCard, direction: SwipeDirection) {
    restoreTop(card);
    restoreCountRef.current += 1;
    setRestored({ profileId: card.profile_id, direction, nonce: restoreCountRef.current });
  }

  function putBackWaiting() {
    const waiting = waitingRef.current;
    waitingRef.current = [];
    for (const { card, direction } of waiting) putBack(card, direction);
  }

  // The leaving card is gone from the queue without its exit finishing: a refresh replaced the
  // deck under it, and the unmount cancelled the exit, so its onSwiped will never come. Nothing is
  // leaving any more, so whatever was waiting goes back now.
  //
  // Its swipe is let go of too. Only onSwiped's `finally` ever removed a pending swipe, so this one
  // stayed in the map for good: the Deck tab never unmounts, and a non-empty map makes refreshQuota
  // and the blocked-swipe check trust the cached quota for the rest of the run (a free player back
  // after the daily reset would get yesterday's paywall), and the same profile swiped again after a
  // refresh would reuse a promise that failed long ago instead of calling perform_swipe. It cannot
  // simply be deleted now: the request may still be in flight, and the map is what keeps the quota
  // refetch from landing before the server has counted it. So it leaves the map when it settles,
  // unless a newer swipe of the same profile has taken its place.
  useEffect(() => {
    const leavingId = leavingRef.current;
    if (leavingId === null || cards.some((card) => card.profile_id === leavingId)) return;
    leavingRef.current = null;
    const orphan = pendingRef.current.get(leavingId);
    if (orphan) {
      const forget = () => {
        if (pendingRef.current.get(leavingId) === orphan) pendingRef.current.delete(leavingId);
      };
      orphan.then(forget, forget);
    }
    putBackWaiting();
    // putBackWaiting reads only refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

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
    leavingRef.current = card.profile_id;
    void start(card, direction);
  }

  async function onSwiped(card: DeckCard, direction: SwipeDirection) {
    // This is the card that was leaving, and it was still first in the queue (anything that failed
    // meanwhile waited), so popTop takes it. Then the waiting cards go back in front.
    popTop();
    leavingRef.current = null;
    putBackWaiting();
    try {
      await start(card, direction);
    } catch (err) {
      if (!aliveRef.current) return;
      // The card already animated off and the RPC failed, so put it back at the front of the
      // deck instead of silently discarding an unrecorded swipe; after the next card's exit, if
      // one is under way.
      if (leavingRef.current === null) putBack(card, direction);
      else waitingRef.current.push({ card, direction });
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

  /** The quota as the server has it now, or undefined when it does not answer within
   * FRESH_QUOTA_WAIT_MS. A failed refetch keeps the cached quota, which is then what is returned. */
  async function freshQuota(): Promise<SwipeQuota | undefined> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), FRESH_QUOTA_WAIT_MS);
    });
    const refetched = queryClient
      .refetchQueries({ queryKey: SWIPE_QUOTA_QUERY_KEY, exact: true })
      .then(() => "done" as const);
    const outcome = await Promise.race([refetched, timedOut]);
    clearTimeout(timer);
    if (outcome === "timeout") return undefined;
    return queryClient.getQueryData<SwipeQuota>(SWIPE_QUOTA_QUERY_KEY);
  }

  async function checkQuotaThenPaywall() {
    if (paywallOpenRef.current || checkingQuotaRef.current) return;
    // With a swipe still in flight, this burst's count was written on this phone moments ago:
    // trust it. Otherwise the cache may be from before the daily reset, so ask first.
    if (pendingRef.current.size === 0) {
      checkingQuotaRef.current = true;
      let fresh: SwipeQuota | undefined;
      try {
        fresh = await freshQuota();
      } finally {
        checkingQuotaRef.current = false;
      }
      if (!aliveRef.current) return;
      // The count reset since the cache was written: the quota now in the cache lets the next
      // swipe through, and this one bounce was all it cost.
      if (fresh && canCommitSwipe(fresh)) return;
    }
    openPaywallOnce();
  }

  /** SwipeDeck's onBlocked (it passes the card and direction; the paywall needs neither). */
  function onBlocked() {
    void checkQuotaThenPaywall();
  }

  return { onDecided, onSwiped, onBlocked, canCommit, restored };
}
