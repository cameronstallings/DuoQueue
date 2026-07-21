import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { PurchasesPackage } from "react-native-purchases";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { usePremiumStatus } from "@/features/matching/usePremiumStatus";
import { useOfferings, usePurchasePackage, useRestorePurchases } from "@/features/premium/useOfferings";
import { useTheme } from "@/theme/useTheme";

function PlanCard({
  pkg,
  title,
  selected,
  onSelect,
  badge,
  subCaption,
}: {
  pkg: PurchasesPackage;
  title: string;
  selected: boolean;
  onSelect: () => void;
  badge?: string;
  subCaption?: string;
}) {
  const { colors, radius, spacing } = useTheme();

  return (
    <Pressable
      onPress={onSelect}
      style={{
        flex: 1,
        borderWidth: 2,
        borderColor: selected ? colors.brand : colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.xs,
        backgroundColor: selected ? colors.surface : "transparent",
      }}
    >
      {badge ? (
        <Text
          style={{
            alignSelf: "flex-start",
            color: "#fff",
            backgroundColor: colors.brand,
            fontSize: 11,
            fontWeight: "700",
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: radius.pill,
          }}
        >
          {badge}
        </Text>
      ) : null}
      <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text }}>{title}</Text>
      <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{pkg.product.priceString}</Text>
      {subCaption ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{subCaption}</Text> : null}
      {pkg.product.introPrice ? (
        <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>Free trial included</Text>
      ) : null}
    </Pressable>
  );
}

export default function PaywallScreen() {
  const { colors, spacing } = useTheme();
  const { isPremium } = usePremiumStatus();
  const { data: offering, isLoading, error } = useOfferings();
  const purchase = usePurchasePackage();
  const restore = useRestorePurchases();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const monthly = offering?.monthly ?? null;
  const annual = offering?.annual ?? null;
  const selectedPackage = [monthly, annual].find((p) => p?.identifier === selectedId) ?? monthly ?? annual;

  const savingsPct =
    monthly && annual && monthly.product.price > 0 && annual.product.pricePerMonth
      ? Math.round((1 - annual.product.pricePerMonth / monthly.product.price) * 100)
      : null;

  async function handleSubscribe() {
    if (!selectedPackage) return;
    try {
      await purchase.mutateAsync(selectedPackage);
      router.back();
    } catch (err) {
      Alert.alert("Purchase failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function handleRestore() {
    try {
      await restore.mutateAsync();
      Alert.alert("Restored", "Your purchases have been restored.");
      router.back();
    } catch (err) {
      Alert.alert("Restore failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  if (isPremium) {
    return (
      <ScreenContainer>
        <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>You&apos;re on DuoQueue+</Text>
        <Text style={{ color: colors.textMuted }}>
          Unlimited swipes, unlimited conversations, advanced filters, admirers, and a daily Super Ping are
          all unlocked.
        </Text>
        <Button label="Done" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>DuoQueue+</Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
        Unlimited swipes, unlimited conversations, advanced filters, see who liked you, and a daily Super
        Ping.
      </Text>

      {isLoading ? (
        <ActivityIndicator color={colors.brand} />
      ) : error || (!monthly && !annual) ? (
        <Text style={{ color: colors.textMuted }}>
          Plans aren&apos;t available right now. Check your connection and try again shortly.
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            {monthly && (
              <PlanCard
                pkg={monthly}
                title="Monthly"
                subCaption="billed monthly"
                selected={(selectedId ?? monthly.identifier) === monthly.identifier}
                onSelect={() => setSelectedId(monthly.identifier)}
              />
            )}
            {annual && (
              <PlanCard
                pkg={annual}
                title="Annual"
                subCaption={
                  annual.product.pricePerMonth
                    ? `~$${annual.product.pricePerMonth.toFixed(2)}/mo`
                    : "billed yearly"
                }
                badge={savingsPct && savingsPct > 0 ? `Save ${savingsPct}%` : undefined}
                selected={selectedId === annual.identifier}
                onSelect={() => setSelectedId(annual.identifier)}
              />
            )}
          </View>

          <Button
            label={purchase.isPending ? "Processing..." : "Start subscription"}
            onPress={() => void handleSubscribe()}
            loading={purchase.isPending}
            disabled={!selectedPackage}
          />
        </>
      )}

      <Button label="Restore purchases" variant="ghost" onPress={() => void handleRestore()} loading={restore.isPending} />

      {/* Required: the paywall must never trap the user — always offer a way out to the free tier. */}
      <Button label="Continue with Free" variant="ghost" onPress={() => router.back()} />
    </ScreenContainer>
  );
}
