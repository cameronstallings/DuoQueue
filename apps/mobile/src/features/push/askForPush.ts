import { Linking } from "react-native";
import type { QueryClient } from "@tanstack/react-query";

import { pingOutcome, type PingOutcome } from "@/features/swipe/emptyDeckDecisions";
import { NOTIFICATION_PERMISSION_QUERY_KEY } from "@/features/swipe/useEmptyDeckReason";
import { ensurePushPermission, registerForPushNotifications } from "@/lib/notifications";

import { notePushGranted, PUSH_PERMISSION_QUERY_KEY } from "./usePushPermission";

/**
 * THE "ask the OS" action, for every surface: the deck and DUO LOCKED pre-asks, the Settings
 * banner and switches, and Group Q's Duo Pops card and Queue Up sheet. One path, so the rules in
 * `pingOutcome` (emptyDeckDecisions.ts) hold everywhere:
 * - granted: register this phone's push token (permission is not a token; without the row in
 *   push_tokens nothing can be sent to it);
 * - iOS will never ask again: open the Settings app, the only place left to say yes;
 * - they just tapped Don't Allow on the prompt this raised: nothing (marching them into Settings a
 *   second later would be asking again with extra steps).
 * Both permission caches are refreshed either way, so every surface redraws from the new answer.
 * It never throws: a failure is "nothing".
 */
export async function askForPush(profileId: string | null | undefined, queryClient: QueryClient): Promise<PingOutcome> {
  let outcome: PingOutcome;
  try {
    outcome = pingOutcome(await ensurePushPermission());
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
