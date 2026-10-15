import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { onlineManager } from "@tanstack/react-query";
import { router, useNavigationContainerRef } from "expo-router";

import { chatQueryKey } from "@/features/chat/useChatMessages";
import { fetchMatches, MATCHES_QUERY_KEY } from "@/features/chat/useMatches";
import {
  fetchMyParties,
  MY_PARTIES_QUERY_KEY,
  PARTY_INVITES_QUERY_KEY,
  partyMembersQueryKey,
  partyPendingInvitesQueryKey,
} from "@/features/party/useParty";
import { partyMessagesQueryKey } from "@/features/party/usePartyMessages";
import { isDuoLockedCelebrated, loadCelebrated, openDuoLocked } from "@/features/queue/openDuoLocked";
import { duoPopQueryKey } from "@/features/queue/useDuoPop";
import { QUEUE_UP_QUERY_KEY } from "@/features/queue/useQueueUp";
import {
  answerWithin,
  chatOpening,
  chatPush,
  frontScreen,
  isOnMatches,
  matchesOpening,
  notificationTapAction,
  partyOpening,
  partyPush,
  popOpening,
  shouldHandleTap,
  whenFront,
  type ChatOpening,
  type ChatPush,
  type FrontScreen,
  type NavigationReader,
  type PartyScreen,
} from "@/lib/notificationRouting";
import { queryClient } from "@/lib/query-client";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";

/** The Matches tab. A chat opened from a push sits on top of it, as one opened from the list does. */
const MATCHES_HREF = "/(tabs)/matches";

/**
 * How long a chat tap waits for the navigator to get somewhere: for the auth gate's redirect to
 * land on a cold start, and for the first move to land on Matches. Each normally takes a frame
 * or two. Past this the tap stands down, rather than keep a listener for a screen that is not
 * coming (the gate went to sign-in or onboarding instead, or the user went elsewhere).
 */
const NAVIGATION_WAIT_MS = 5000;

/**
 * How long the match list gets to answer before the chat is pushed without its answer. Unknown
 * means push (see `chatPush`), so this is the longest a tap can sit on Matches looking like it
 * did nothing, on a network that is up but crawling or failing through retries. The party list
 * gets the same bound for a party tap.
 */
const MATCH_READ_DEADLINE_MS = 4000;

/**
 * Sends a tapped push where it points: a "new players in your games" push to the deck, a new
 * message, a new match or an unread-message reminder to that chat, a party push to that party's
 * deck or chat, and a party invite to the Matches tab, where its banner is. Everything but the
 * deck lands on top of the Matches tab, except the two Duo Pop pushes: a Duo Pop opens its card
 * as a modal over whatever is in front (it has a ten-minute clock), and a grabbed pop's "Duo
 * locked" opens the sender's DUO LOCKED, once per lock on the phone (then the chat).
 *
 * Mounted once, from `RootLayout`. Two sources, because a tap arrives differently depending
 * on whether the app was already running: the listener catches warm taps, and one read of
 * `getLastNotificationResponseAsync()` catches the tap that launched the app from cold.
 *
 * The tap is HELD rather than acted on immediately — see `notificationRouting.ts` for why,
 * and for the four states where navigating is the wrong move. This hook is the wiring; the
 * decisions are there, with tests.
 *
 * Every other push category is deliberately left alone, and so is a chat push from a server
 * version before it named the match: there is nothing to route to, and resuming where the user
 * left off is right for all of them.
 *
 * WHERE THE APP IS, for the chat, is read off the navigation container when it is needed
 * (`useNavigationContainerRef().getRootState()`), not from `usePathname`/`useSegments`. Those
 * are legal here (in expo-router 6 they read a module-level store through
 * useSyncExternalStore, with no provider to be inside), but subscribing `RootLayout` to them
 * re-renders the root Stack on every navigation in the app, to answer a question asked only
 * when a push is tapped. A chat tap that has to wait for the navigator listens to the
 * container's "state" event instead, and only while it waits.
 */
export function useNotificationTapRouting(navigatorReady: boolean): void {
  const status = useSessionStore((s) => s.status);
  const profileStatus = useSessionStore((s) => s.profileStatus);
  const onboardingCompleted = useSessionStore((s) => s.profile?.onboarding_completed);
  const navigationRef = useNavigationContainerRef();
  const [pending, setPending] = useState<Notifications.NotificationResponse | null>(null);
  const handled = useRef<Set<string>>(new Set());
  // Stops whatever the last tap that goes by way of Matches is still waiting on (a navigation
  // listener, a timer) and marks it superseded, so a read that answers late stands down. Called
  // whenever a later tap is decided: the later tap owns navigation now.
  const cancelOpening = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      setPending(response);
    });
    // The cold-start half. Resolves to null when the app was opened normally.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!cancelled && response) setPending(response);
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!pending) return;

    const identifier = pending.notification.request.identifier;
    if (!shouldHandleTap(identifier, handled.current)) {
      setPending(null);
      return;
    }

    const data = pending.notification.request.content.data;
    const action = notificationTapAction({
      category: data?.category,
      matchId: data?.matchId,
      partyId: data?.partyId,
      popId: data?.popId,
      poppedIn: data?.poppedIn,
      duo: data?.duo,
      navigatorReady,
      sessionStatus: status,
      profileStatus,
      onboardingCompleted,
    });

    // Not ready yet. Keep holding it; this effect re-runs the moment the session or the
    // profile lands.
    if (action.kind === "wait") return;

    handled.current.add(identifier);
    setPending(null);
    cancelOpening.current?.();
    cancelOpening.current = null;

    if (action.kind === "ignore") return;

    if (action.kind === "open-deck") {
      // Invalidate before navigating so the deck is refetching by the time it renders. The push
      // exists because somebody new is in there, and arriving at a cached empty deck would undo
      // the whole point of sending it.
      void queryClient.invalidateQueries({ queryKey: ["deck"] });
      router.navigate("/(tabs)");
      return;
    }

    const nav: NavigationReader = {
      front: () => frontScreen(navigationRef.isReady() ? navigationRef.getRootState() : undefined),
      onChange: (callback) => navigationRef.addListener("state", () => callback()),
    };
    if (action.kind === "open-pop") cancelOpening.current = openPop(action.popId, nav);
    else if (action.kind === "open-duo-locked") cancelOpening.current = openSendersDuoLocked(action, nav);
    else if (action.kind === "open-chat") cancelOpening.current = openChat(action.matchId, nav);
    else if (action.kind === "open-party") cancelOpening.current = openParty(action.partyId, action.screen, nav);
    else cancelOpening.current = openMatches(nav);
  }, [pending, navigatorReady, status, profileStatus, onboardingCompleted, navigationRef]);
}

/**
 * A tapped Duo Pop: its card, as a modal over whatever is in front (popOpening). No detour
 * through Matches: the pop has a ten-minute clock, and its card closes back to where the player
 * was. On a cold start it waits for the auth gate's redirect to land first, like a chat; the same
 * pop already in front moves nothing, so a second tap never stacks a copy. The card's read is
 * marked stale first, so it opens on fresh numbers.
 */
function openPop(popId: string, nav: NavigationReader): () => void {
  void queryClient.invalidateQueries({ queryKey: duoPopQueryKey(popId) });
  return whenFront(
    nav,
    (front) => popOpening(front, popId) !== "wait-for-gate",
    (front) => {
      if (popOpening(front, popId) === "push") router.push({ pathname: "/pop/[popId]", params: { popId } });
    },
    NAVIGATION_WAIT_MS,
  );
}

/**
 * A tapped "Duo locked" (a grabbed pop's new_match push, for its sender): DUO LOCKED with
 * "Popped in 0:41", once per lock on this phone. If this phone already played it (the push landed
 * while the app was open, or the resume check found it), the tap is an ordinary new-match tap and
 * opens the chat. The celebrated list is read first, because on a cold start this tap can be
 * decided before anything else has loaded it.
 */
function openSendersDuoLocked(
  lock: { matchId: string; popId: string; poppedInSeconds: number; canDuo: boolean },
  nav: NavigationReader,
): () => void {
  void queryClient.invalidateQueries({ queryKey: QUEUE_UP_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });

  let cancelled = false;
  let stop: () => void = () => undefined;
  void loadCelebrated().then(() => {
    if (cancelled) return;
    if (isDuoLockedCelebrated(lock.popId)) {
      stop = openChat(lock.matchId, nav);
      return;
    }
    stop = whenFront(
      nav,
      (front) => front.kind !== "gate",
      () => void openDuoLocked({ ...lock, mode: "push" }),
      NAVIGATION_WAIT_MS,
    );
  });
  return () => {
    cancelled = true;
    stop();
  };
}

/** A tapped chat: its thread and the match list are stale until read, then the chat on top. */
function openChat(matchId: string, nav: NavigationReader): () => void {
  // Both before any screen renders them: the thread so it opens on the message the push
  // announced rather than on what was cached when the app was last open, and the list because
  // it is about to be read for this match and its unread count is stale too. The list refetches
  // now if it is on screen. The thread is only marked stale, never refetched here: an open
  // thread already re-reads itself on resume (catchUp), which keeps pending optimistic sends
  // (temp- rows), and a refetch through the queryFn would drop them; a thread that is not open
  // refetches when it mounts.
  void queryClient.invalidateQueries({ queryKey: chatQueryKey(matchId), refetchType: "none" });
  void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
  // A session proposal is pushed as a message for this match (0073); its card is a separate
  // query, refetched now so an already-open chat shows the Confirm banner the tap promised.
  void queryClient.invalidateQueries({ queryKey: ["match-sessions", matchId] });

  return viaMatches(nav, {
    opening: (front) => chatOpening(front, matchId),
    onTop: {
      // `staleTime: 0` so the answer is never older than this tap. Matches has landed by now, so
      // its own read (started by the invalidation above, or by mounting) is usually still in
      // flight, and this joins it, keeping that read's retries. `retry: false` applies only when
      // that read has already finished and this sends a new one. Either way the deadline is the
      // real bound.
      listed: () =>
        queryClient
          .fetchQuery({ queryKey: MATCHES_QUERY_KEY, queryFn: fetchMatches, staleTime: 0, retry: false })
          .then((matches) => matches.some((m) => m.match_id === matchId)),
      next: (matchListed, superseded, front) => chatPush({ superseded, matchListed, front }),
      push: () => router.push({ pathname: "/chat/[matchId]", params: { matchId } }),
      gone: "That conversation is no longer available",
    },
  });
}

/**
 * A tapped party push: that party's deck (started, joined) or chat (message), on top of Matches,
 * where "Your parties" is. Its messages are only marked stale for the same reason as a chat's
 * thread: an open party chat catches itself up (usePartyMessages), keeping its temp- rows.
 */
function openParty(partyId: string, screen: PartyScreen, nav: NavigationReader): () => void {
  void queryClient.invalidateQueries({ queryKey: partyMessagesQueryKey(partyId), refetchType: "none" });
  void queryClient.invalidateQueries({ queryKey: partyMembersQueryKey(partyId) });
  void queryClient.invalidateQueries({ queryKey: partyPendingInvitesQueryKey(partyId) });
  void queryClient.invalidateQueries({ queryKey: MY_PARTIES_QUERY_KEY });

  return viaMatches(nav, {
    opening: (front) => partyOpening(front, partyId, screen),
    onTop: {
      listed: () =>
        queryClient
          .fetchQuery({ queryKey: MY_PARTIES_QUERY_KEY, queryFn: fetchMyParties, staleTime: 0, retry: false })
          .then((parties) => parties.some((p) => p.party_id === partyId)),
      next: (partyListed, superseded, front) => partyPush({ superseded, partyListed, front }),
      push: () =>
        router.push({ pathname: screen === "chat" ? "/party/[partyId]/chat" : "/party/[partyId]", params: { partyId } }),
      gone: "That party is no longer available",
    },
  });
}

/** A tapped party invite: the Matches tab, with its invites banner already re-reading. */
function openMatches(nav: NavigationReader): () => void {
  void queryClient.invalidateQueries({ queryKey: PARTY_INVITES_QUERY_KEY });
  return viaMatches(nav, { opening: matchesOpening });
}

/** Where a tap that goes by way of the Matches tab is headed. */
interface ViaMatches {
  /** The first move, from wherever the app is (`chatOpening`, `partyOpening`, `matchesOpening`). */
  opening: (front: FrontScreen) => ChatOpening;
  /** The screen to push on top of Matches once the app is on it. Absent when Matches is the destination. */
  onTop?: {
    /** Whether the destination is still this account's, read fresh from the list Matches shows. */
    listed: () => Promise<boolean>;
    /** The second move, given that answer (`chatPush`, `partyPush`). */
    next: (listed: boolean | undefined, superseded: boolean, front: FrontScreen) => ChatPush;
    push: () => void;
    /** The toast for a destination the list no longer has. */
    gone: string;
  };
}

/**
 * Three steps, each waiting on the one before (the reasons are on `chatOpening` and
 * `chatPush`): past the auth gate, if it is in front; then to the Matches tab, at once, so the
 * tap visibly did something; then, once the app is ON Matches, the screen on top of it, after
 * the list Matches shows (`get_matches_summary`, `get_my_parties`) confirms it still exists. A
 * party invite stops after the second step: Matches is where it is answered. Returns a cancel
 * for the hook to call when a later tap is decided.
 *
 *   warm, on the deck or another tab   switch to Matches, then push
 *   warm, in another chat or a modal   dismiss down to the tabs on Matches, then push
 *   warm, already on that screen       move nothing (it refreshes itself)
 *   cold start                         the auth gate (app/index.tsx) is in front, and the
 *                                      decision usually lands in the commit that renders its
 *                                      Redirect to the tabs (where the session or the profile
 *                                      settles). That Redirect issues its replace a render
 *                                      later, so it would be queued behind anything moved now
 *                                      and undo it. Wait for the tab bar to come to the front,
 *                                      then go on as warm
 *   gone since the push                stay on Matches, with a toast
 *   offline                            push at once: the read would only be held, not sent
 *   list slow or failing               push at the deadline (or on the failure)
 *
 * The push waits for the first move to LAND, not just to be issued: expo-router queues router
 * calls and runs them later, so the app is still where it was the moment after `navigate` or
 * `dismissTo` returns, and `chatPush` would read that and stand down.
 */
function viaMatches(nav: NavigationReader, route: ViaMatches): () => void {
  const { opening, onTop } = route;
  let cancelled = false;
  const stops: (() => void)[] = [];
  const cancel = () => {
    cancelled = true;
    for (const stop of stops.splice(0)) stop();
  };

  const confirmThenPush = () => {
    if (!onTop) return;
    const decide = (listed: boolean | undefined) => {
      const next = onTop.next(listed, cancelled, nav.front());
      if (next === "push") onTop.push();
      else if (next === "gone") useToastStore.getState().showToast(onTop.gone, "info");
    };
    // Offline, TanStack would PAUSE the read until the network returned, so it is not sent:
    // the answer is unknown, and unknown pushes.
    if (!onlineManager.isOnline()) {
      decide(undefined);
      return;
    }
    stops.push(answerWithin(onTop.listed(), MATCH_READ_DEADLINE_MS, decide));
  };

  const firstMove = (front: FrontScreen) => {
    const first = opening(front);
    if (first === "already-open" || first === "wait-for-gate") return;
    if (first === "switch-to-matches") router.navigate(MATCHES_HREF);
    else router.dismissTo(MATCHES_HREF);
    if (onTop) stops.push(whenFront(nav, isOnMatches, confirmThenPush, NAVIGATION_WAIT_MS));
  };

  const pastGate = (front: FrontScreen) => opening(front) !== "wait-for-gate";
  stops.push(whenFront(nav, pastGate, firstMove, NAVIGATION_WAIT_MS));
  return cancel;
}
