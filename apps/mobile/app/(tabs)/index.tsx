import { useRef } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";

import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useAdmirersCount } from "@/features/matching/useAdmirers";
import {
  SuperPingLimitReachedError,
  SuperPingRequiresPremiumError,
  useSuperPing,
} from "@/features/matching/useSuperPing";
import {
  NoBoostCreditsError,
  RoseOnCooldownError,
  useActivateBoost,
  useConsumableCredits,
  useSendRose,
} from "@/features/premium/useConsumables";
import { LikePassButtons } from "@/features/swipe/LikePassButtons";
import { StandoutsRow } from "@/features/swipe/StandoutsRow";
import { SwipeDeck, type SwipeDeckHandle } from "@/features/swipe/SwipeDeck";
import type { DeckCard, SwipeDirection } from "@/features/swipe/types";
import { useDeck } from "@/features/swipe/useDeck";
import { SwipeLimitReachedError, useSwipeAction } from "@/features/swipe/useSwipeAction";
import { useSwipeQuota } from "@/features/swipe/useSwipeQuota";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

export default function DeckScreen() {
  const { colors, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { cards, isLoading, error, popTop, refetch } = useDeck();
  const swipeAction = useSwipeAction();
  const superPing = useSuperPing();
  const activateBoost = useActivateBoost();
  const sendRose = useSendRose();
  const { data: quota } = useSwipeQuota();
  const { data: admirersCount } = useAdmirersCount();
  const { data: credits } = useConsumableCredits();
  const deckRef = useRef<SwipeDeckHandle>(null);

  async function handleSwiped(card: DeckCard, direction: SwipeDirection) {
    popTop();
    try {
      const result = await swipeAction.mutateAsync({ targetId: card.profile_id, direction });
      if (result.matched && result.match_id) {
        hapticSuccess();
        router.push({
          pathname: "/match/[matchId]",
          params: {
            matchId: result.match_id,
            name: card.display_name,
            photo: card.profilePhotoUrl ?? "",
          },
        });
      }
    } catch (err) {
      if (err instanceof SwipeLimitReachedError) {
        Alert.alert(
          "Daily limit reached",
          "You've used all your free swipes for today. Upgrade to DuoQueue+ for unlimited swipes.",
          [{ text: "Not now" }, { text: "Upgrade", onPress: () => router.push("/paywall") }],
        );
      } else {
        Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
      }
    }
  }

  async function handleSuperPing() {
    const top = cards[0];
    if (!top) return;
    try {
      await superPing.mutateAsync(top.profile_id);
      deckRef.current?.like();
    } catch (err) {
      if (err instanceof SuperPingRequiresPremiumError) {
        Alert.alert("DuoQueue+ feature", err.message, [
          { text: "Not now" },
          { text: "Upgrade", onPress: () => router.push("/paywall") },
        ]);
      } else if (err instanceof SuperPingLimitReachedError) {
        Alert.alert("Super Ping used", err.message);
      } else {
        Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
      }
    }
  }

  async function handleActivateBoost() {
    hapticLight();
    try {
      await activateBoost.mutateAsync();
      Alert.alert("Power-Up activated", "You'll be shown near the top of other people's decks for 30 minutes.");
    } catch (err) {
      if (err instanceof NoBoostCreditsError) {
        Alert.alert("Out of Power-Ups", "Get a Power-Up to jump to the top of the deck for 30 minutes.", [
          { text: "Not now" },
          { text: "Get Power-Ups", onPress: () => router.push("/paywall") },
        ]);
      } else {
        Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
      }
    }
  }

  async function handleSendRose() {
    const top = cards[0];
    if (!top) return;
    try {
      const result = await sendRose.mutateAsync(top.profile_id);
      popTop();
      if (result.matched && result.match_id) {
        hapticSuccess();
        router.push({
          pathname: "/match/[matchId]",
          params: { matchId: result.match_id, name: top.display_name, photo: top.profilePhotoUrl ?? "" },
        });
      }
    } catch (err) {
      if (err instanceof RoseOnCooldownError) {
        const resetLabel = credits?.free_rose_available_at
          ? new Date(credits.free_rose_available_at).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })
          : "tomorrow";
        Alert.alert(
          "Legendary Like on cooldown",
          `Your free daily Legendary Like resets around ${resetLabel}, or buy more to send one now.`,
          [{ text: "Not now" }, { text: "Get more", onPress: () => router.push("/paywall") }],
        );
      } else {
        Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
      }
    }
  }

  const quotaLabel = quota?.is_premium
    ? "Unlimited swipes"
    : quota
      ? `${Math.max((quota.swipes_limit ?? 25) - quota.swipes_used, 0)} swipes left today`
      : "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.lg,
        }}
      >
        <Text style={{ ...type.screenTitle, color: colors.text }}>Deck</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Activate Power-Up"
            onPress={() => void handleActivateBoost()}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Ionicons name="rocket" size={16} color={colors.brand} />
            <Text style={{ color: colors.brand, fontWeight: "600" }}>{credits?.boosts ?? 0}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/online-now")}>
            <Text style={{ color: colors.brand, fontWeight: "600" }}>Online</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/admirers")}>
            <Text style={{ color: colors.brand, fontWeight: "600" }}>
              Likes{admirersCount ? ` (${admirersCount})` : ""}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push("/filters")}>
            <Text style={{ color: colors.brand, fontWeight: "600" }}>Filters</Text>
          </Pressable>
        </View>
      </View>
      {quotaLabel ? (
        <Text style={{ color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
          {quotaLabel}
        </Text>
      ) : null}

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <StandoutsRow />
      </View>

      <View style={{ flex: 1, margin: spacing.lg }}>
        {isLoading ? (
          <Skeleton style={{ flex: 1, borderRadius: 20 }} />
        ) : error ? (
          <EmptyState
            icon="cloud-offline"
            title="Couldn't load your deck"
            subtitle="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        ) : cards.length === 0 ? (
          <EmptyState
            icon="game-controller"
            title="No more profiles right now"
            subtitle="Check back later, or adjust your filters to see more people."
            actionLabel="Refresh"
            onAction={() => void refetch()}
          />
        ) : (
          <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
            <SwipeDeck ref={deckRef} cards={cards} onSwiped={(card, direction) => void handleSwiped(card, direction)} />
          </Animated.View>
        )}
      </View>

      <LikePassButtons
        disabled={cards.length === 0}
        onPass={() => deckRef.current?.pass()}
        onLike={() => deckRef.current?.like()}
        onSuperPing={() => void handleSuperPing()}
        onSendRose={
          credits && (credits.free_rose_available || credits.roses > 0) ? () => void handleSendRose() : undefined
        }
      />
    </View>
  );
}
