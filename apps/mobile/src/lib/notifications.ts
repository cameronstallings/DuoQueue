import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for push permission, but only when the OS will actually show the prompt.
 *
 * iOS shows the system permission alert exactly once per install. After the user answers,
 * `requestPermissionsAsync()` stops being a question and becomes a no-op that resolves with
 * the answer already on file — so a button wired straight to it looks broken to the one user
 * who most needs it to work: the person who tapped "Don't Allow" months ago and has now come
 * back because the deck is empty. That is what `canAskAgain` is for, and why this returns it
 * instead of discarding it the way the original inline block did. A caller that gets
 * `{ granted: false, canAskAgain: false }` knows to send the user to Settings rather than
 * firing a prompt that will never appear.
 *
 * So the decision is: already granted, ask nothing and say so. Not granted and the OS still
 * allows a prompt, ask once. Not granted and the OS will not prompt again, do not call
 * `requestPermissionsAsync()` at all — there is nothing to gain and the no-op makes the
 * distinction the caller needs harder to see.
 *
 * Note this deliberately does NOT check `Device.isDevice`. Permission and a push token are
 * separate things: a simulator can hold a permission state, it just cannot be issued a token,
 * and that check belongs with the token in `registerForPushNotifications`.
 */
export async function ensurePushPermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return { granted: true, canAskAgain: current.canAskAgain };
  if (!current.canAskAgain) return { granted: false, canAskAgain: false };

  const requested = await Notifications.requestPermissionsAsync();
  return { granted: requested.granted, canAskAgain: requested.canAskAgain };
}

/** Requests permission, resolves an Expo push token, and upserts it into push_tokens.
 * Requires a real EAS project id (`eas init`) to resolve a token — safe to call without
 * one; it just logs a warning and does nothing, same as running in the iOS Simulator
 * (which has no push capability at all). */
export async function registerForPushNotifications(profileId: string): Promise<void> {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return;
  }

  const { granted } = await ensurePushPermission();
  if (!granted) {
    console.warn("Push notification permission not granted.");
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("No EAS project id configured (run `eas init`) — skipping push token registration.");
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase
      .from("push_tokens")
      .upsert({ profile_id: profileId, expo_push_token: token }, { onConflict: "expo_push_token" });
    if (error) console.warn("Failed to save push token:", error.message);
  } catch (err) {
    console.warn("Failed to resolve Expo push token:", err);
  }
}
