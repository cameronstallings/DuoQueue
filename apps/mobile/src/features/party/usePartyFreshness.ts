import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";

import { useOnAppResume } from "@/hooks/useOnAppResume";
import { partyNotificationOf, type PartyNotification } from "@/lib/notificationRouting";

import { refreshParties } from "./useParty";

/**
 * Calls `onPush` for each party push that lands while the app is open. Pass a stable callback
 * (useCallback): the listener is re-attached whenever it changes.
 *
 * The payload is read by `partyNotificationOf`, the same reading the tap uses, so a push this
 * calls back for is exactly a push a tap would route.
 */
export function useOnPartyPush(onPush: (push: PartyNotification) => void): void {
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      const push = partyNotificationOf(data?.category, data?.partyId);
      if (push) onPush(push);
    });
    return () => subscription.remove();
  }, [onPush]);
}

/**
 * Keeps every party list on screen current through the two moments that need no screen to be
 * focused: the app coming back to the front, and a party push landing while it is open (an
 * invite, a party started with you, somebody joining, a message). Before this a party only
 * changed on screen when its query happened to remount, so the invited person sat on a Matches
 * tab with no banner while the push that announced it was still on their lock screen.
 *
 * Mounted once, from the tab layout, which stays mounted under every party screen. The Matches
 * tab adds its own focus and pull-to-refresh, and the party chat catches up its own messages
 * (`usePartyMessages`), since those are not a refetch.
 */
export function usePartyFreshness(): void {
  const queryClient = useQueryClient();
  const refresh = useCallback(() => void refreshParties(queryClient), [queryClient]);
  useOnAppResume(refresh);
  useOnPartyPush(refresh);
}
