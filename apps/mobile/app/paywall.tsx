import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import type { PurchasesPackage } from "react-native-purchases";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { usePremiumStatus } from "@/features/matching/usePremiumStatus";
import { useConsumableCredits } from "@/features/premium/useConsumables";
import { useOfferings, usePurchasePackage, useRestorePurchases } from "@/features/premium/useOfferings";
import { useRequireSession } from "@/hooks/useRequireSession";
import { LEGAL_URLS } from "@/lib/legal";
import { useTheme } from "@/theme/useTheme";

// Consumable (non-subscription) store product identifiers — see README's RevenueCat
// setup section for the matching App Store Connect / Play Console product config.
// duoqueue_roses_3 is intentionally absent: Legendary Likes are not sold in 1.0 (see the
// comment on consumableSection). The webhook still maps that product id, so re-adding the
// tile is the only client change needed once the like has a real effect.
const BOOST_PRODUCT_ID = "duoqueue_boost_1";

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
  const { colors, radius, spacing, type } = useTheme();

  const rowContent = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md }}>
      <View style={{ gap: 2, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
          {badge ? <Chip label={badge} tone="amber" /> : null}
        </View>
        {subCaption ? <Text style={[type.caption, { color: colors.textMuted }]}>{subCaption}</Text> : null}
        {pkg.product.introPrice ? (
          <Text style={[type.caption, { color: colors.success }]}>Free trial included</Text>
        ) : null}
      </View>
      <Text style={[type.title, { color: colors.text }]}>{pkg.product.priceString}</Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {selected ? (
        <View
          style={{
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.amber,
            backgroundColor: colors.surfaceSolid,
          }}
        >
          {rowContent}
        </View>
      ) : (
        <Card style={{ padding: 0 }}>{rowContent}</Card>
      )}
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
  const { colors, spacing, type } = useTheme();

  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
      <Ionicons name={icon} size={24} color={iconColor} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: colors.text }]}>
          {title} · {count} left
        </Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Pressable onPress={onBuy} disabled={!pkg || buying} hitSlop={8}>
        <Text style={[type.bodyStrong, { color: colors.voltDim, opacity: !pkg || buying ? 0.5 : 1 }]}>
          {pkg ? pkg.product.priceString : "N/A"}
        </Text>
      </Pressable>
    </Card>
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
  useRequireSession();
  const { colors, spacing, radius, type } = useTheme();
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus();
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

  // Legendary Likes are deliberately not sold in 1.0. send_rose spends a credit and then
  // performs an ordinary like — nothing is recorded and nothing reaches the recipient, so
  // the purchase buys an outcome identical to a free swipe. Selling that is a Guideline
  // 3.1.1 problem. The RPC, the credits column and the RevenueCat mapping all stay put so
  // the free daily Legendary Like keeps working; only the storefront tile is gone. Put it
  // back once the like actually surfaces differently to whoever receives it.
  const consumableSection = (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      <Text style={[type.bodyStrong, { color: colors.text }]}>Power-Ups</Text>
      <ConsumableRow
        icon="rocket"
        iconColor={colors.volt}
        title="Power-Up"
        description="30 minutes near the top of other people's decks"
        count={credits?.boosts ?? 0}
        pkg={boostPkg}
        onBuy={() => void handleBuyConsumable(boostPkg)}
        buying={purchase.isPending}
      />
    </View>
  );

  if (premiumLoading) {
    return (
      <ScreenContainer title="DuoQueue+" showClose>
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={64} borderRadius={radius.card} />
          <Skeleton height={64} borderRadius={radius.card} />
          <Skeleton height={64} borderRadius={radius.card} />
          <Skeleton height={64} borderRadius={radius.card} />
        </View>
      </ScreenContainer>
    );
  }

  if (isPremium) {
    return (
      <ScreenContainer title="You're on DuoQueue+" showClose>
        <Text style={[type.body, { color: colors.textMuted }]}>
          Unlimited swipes, advanced filters, everyone who wants to duo, and a daily Super Ping
          are all unlocked.
        </Text>
        {consumableSection}
        <Button label="Done" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="DuoQueue+" showClose>
      <Logo width={44} />
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing.sm }]}>
        Unlimited swipes, advanced filters, see everyone who wants to duo at once,
        and a daily Super Ping.
      </Text>

      {isLoading ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={64} borderRadius={radius.card} />
          <Skeleton height={64} borderRadius={radius.card} />
          <Skeleton height={64} borderRadius={radius.card} />
          <Skeleton height={64} borderRadius={radius.card} />
        </View>
      ) : error || tiers.length === 0 ? (
        <Text style={[type.body, { color: colors.textMuted }]}>
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
            variant="premium"
          />
        </>
      )}

      {consumableSection}

      {/* Guideline 3.1.2 / Schedule 2: auto-renewal terms have to be stated on the
          purchase screen itself, not buried in the linked Terms. Apple rejects for the
          absence of exactly this paragraph more often than for almost anything else on
          a subscription paywall. Wording follows Apple's required disclosures: renewal
          is automatic, the cancellation window, where to cancel, and that Apple bills. */}
      <Text style={[type.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
        DuoQueue+ is an auto-renewing subscription. Payment is charged to your Apple ID at
        confirmation of purchase, and renews automatically for the same price and period unless
        you cancel at least 24 hours before the current period ends. Your account is charged for
        renewal within 24 hours before the period ends. Manage or cancel anytime in your device&apos;s
        Account Settings. Power-Ups are a one-time purchase, not a subscription.
      </Text>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm }}>
        <Text
          style={[type.caption, { color: colors.textMuted }]}
          onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.termsOfService)}
        >
          Terms of Use
        </Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>·</Text>
        <Text
          style={[type.caption, { color: colors.textMuted }]}
          onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.privacyPolicy)}
        >
          Privacy Policy
        </Text>
      </View>

      <Button label="Restore purchases" variant="ghost" onPress={() => void handleRestore()} loading={restore.isPending} />

      {/* Required: the paywall must never trap the user — always offer a way out to the free tier. */}
      <Button label="Continue with Free" variant="ghost" onPress={() => router.back()} />
    </ScreenContainer>
  );
}
