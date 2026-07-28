import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { PurchasesPackage } from "react-native-purchases";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { usePremiumStatus } from "@/features/matching/usePremiumStatus";
import { useConsumableCredits } from "@/features/premium/useConsumables";
import { useOfferings, usePurchasePackage, useRestorePurchases } from "@/features/premium/useOfferings";
import { useTheme } from "@/theme/useTheme";

// Consumable (non-subscription) store product identifiers — see README's RevenueCat
// setup section for the matching App Store Connect / Play Console product config.
const BOOST_PRODUCT_ID = "duoqueue_boost_1";
const ROSES_PRODUCT_ID = "duoqueue_roses_3";

function PlanRow({
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
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 2,
        borderColor: selected ? colors.brand : colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        backgroundColor: selected ? colors.surface : "transparent",
      }}
    >
      <View style={{ gap: 2, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text }}>{title}</Text>
          {badge ? (
            <Text
              style={{
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
        </View>
        {subCaption ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{subCaption}</Text> : null}
        {pkg.product.introPrice ? (
          <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>Free trial included</Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>{pkg.product.priceString}</Text>
    </Pressable>
  );
}

function ConsumableRow({
  icon,
  iconColor,
  title,
  description,
  count,
  pkg,
  onBuy,
  buying,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
  count: number;
  pkg: PurchasesPackage | null;
  onBuy: () => void;
  buying: boolean;
}) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
      }}
    >
      <Ionicons name={icon} size={24} color={iconColor} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: "700", color: colors.text }}>
          {title} · {count} left
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{description}</Text>
      </View>
      <Pressable onPress={onBuy} disabled={!pkg || buying}>
        <Text style={{ color: colors.brand, fontWeight: "700", opacity: !pkg || buying ? 0.5 : 1 }}>
          {pkg ? pkg.product.priceString : "N/A"}
        </Text>
      </Pressable>
    </View>
  );
}

function savingsVsWeekly(pkg: PurchasesPackage, weeklyPricePerWeek: number | null): number | null {
  if (!weeklyPricePerWeek || weeklyPricePerWeek <= 0) return null;
  const pricePerWeek = pkg.product.pricePerWeek;
  if (!pricePerWeek) return null;
  const pct = Math.round((1 - pricePerWeek / weeklyPricePerWeek) * 100);
  return pct > 0 ? pct : null;
}

export default function PaywallScreen() {
  const { colors, spacing } = useTheme();
  const { isPremium } = usePremiumStatus();
  const { data: offering, isLoading, error } = useOfferings();
  const purchase = usePurchasePackage();
  const restore = useRestorePurchases();
  const { data: credits } = useConsumableCredits();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const weekly = offering?.weekly ?? null;
  const monthly = offering?.monthly ?? null;
  const threeMonth = offering?.threeMonth ?? null;
  const sixMonth = offering?.sixMonth ?? null;
  const tiers = [weekly, monthly, threeMonth, sixMonth].filter((p): p is PurchasesPackage => !!p);
  const defaultPackage = monthly ?? tiers[0] ?? null;
  const selectedPackage = tiers.find((p) => p.identifier === selectedId) ?? defaultPackage;

  const weeklyBaseline = weekly?.product.pricePerWeek ?? null;

  const boostPkg = offering?.availablePackages.find((p) => p.product.identifier === BOOST_PRODUCT_ID) ?? null;
  const rosesPkg = offering?.availablePackages.find((p) => p.product.identifier === ROSES_PRODUCT_ID) ?? null;

  async function handleBuyConsumable(pkg: PurchasesPackage | null) {
    if (!pkg) return;
    try {
      await purchase.mutateAsync(pkg);
      Alert.alert("Purchase complete", "Your credits will appear shortly.");
    } catch (err) {
      Alert.alert("Purchase failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

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

  const consumableSection = (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Power-Ups & Legendary Likes</Text>
      <ConsumableRow
        icon="rocket"
        iconColor={colors.brand}
        title="Power-Up"
        description="30 minutes near the top of other people's decks"
        count={credits?.boosts ?? 0}
        pkg={boostPkg}
        onBuy={() => void handleBuyConsumable(boostPkg)}
        buying={purchase.isPending}
      />
      <ConsumableRow
        icon="star"
        iconColor={colors.warning}
        title="Legendary Like"
        description="An extra-visible like for someone specific"
        count={credits?.roses ?? 0}
        pkg={rosesPkg}
        onBuy={() => void handleBuyConsumable(rosesPkg)}
        buying={purchase.isPending}
      />
    </View>
  );

  if (isPremium) {
    return (
      <ScreenContainer>
        <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>You&apos;re on DuoQueue+</Text>
        <Text style={{ color: colors.textMuted }}>
          Unlimited swipes, unlimited conversations, advanced filters, admirers, and a daily Super Ping are
          all unlocked.
        </Text>
        {consumableSection}
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
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={64} borderRadius={12} />
          <Skeleton height={64} borderRadius={12} />
          <Skeleton height={64} borderRadius={12} />
          <Skeleton height={64} borderRadius={12} />
        </View>
      ) : error || tiers.length === 0 ? (
        <Text style={{ color: colors.textMuted }}>
          Plans aren&apos;t available right now. Check your connection and try again shortly.
        </Text>
      ) : (
        <>
          <View style={{ gap: spacing.sm }}>
            {weekly && (
              <PlanRow
                pkg={weekly}
                title="Weekly"
                subCaption="billed every week"
                selected={(selectedId ?? defaultPackage?.identifier) === weekly.identifier}
                onSelect={() => setSelectedId(weekly.identifier)}
              />
            )}
            {monthly && (
              <PlanRow
                pkg={monthly}
                title="Monthly"
                subCaption={
                  monthly.product.pricePerWeekString ? `${monthly.product.pricePerWeekString}/wk` : "billed monthly"
                }
                badge={
                  savingsVsWeekly(monthly, weeklyBaseline)
                    ? `Save ${savingsVsWeekly(monthly, weeklyBaseline)}%`
                    : undefined
                }
                selected={(selectedId ?? defaultPackage?.identifier) === monthly.identifier}
                onSelect={() => setSelectedId(monthly.identifier)}
              />
            )}
            {threeMonth && (
              <PlanRow
                pkg={threeMonth}
                title="3 Months"
                subCaption={
                  threeMonth.product.pricePerWeekString
                    ? `${threeMonth.product.pricePerWeekString}/wk`
                    : "billed every 3 months"
                }
                badge={
                  savingsVsWeekly(threeMonth, weeklyBaseline)
                    ? `Save ${savingsVsWeekly(threeMonth, weeklyBaseline)}%`
                    : undefined
                }
                selected={selectedId === threeMonth.identifier}
                onSelect={() => setSelectedId(threeMonth.identifier)}
              />
            )}
            {sixMonth && (
              <PlanRow
                pkg={sixMonth}
                title="6 Months"
                subCaption={
                  sixMonth.product.pricePerWeekString
                    ? `${sixMonth.product.pricePerWeekString}/wk`
                    : "billed every 6 months"
                }
                badge={
                  savingsVsWeekly(sixMonth, weeklyBaseline)
                    ? `Save ${savingsVsWeekly(sixMonth, weeklyBaseline)}%`
                    : undefined
                }
                selected={selectedId === sixMonth.identifier}
                onSelect={() => setSelectedId(sixMonth.identifier)}
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

      {consumableSection}

      <Button label="Restore purchases" variant="ghost" onPress={() => void handleRestore()} loading={restore.isPending} />

      {/* Required: the paywall must never trap the user — always offer a way out to the free tier. */}
      <Button label="Continue with Free" variant="ghost" onPress={() => router.back()} />
    </ScreenContainer>
  );
}
