import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import type { PushTokenDeviceInfo } from "@duoqueue/shared-types";

import { buildDeviceStamp } from "@/lib/appStamp";
import { shouldPlayForegroundSound } from "@/lib/pushSound";
import { SUPABASE_KEY_KIND, supabase } from "@/lib/supabase";

// In the foreground only a Duo Pop plays a sound (its ten-minute window is the point); every
// other push stays a silent banner while the app is open. The rule lives in pushSound.ts.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: shouldPlayForegroundSound(notification.request.content.data),
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

// ---------------------------------------------------------------------------
// The push token: claimed for the signed-in account, stamped, and removed on sign-out.
// ---------------------------------------------------------------------------
//
// WHY CLAIM. One phone has one Expo push token, and it belongs to whoever is signed in on it.
// Until 1.0.2 the app upserted the token with `onConflict: "expo_push_token"`; when a second
// account signed in on a phone, that upsert had to UPDATE the first account's row, RLS
// (push_tokens_update_own) refused it with a 403, and the phone kept receiving the FIRST
// account's matches and messages (0081's header has the edge-log evidence). `claim_push_token`
// moves the token to the caller in one statement. A server without 0081 answers PGRST202, and the
// old upsert still runs.
//
// WHY THE STAMP. Beside the token the app saves which version, build and OTA update it runs and
// which kind of Supabase key it carries (appStamp.ts): the only way to know which builds and
// updates are still in use, and whether the publishable key reached every phone before the legacy
// key is switched off. Technical facts only (privacy policy 1.6).
//
// WHY SIGN-OUT DELETES FIRST. The row is deleted through RLS (push_tokens_delete_own), which needs
// the session, so it has to happen before supabase.auth.signOut(). Without it a signed-out phone
// keeps getting the old account's pushes. It is bounded (about 3 s) and never throws, so a dead
// network never holds a sign-out.

/** The token this runtime last saved, so sign-out can delete it without asking the OS again. */
let savedToken: string | null = null;

const FORGET_RESOLVE_MS = 2000;
const FORGET_TOTAL_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** The device's Expo push token, or null (simulator, no EAS project id, or the OS refused). */
async function resolveToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("No EAS project id configured (run `eas init`), skipping push token registration.");
    return null;
  }

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
  } catch (err) {
    console.warn("Failed to resolve Expo push token:", err);
    return null;
  }
}

function currentDeviceStamp(): PushTokenDeviceInfo {
  return buildDeviceStamp(
    {
      appVersion: Application.nativeApplicationVersion,
      build: Application.nativeBuildVersion,
      runtimeVersion: Updates.runtimeVersion,
      updateId: Updates.updateId,
      channel: Updates.channel,
      embedded: Updates.isEmbeddedLaunch,
      os: Platform.OS,
      osVersion: Device.osVersion,
      keyKind: SUPABASE_KEY_KIND,
    },
    new Date(),
  );
}

/** Resolves the token, claims it for the signed-in account and stamps the row. Never throws. */
async function savePushToken(profileId: string): Promise<void> {
  const token = await resolveToken();
  if (!token) return;
  const stamp = currentDeviceStamp();

  try {
    const { error: claimError } = await supabase.rpc("claim_push_token", { p_token: token });
    if (claimError) {
      if (claimError.code !== "PGRST202") {
        console.warn("Failed to claim push token:", claimError.message);
        return;
      }
      // claim_push_token is not on this server (0081 not applied): the pre-1.0.2 upsert.
      const { error } = await supabase
        .from("push_tokens")
        .upsert({ profile_id: profileId, expo_push_token: token, device_info: stamp }, { onConflict: "expo_push_token" });
      if (error) {
        console.warn("Failed to save push token:", error.message);
        return;
      }
    } else {
      // The claimed row is now ours, so push_tokens_update_own allows the stamp. A failed stamp
      // only loses the version facts; the token itself is saved.
      const { error: stampError } = await supabase
        .from("push_tokens")
        .update({ device_info: stamp })
        .eq("expo_push_token", token);
      if (stampError) console.warn("Failed to stamp push token:", stampError.message);
    }
    savedToken = token;
  } catch (err) {
    console.warn("Failed to save push token:", err);
  }
}

/** Asks for permission if the OS still can, then claims and stamps the token. The one entry point
 * that may show the iOS prompt; callers ask at the moments that pay off (a like, DUO LOCKED, Queue
 * up), never cold at signup. Requires a real EAS project id (`eas init`) to resolve a token; safe
 * to call without one, and in the iOS Simulator (no push capability), where it only warns. */
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

  await savePushToken(profileId);
}

/** Refreshes, claims and stamps the token ONLY when the OS already allows notifications. Never
 * asks (getPermissionsAsync only) and never throws. Called when a profile becomes ready. */
export async function refreshPushTokenIfGranted(profileId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    await savePushToken(profileId);
  } catch (err) {
    console.warn("refreshPushTokenIfGranted failed:", err);
  }
}

async function forgetToken(): Promise<void> {
  let token = savedToken;
  if (!token && Device.isDevice) {
    const { granted } = await Notifications.getPermissionsAsync();
    if (granted) token = await withTimeout(resolveToken(), FORGET_RESOLVE_MS).catch(() => null);
  }
  savedToken = null;
  if (!token) return;
  const { error } = await supabase.from("push_tokens").delete().eq("expo_push_token", token);
  if (error) console.warn("Failed to remove push token:", error.message);
}

/** Deletes this phone's push-token row while the session still exists (sign-out calls it first).
 * Never throws and is done within about 3 s, whatever the network does. */
export async function forgetThisDevicePushToken(): Promise<void> {
  try {
    await withTimeout(forgetToken(), FORGET_TOTAL_MS);
  } catch (err) {
    savedToken = null;
    console.warn("forgetThisDevicePushToken failed:", err);
  }
}
