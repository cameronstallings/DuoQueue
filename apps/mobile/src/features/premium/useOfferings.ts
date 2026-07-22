import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type PurchasesType from "react-native-purchases";
import type { PurchasesPackage } from "react-native-purchases";

import { isPurchasesConfigured } from "@/lib/revenuecat";

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
    },
  });
}

export function useRestorePurchases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => loadPurchases().restorePurchases(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}
