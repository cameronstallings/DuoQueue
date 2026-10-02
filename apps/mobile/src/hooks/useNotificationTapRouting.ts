import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { onlineManager } from "@tanstack/react-query";
import { router, useNavigationContainerRef } from "expo-router";

import { chatQueryKey } from "@/features/chat/useChatMessages";
import { fetchMatches, MATCHES_QUERY_KEY } from "@/features/chat/useMatches";
import {
  answerWithin,
  chatOpening,
  chatPush,
  frontScreen,
  isOnMatches,
  notificationTapAction,
  shouldHandleTap,
  whenFront,
  type FrontScreen,
  type NavigationReader,
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
 * did nothing, on a network that is up but crawling or failing through retries.
 */
const MATCH_READ_DEADLINE_MS = 4000;

/**
 * Sends a tapped push where it points: a "new players in your games" push to the deck, and a
 * new message, a new match or an unread-message reminder to that chat, on top of the Matches
 * tab.
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
  // Stops whatever the last chat tap is still waiting on (a navigation listener, a timer) and
  // marks it superseded, so a read that answers late stands down. Called whenever a later tap
  // is decided: the later tap owns navigation now.
  const cancelChat = useRef<(() => void) | null>(null);

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
    cancelChat.current?.();
    cancelChat.current = null;

    if (action.kind === "open-deck") {
      // Invalidate before navigating so the deck is refetching by the time it renders. The push
      // exists because somebody new is in there, and arriving at a cached empty deck would undo
      // the whole point of sending it.
      void queryClient.invalidateQueries({ queryKey: ["deck"] });
      router.navigate("/(tabs)");
    } else if (action.kind === "open-chat") {
      cancelChat.current = openChat(action.matchId, {
        front: () => frontScreen(navigationRef.isReady() ? navigationRef.getRootState() : undefined),
        onChange: (callback) => navigationRef.addListener("state", () => callback()),
      });
    }
  }, [pending, navigatorReady, status, profileStatus, onboardingCompleted, navigationRef]);
}

/**
 * Three steps, each waiting on the one before (the reasons are on `chatOpening` and
 * `chatPush`): past the auth gate, if it is in front; then to the Matches tab, at once, so the
 * tap visibly did something; then, once the app is ON Matches, the chat on top of it, after
 * `get_matches_summary` confirms the match still exists. Returns a cancel for the hook to call
 * when a later tap is decided.
 *
 *   warm, on the deck or another tab   switch to Matches, then push the chat
 *   warm, in another chat or a modal   dismiss down to the tabs on Matches, then push
 *   warm, already in this chat         refresh it, move nothing
 *   cold start                         the auth gate (app/index.tsx) is in front, and the
 *                                      decision usually lands in the commit that renders its
 *                                      Redirect to the tabs (where the session or the profile
 *                                      settles). That Redirect issues its replace a render
 *                                      later, so it would be queued behind anything moved now
 *                                      and undo it. Wait for the tab bar to come to the front,
 *                                      then go on as warm
 *   match gone since the push          stay on Matches, with a toast
 *   offline                            push at once: the read would only be held, not sent
 *   list slow or failing               push at the deadline (or on the failure)
 *
 * The push waits for the first move to LAND, not just to be issued: expo-router queues router
 * calls and runs them later, so the app is still where it was the moment after `navigate` or
 * `dismissTo` returns, and `chatPush` would read that and stand down.
 */
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

  let cancelled = false;
  const stops: (() => void)[] = [];
  const cancel = () => {
    cancelled = true;
    for (const stop of stops.splice(0)) stop();
  };

  const decide = (matchListed: boolean | undefined) => {
    const next = chatPush({ superseded: cancelled, matchListed, front: nav.front() });
    if (next === "push") {
      router.push({ pathname: "/chat/[matchId]", params: { matchId } });
    } else if (next === "gone") {
      useToastStore.getState().showToast("That conversation is no longer available", "info");
    }
  };

  const confirmThenPush = () => {
    // Offline, TanStack would PAUSE the read until the network returned, so it is not sent:
    // the answer is unknown, and unknown pushes.
    if (!onlineManager.isOnline()) {
      decide(undefined);
      return;
    }
    // `staleTime: 0` so the answer is never older than this tap. Matches has landed by now, so
    // its own read (started by the invalidation above, or by mounting) is usually still in
    // flight, and this joins it, keeping that read's retries. `retry: false` applies only when
    // that read has already finished and this sends a new one. Either way the deadline is the
    // real bound.
    const read = queryClient
      .fetchQuery({ queryKey: MATCHES_QUERY_KEY, queryFn: fetchMatches, staleTime: 0, retry: false })
      .then((matches) => matches.some((m) => m.match_id === matchId));
    stops.push(answerWithin(read, MATCH_READ_DEADLINE_MS, decide));
  };

  const firstMove = (front: FrontScreen) => {
    const opening = chatOpening(front, matchId);
    if (opening === "already-open" || opening === "wait-for-gate") return;
    if (opening === "switch-to-matches") router.navigate(MATCHES_HREF);
    else router.dismissTo(MATCHES_HREF);
    stops.push(whenFront(nav, isOnMatches, confirmThenPush, NAVIGATION_WAIT_MS));
  };

  const pastGate = (front: FrontScreen) => chatOpening(front, matchId) !== "wait-for-gate";
  stops.push(whenFront(nav, pastGate, firstMove, NAVIGATION_WAIT_MS));
  return cancel;
}
