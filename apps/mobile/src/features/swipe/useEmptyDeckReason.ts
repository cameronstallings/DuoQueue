import { useQuery } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";

import { useNotificationSettings } from "@/features/settings/useNotificationSettings";

import { emptyDeckReason, type EmptyDeckReason } from "./emptyDeckDecisions";
import { useDeckPoolSize } from "./useDeckPoolSize";

export const NOTIFICATION_PERMISSION_QUERY_KEY = ["notification-permission"] as const;

/**
 * Whether the OS will currently deliver a push to this install.
 *
 * In react-query rather than a `useEffect` + `useState` pair so that the empty-deck screen and
 * anything else that asks share one answer, and so that the screen can invalidate the key the
 * moment the user grants permission and have the copy change under them.
 */
export function useNotificationPermission() {
  return useQuery({
    queryKey: NOTIFICATION_PERMISSION_QUERY_KEY,
    queryFn: async (): Promise<boolean> => (await Notifications.getPermissionsAsync()).granted,
    staleTime: 60_000,
  });
}

/**
 * Why the deck is empty — one answer, composed from the three things that can be true about
 * an empty deck and resolved by `emptyDeckReason`, which is where the actual reasoning and
 * its tests live.
 *
 * `enabled` is the caller's promise that the deck really has settled at zero cards. It gates
 * the pool RPC, which is the only expensive part of this and the reason none of it runs while
 * somebody is swiping.
 */
export function useEmptyDeckReason(enabled: boolean): EmptyDeckReason {
  const pool = useDeckPoolSize(enabled);
  const permission = useNotificationPermission();
  const { settings } = useNotificationSettings();

  // `!== false` rather than `=== true`: an absent value reads as "on", which is both the
  // column's default (0063_new_player_alerts.sql) and the convention 0038 set for this table,
  // where a missing settings row means opted in rather than opted out. The settings query is
  // still in flight on first render, and treating that as "off" would flash the wrong offer.
  const newPlayerAlertsEnabled = settings?.new_player !== false;

  return emptyDeckReason({
    poolSize: pool.data,
    poolFailed: pool.error != null,
    permissionGranted: permission.data,
    permissionFailed: permission.error != null,
    newPlayerAlertsEnabled,
  });
}
