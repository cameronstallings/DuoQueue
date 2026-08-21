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

interface PurchasesCancelledError {
  userCancelled?: boolean;
}

function wasCancelledByUser(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as PurchasesCancelledError).userCancelled === true;
}

export function usePurchasePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      try {
        const result = await loadPurchases().purchasePackage(pkg);
        return result.customerInfo;
      } catch (err) {
        if (wasCancelledByUser(err)) return null;
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
      void queryClient.invalidateQueries({ queryKey: CONSUMABLE_CREDITS_QUERY_KEY });
      // The deck reads its "N swipes left today" label and its is_premium flag from this cache.
      // Without this, somebody who upgrades BECAUSE they ran out lands straight back on a screen
      // still telling them they have none left, which is the worst moment in the app to be wrong.
      void queryClient.invalidateQueries({ queryKey: SWIPE_QUOTA_QUERY_KEY });
    },
  });
}

export function useRestorePurchases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => loadPurchases().restorePurchases(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
      // Restoring on a new device grants the same entitlement a purchase does, so it has to
      // refresh the same caches.
      void queryClient.invalidateQueries({ queryKey: SWIPE_QUOTA_QUERY_KEY });
    },
  });
}
