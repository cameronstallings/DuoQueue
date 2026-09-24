import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import { notificationTapAction, shouldHandleTap } from "@/lib/notificationRouting";
import { queryClient } from "@/lib/query-client";
import { useSessionStore } from "@/store/session-store";

/**
 * Sends a tapped "new players in your games" push to the deck.
 *
 * Mounted once, from `RootLayout`. Two sources, because a tap arrives differently depending
 * on whether the app was already running: the listener catches warm taps, and one read of
 * `getLastNotificationResponseAsync()` catches the tap that launched the app from cold.
 *
 * The tap is HELD rather than acted on immediately — see `notificationRouting.ts` for why,
 * and for the three states where navigating is the wrong move. This hook is the wiring; the
 * decisions are there, with tests.
 *
 * Every other push category is deliberately left alone. None of them carry an id in their
 * payload, so there is nothing to route to without redeploying `send-push-notification`, and
 * resuming where the user left off is right for all of them.
 */
export function useNotificationTapRouting(navigatorReady: boolean): void {
  const status = useSessionStore((s) => s.status);
  const profileStatus = useSessionStore((s) => s.profileStatus);
  const onboardingCompleted = useSessionStore((s) => s.profile?.onboarding_completed);
  const [pending, setPending] = useState<Notifications.NotificationResponse | null>(null);
  const handled = useRef<Set<string>>(new Set());

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

    const action = notificationTapAction({
      category: pending.notification.request.content.data?.category,
      navigatorReady,
      sessionStatus: status,
      profileStatus,
      onboardingCompleted,
    });

    // Not ready yet. Keep holding it; this effect re-runs the moment the session or the
    // profile lands.
    if (action === "wait") return;

    handled.current.add(identifier);
    setPending(null);
    if (action !== "open-deck") return;

    // Invalidate before navigating so the deck is refetching by the time it renders. The push
    // exists because somebody new is in there, and arriving at a cached empty deck would undo
    // the whole point of sending it.
    void queryClient.invalidateQueries({ queryKey: ["deck"] });
    router.navigate("/(tabs)");
  }, [pending, navigatorReady, status, profileStatus, onboardingCompleted]);
}
