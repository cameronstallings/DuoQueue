import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";

import { NOTIFICATION_PERMISSION_QUERY_KEY } from "@/features/swipe/useEmptyDeckReason";
import { useOnAppResume } from "@/hooks/useOnAppResume";
import { registerForPushNotifications } from "@/lib/notifications";
import { useSessionStore } from "@/store/session-store";

import { permissionStateOf, type PushPermissionState } from "./pushAsk";

/**
 * A NEW key on purpose. The empty deck's `NOTIFICATION_PERMISSION_QUERY_KEY` caches a boolean;
 * this caches `{ status, canAskAgain }`, which the asks need (denied with no prompt left means
 * "Open Settings", not "Turn on"). One key holding two shapes would corrupt both readers.
 */
export const PUSH_PERMISSION_QUERY_KEY = ["push-permission"] as const;

/** Whether the OS allowed notifications at the last read, per JS runtime. Lets a read notice the
 * moment it went from off to on. */
let lastGranted: boolean | null = null;

/** For `askForPush`: it has just registered the token itself, so the next read must not see a
 * fresh grant and register a second time. */
export function notePushGranted(): void {
  lastGranted = true;
}

/**
 * THE notification-permission reader (the only usePushPermission in the app). Settings, the
 * pre-ask cards and the Queue Up sheet all read this one cached answer.
 *
 * It re-reads on every return to the foreground, because the only way a denied player turns
 * notifications on is the iOS Settings app, and they come back expecting it to have worked. When
 * that read finds permission newly granted, it registers this phone's push token straight away
 * (no prompt: it is already allowed), so the player does not have to relaunch to start getting
 * pushes, and it refreshes the empty deck's boolean key too.
 */
export function usePushPermission() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: PUSH_PERMISSION_QUERY_KEY,
    queryFn: async (): Promise<PushPermissionState> => {
      const state = permissionStateOf(await Notifications.getPermissionsAsync());
      const granted = state.status === "granted";
      // Checked and set in the same synchronous step, so two reads finishing together can only
      // register once.
      const newlyGranted = granted && lastGranted === false;
      lastGranted = granted;
      if (newlyGranted) {
        const profileId = useSessionStore.getState().session?.user.id;
        if (profileId) void registerForPushNotifications(profileId);
        void queryClient.invalidateQueries({ queryKey: NOTIFICATION_PERMISSION_QUERY_KEY });
      }
      return state;
    },
    staleTime: 60_000,
  });

  useOnAppResume(
    useCallback(() => {
      // cancelRefetch false: every mounted reader asks on resume, and they should share one read.
      void queryClient.invalidateQueries({ queryKey: PUSH_PERMISSION_QUERY_KEY }, { cancelRefetch: false });
    }, [queryClient]),
  );

  return query;
}
