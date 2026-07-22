import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type PurchasesType from "react-native-purchases";

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

// react-native-purchases is a native module that isn't linked inside the stock Expo Go
// app — merely importing it there evaluates its native binding and crashes. Requiring it
// lazily (only once we know we're in a real dev/production build) keeps Expo Go usable
// for everything else; the paywall itself requires a development build regardless.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function loadPurchases(): typeof PurchasesType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see comment above
  return (require("react-native-purchases") as { default: typeof PurchasesType }).default;
}

let configured = false;

/** RevenueCat's app_user_id is set to the Supabase user id, so the revenuecat-webhook
 * Edge Function can write straight to subscriptions.profile_id with no separate mapping
 * table. Call this once a session exists; safe to call again on user switch. */
export function configurePurchases(userId: string): void {
  if (IS_EXPO_GO) {
    console.warn("RevenueCat isn't available in Expo Go — skipping Purchases.configure. Use a development build to test payments.");
    return;
  }

  const apiKey = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;
  if (!apiKey) {
    console.warn("RevenueCat API key not set for this platform — skipping Purchases.configure.");
    return;
  }

  const Purchases = loadPurchases();
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
    await loadPurchases().logOut();
  } catch (err) {
    console.warn("Purchases.logOut failed:", err);
  }
}

export function isPurchasesConfigured(): boolean {
  return configured;
}
