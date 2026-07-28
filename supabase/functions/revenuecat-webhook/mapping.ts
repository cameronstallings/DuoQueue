export interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id: string;
  product_id: string;
  period_type?: string;
  expiration_at_ms?: number | null;
  store?: string;
  entitlement_ids?: string[];
}

export type SubscriptionStatus = "active" | "trialing" | "expired" | "cancelled" | "refunded" | "grace_period";
export type SubscriptionStore = "app_store" | "play_store";

/** Non-subscription consumable products (Power-Up / Legendary Like — internal field
 * names stay `boosts`/`roses`) — must match the identifiers used client-side in
 * app/paywall.tsx and configured in App Store Connect / Play Console (see README's
 * RevenueCat setup section). Grants credits instead of upserting `subscriptions`
 * when a purchase event's product_id matches one of these. */
export const CONSUMABLE_GRANTS: Record<string, { boosts?: number; roses?: number }> = {
  duoqueue_boost_1: { boosts: 1 },
  duoqueue_roses_3: { roses: 3 },
};

export function mapEventToStatus(event: RevenueCatEvent): {
  status: SubscriptionStatus;
  willRenew: boolean;
  isTrial: boolean;
} {
  const isTrial = event.period_type === "TRIAL";

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
    case "TRANSFER":
      return { status: isTrial ? "trialing" : "active", willRenew: true, isTrial };
    case "CANCELLATION":
      // Auto-renew turned off, but the entitlement is still valid until expiration_at_ms
      // — only an EXPIRATION event actually ends access.
      return { status: isTrial ? "trialing" : "active", willRenew: false, isTrial };
    case "EXPIRATION":
      return { status: "expired", willRenew: false, isTrial: false };
    case "BILLING_ISSUE":
    case "SUBSCRIPTION_PAUSED":
      return { status: "grace_period", willRenew: false, isTrial: false };
    case "REFUND":
      return { status: "refunded", willRenew: false, isTrial: false };
    default:
      return { status: isTrial ? "trialing" : "active", willRenew: true, isTrial };
  }
}

export function mapStore(store: string | undefined): SubscriptionStore {
  if (store === "PLAY_STORE" || store === "AMAZON") return "play_store";
  return "app_store";
}
