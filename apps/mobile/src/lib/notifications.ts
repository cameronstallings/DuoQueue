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

/** Requests permission, resolves an Expo push token, and upserts it into push_tokens.
 * Requires a real EAS project id (`eas init`) to resolve a token — safe to call without
 * one; it just logs a warning and does nothing, same as running in the iOS Simulator
 * (which has no push capability at all). */
export async function registerForPushNotifications(profileId: string): Promise<void> {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
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
