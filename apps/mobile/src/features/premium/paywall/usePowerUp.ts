import { Alert } from "react-native";

import { useConsumableCredits } from "@/features/premium/useConsumables";
import { useOfferings, usePurchasePackage } from "@/features/premium/useOfferings";

import { POWER_UP_BOUGHT, POWER_UP_PRODUCT_ID } from "./paywallCopy";

export interface PowerUpState {
  left: number;
  price: string | null;
  busy: boolean;
  buy: () => void;
}

/** The Power-Up purchase, with its own mutation so buying one never shows the subscription
 * button as busy, or the other way round (build 17 fix). A cancelled sheet does nothing. */
export function usePowerUp(): PowerUpState {
  const { data: offering } = useOfferings();
  const { data: credits } = useConsumableCredits();
  const purchase = usePurchasePackage();
  const pkg = offering?.availablePackages.find((p) => p.product.identifier === POWER_UP_PRODUCT_ID) ?? null;

  async function buy() {
    if (!pkg) return;
    try {
      const outcome = await purchase.mutateAsync(pkg);
      if (outcome.kind === "cancelled") return;
      Alert.alert(POWER_UP_BOUGHT.title, POWER_UP_BOUGHT.message);
    } catch (err) {
      Alert.alert("Purchase failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return {
    left: credits?.boosts ?? 0,
    price: pkg?.product.priceString ?? null,
    busy: purchase.isPending,
    buy: () => void buy(),
  };
}
