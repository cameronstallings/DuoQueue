import { useRef } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { LikePassButtons } from "@/features/swipe/LikePassButtons";
import { SwipeDeck, type SwipeDeckHandle } from "@/features/swipe/SwipeDeck";
import type { DeckCard, SwipeDirection } from "@/features/swipe/types";
import { useDeck } from "@/features/swipe/useDeck";
import { SwipeLimitReachedError, useSwipeAction } from "@/features/swipe/useSwipeAction";
import { useSwipeQuota } from "@/features/swipe/useSwipeQuota";
import { useTheme } from "@/theme/useTheme";

export default function DeckScreen() {
  const { colors, spacing } = useTheme();
  const { cards, isLoading, popTop, refetch } = useDeck();
  const swipeAction = useSwipeAction();
  const { data: quota } = useSwipeQuota();
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
          paddingTop: spacing.lg,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>Deck</Text>
        <Pressable onPress={() => router.push("/filters")}>
          <Text style={{ color: colors.brand, fontWeight: "600" }}>Filters</Text>
        </Pressable>
      </View>
      {quotaLabel ? (
        <Text style={{ color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
          {quotaLabel}
        </Text>
      ) : null}

      <View style={{ flex: 1, margin: spacing.lg }}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.brand} size="large" />
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
      />
    </View>
  );
}
