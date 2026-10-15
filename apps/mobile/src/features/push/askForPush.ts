import { Linking } from "react-native";
import * as Notifications from "expo-notifications";
import type { QueryClient } from "@tanstack/react-query";

import type { PingOutcome } from "@/features/swipe/emptyDeckDecisions";
import { NOTIFICATION_PERMISSION_QUERY_KEY } from "@/features/swipe/useEmptyDeckReason";
import { ensurePushPermission, registerForPushNotifications } from "@/lib/notifications";

import { askOutcome, permissionStateOf } from "./pushAsk";
import { notePushGranted, PUSH_PERMISSION_QUERY_KEY } from "./usePushPermission";

/**
 * THE "ask the OS" action, for every surface: the deck and DUO LOCKED pre-asks, the Settings
 * banner and switches, and Group Q's Duo Pops card and Queue Up sheet. One path, so the rules in
 * `askOutcome` (pushAsk.ts) hold everywhere:
 * - granted: register this phone's push token (permission is not a token; without the row in
 *   push_tokens nothing can be sent to it);
 * - they just tapped Don't Allow on the prompt this raised: nothing (marching them into Settings a
 *   second later would be asking again with extra steps);
 * - iOS could not show its prompt even before the tap (they said no on an earlier day): open the
 *   Settings app, the only place left to say yes.
 *
 * The permission is read BEFORE asking because the answer alone cannot tell the last two apart:
 * Expo on iOS reports `canAskAgain: false` the moment the status is denied, so a fresh Don't Allow
 * looks exactly like an old one (`askOutcome` has the detail). The empty deck's Turn on still uses
 * `pingOutcome` on the answer alone, so it has the same gap (EmptyDeck.tsx, reported, not this
 * group's file).
 *
 * Both permission caches are refreshed either way, so every surface redraws from the new answer.
 * It never throws: a failure is "nothing".
 */
export async function askForPush(profileId: string | null | undefined, queryClient: QueryClient): Promise<PingOutcome> {
  let outcome: PingOutcome;
  try {
    const before = permissionStateOf(await Notifications.getPermissionsAsync());
    outcome = askOutcome(before, await ensurePushPermission());
  } catch {
    return "nothing";
  }

  try {
    if (outcome === "register-token") {
      notePushGranted();
      if (profileId) await registerForPushNotifications(profileId);
    } else if (outcome === "open-os-settings") {
      await Linking.openSettings();
    }
  } catch {
    // The answer stands even if the token write or the Settings hand-off failed; the token is
    // retried on the next profile load.
  }

  void queryClient.invalidateQueries({ queryKey: PUSH_PERMISSION_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: NOTIFICATION_PERMISSION_QUERY_KEY });
  return outcome;
}
