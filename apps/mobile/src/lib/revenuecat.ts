import { Platform } from "react-native";
import Purchases from "react-native-purchases";

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

let configured = false;

/** RevenueCat's app_user_id is set to the Supabase user id, so the revenuecat-webhook
 * Edge Function can write straight to subscriptions.profile_id with no separate mapping
 * table. Call this once a session exists; safe to call again on user switch. */
export function configurePurchases(userId: string): void {
  const apiKey = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;
  if (!apiKey) {
    console.warn("RevenueCat API key not set for this platform — skipping Purchases.configure.");
    return;
  }

  if (!configured) {
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
  } else {
    void Purchases.logIn(userId);
  }
}

export async function logOutPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    console.warn("Purchases.logOut failed:", err);
  }
}

export function isPurchasesConfigured(): boolean {
  return configured;
}
