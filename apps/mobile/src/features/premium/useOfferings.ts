import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type PurchasesType from "react-native-purchases";
import type { PurchasesPackage } from "react-native-purchases";

import { isPurchasesConfigured } from "@/lib/revenuecat";

import { SWIPE_QUOTA_QUERY_KEY } from "@/features/swipe/useSwipeQuota";

import { CONSUMABLE_CREDITS_QUERY_KEY } from "./useConsumables";

// See src/lib/revenuecat.ts: react-native-purchases can't be imported at module scope
// without crashing inside Expo Go, so it's required lazily here too.
function loadPurchases(): typeof PurchasesType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see comment in lib/revenuecat.ts
  return (require("react-native-purchases") as { default: typeof PurchasesType }).default;
}

/** The entitlement every DuoQueue+ product grants (the revenuecat-webhook's default too). */
const PREMIUM_ENTITLEMENT = "premium";

/** RevenueCat's own answer, read from the CustomerInfo the SDK hands back. The database
 * (usePremiumStatus) stays the gate for features; the webhook writes it seconds later. */
function hasPremium(info: { entitlements: { active: Record<string, unknown> } }): boolean {
  return info.entitlements.active[PREMIUM_ENTITLEMENT] !== undefined;
}

export function useOfferings() {
  return useQuery({
    queryKey: ["revenuecat-offerings"],
    queryFn: async () => {
      const offerings = await loadPurchases().getOfferings();
      return offerings.current;
    },
    enabled: isPurchasesConfigured(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/**
 * RevenueCat's intro-offer eligibility per product id (its INTRO_ELIGIBILITY_STATUS, as a
 * number). Any failure is an empty map: unknown counts as not eligible, so a failed check shows
 * the plain price rather than a trial the store then refuses (pricing.ts trialLength).
 */
export function useIntroEligibility(productIds: readonly string[]) {
  const key = [...productIds].sort().join(",");
  return useQuery({
    queryKey: ["revenuecat-intro-eligibility", key],
    queryFn: async (): Promise<Record<string, number>> => {
      try {
        const result = await loadPurchases().checkTrialOrIntroductoryPriceEligibility([...productIds]);
        return Object.fromEntries(Object.entries(result).map(([id, eligibility]) => [id, eligibility.status]));
      } catch {
        return {};
      }
    },
    enabled: isPurchasesConfigured() && productIds.length > 0,
    staleTime: 5 * 60_000,
  });
}

interface PurchasesCancelledError {
  userCancelled?: boolean;
}

function wasCancelledByUser(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as PurchasesCancelledError).userCancelled === true;
}

/**
 * What buying did. Cancelling Apple's sheet is not an error and not a reason to leave: the
 * paywall stays open for it (build 17 fix: it used to close). `active` says whether DuoQueue+ is
 * already on for this account.
 */
export type PurchaseOutcome = { kind: "cancelled" } | { kind: "purchased"; active: boolean };

export function usePurchasePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: PurchasesPackage): Promise<PurchaseOutcome> => {
      try {
        const result = await loadPurchases().purchasePackage(pkg);
        return { kind: "purchased", active: hasPremium(result.customerInfo) };
      } catch (err) {
        if (wasCancelledByUser(err)) return { kind: "cancelled" };
        throw err;
      }
    },
    onSuccess: (outcome) => {
      if (outcome.kind === "cancelled") return;
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
      void queryClient.invalidateQueries({ queryKey: CONSUMABLE_CREDITS_QUERY_KEY });
      // The deck reads its "N swipes left today" label and its is_premium flag from this cache.
      // Without this, somebody who upgrades BECAUSE they ran out lands straight back on a screen
      // still telling them they have none left, which is the worst moment in the app to be wrong.
      void queryClient.invalidateQueries({ queryKey: SWIPE_QUOTA_QUERY_KEY });
    },
  });
}

/** `active` tells "Restored" apart from "Nothing to restore" (build 17 fix: it always said
 * "Restored" and closed). */
export function useRestorePurchases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ active: boolean }> => {
      const info = await loadPurchases().restorePurchases();
      return { active: hasPremium(info) };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
      // Restoring on a new device grants the same entitlement a purchase does, so it has to
      // refresh the same caches.
      void queryClient.invalidateQueries({ queryKey: SWIPE_QUOTA_QUERY_KEY });
    },
  });
}
