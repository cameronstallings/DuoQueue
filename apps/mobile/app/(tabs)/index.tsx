import { useRef } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Skeleton } from "@/components/Skeleton";
import { useAdmirersCount } from "@/features/matching/useAdmirers";
import {
  SuperPingLimitReachedError,
  SuperPingRequiresPremiumError,
  useSuperPing,
} from "@/features/matching/useSuperPing";
import { LikePassButtons } from "@/features/swipe/LikePassButtons";
import { SwipeDeck, type SwipeDeckHandle } from "@/features/swipe/SwipeDeck";
import type { DeckCard, SwipeDirection } from "@/features/swipe/types";
import { useDeck } from "@/features/swipe/useDeck";
import { SwipeLimitReachedError, useSwipeAction } from "@/features/swipe/useSwipeAction";
import { useSwipeQuota } from "@/features/swipe/useSwipeQuota";
import { useTheme } from "@/theme/useTheme";

export default function DeckScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { cards, isLoading, error, popTop, refetch } = useDeck();
  const swipeAction = useSwipeAction();
  const superPing = useSuperPing();
  const { data: quota } = useSwipeQuota();
  const { data: admirersCount } = useAdmirersCount();
  const deckRef = useRef<SwipeDeckHandle>(null);

  async function handleSwiped(card: DeckCard, direction: SwipeDirection) {
    popTop();
    try {
      const result = await swipeAction.mutateAsync({ targetId: card.profile_id, direction });
      if (result.matched && result.match_id) {
        router.push({
          pathname: "/match/[matchId]",
          params: {
            matchId: result.match_id,
            name: card.display_name,
            photo: card.photoUrls[0] ?? "",
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
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>Deck</Text>
        <View style={{ flexDirection: "row", gap: spacing.lg }}>
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

      <View style={{ flex: 1, margin: spacing.lg }}>
        {isLoading ? (
          <Skeleton style={{ flex: 1, borderRadius: 20 }} />
        ) : error ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>
              Couldn&apos;t load your deck
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: "center" }}>
              Check your connection and try again.
            </Text>
            <Pressable onPress={() => void refetch()}>
              <Text style={{ color: colors.brand, fontWeight: "600" }}>Try again</Text>
            </Pressable>
          </View>
        ) : cards.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>
              No more profiles right now
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: "center" }}>
              Check back later, or adjust your filters to see more people.
            </Text>
            <Pressable onPress={() => void refetch()}>
              <Text style={{ color: colors.brand, fontWeight: "600" }}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          <SwipeDeck ref={deckRef} cards={cards} onSwiped={(card, direction) => void handleSwiped(card, direction)} />
        )}
      </View>

      <LikePassButtons
        disabled={cards.length === 0}
        onPass={() => deckRef.current?.pass()}
        onLike={() => deckRef.current?.like()}
        onSuperPing={() => void handleSuperPing()}
      />
    </View>
  );
}
