import { useMemo, useState } from "react";
import { Alert } from "react-native";

import { goBack } from "@/components/ScreenContainer";
import { useIntroEligibility, useOfferings, usePurchasePackage, useRestorePurchases } from "@/features/premium/useOfferings";
import { hapticError } from "@/lib/haptics";

import { PlansView } from "./PlansView";
import { purchaseAlert, restoreAlert } from "./paywallCopy";
import { orderPlans, planCopy, selectedPlan, trialLength } from "./pricing";
import { usePowerUp } from "./usePowerUp";

/** Page 3's data and purchases. PlansView draws it. */
export function PlansPage({ bottomInset }: { bottomInset: number }) {
  const { data: offering, isLoading, error } = useOfferings();
  const subscribe = usePurchasePackage();
  const restore = useRestorePurchases();
  const powerUp = usePowerUp();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const plans = useMemo(
    () => orderPlans([offering?.weekly, offering?.monthly, offering?.threeMonth, offering?.sixMonth]),
    [offering],
  );
  const productIds = useMemo(() => plans.map((p) => p.pkg.product.identifier), [plans]);
  const { data: eligibility } = useIntroEligibility(productIds);
  const weekly = plans.find((p) => p.period === "week") ?? null;
  const rows = plans.map((plan) => ({
    id: plan.pkg.identifier,
    copy: planCopy(plan, {
      weekly,
      trial: trialLength(plan.pkg.product.introPrice, eligibility?.[plan.pkg.product.identifier]),
    }),
  }));
  const selected = selectedPlan(plans, selectedId);
  const selectedCopy = rows.find((row) => row.id === selected?.pkg.identifier)?.copy ?? null;

  async function handleSubscribe() {
    if (!selected) return;
    try {
      const outcome = await subscribe.mutateAsync(selected.pkg);
      // Cancelling Apple's sheet is not a failure and not a reason to leave (build 17 fix).
      if (outcome.kind === "cancelled") return;
      const alert = purchaseAlert(outcome.active);
      Alert.alert(alert.title, alert.message, [{ text: "OK", onPress: goBack }]);
    } catch (err) {
      hapticError();
      Alert.alert("Purchase failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function handleRestore() {
    try {
      const { active } = await restore.mutateAsync();
      const alert = restoreAlert(active);
      // Only a real restore leaves the paywall; "Nothing to restore" keeps the plans on screen.
      Alert.alert(alert.title, alert.message, active ? [{ text: "OK", onPress: goBack }] : undefined);
    } catch (err) {
      hapticError();
      Alert.alert("Restore failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <PlansView
      state={isLoading ? "loading" : error || plans.length === 0 ? "unavailable" : "ready"}
      rows={rows}
      selectedId={selected?.pkg.identifier ?? null}
      selectedCopy={selectedCopy}
      onSelect={setSelectedId}
      subscribing={subscribe.isPending}
      onSubscribe={() => void handleSubscribe()}
      restoring={restore.isPending}
      onRestore={() => void handleRestore()}
      powerUp={powerUp}
      onContinueFree={goBack}
      bottomInset={bottomInset}
    />
  );
}
