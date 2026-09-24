import { useRef } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { EmptyState } from "@/components/EmptyState";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Skeleton } from "@/components/Skeleton";
import { useAdmirersCount } from "@/features/matching/useAdmirers";
import {
  SuperPingLimitReachedError,
  SuperPingRequiresPremiumError,
  useSuperPing,
} from "@/features/matching/useSuperPing";
import {
  NoBoostCreditsError,
  useActivateBoost,
  useConsumableCredits,
} from "@/features/premium/useConsumables";
import { paywallHref } from "@/features/premium/paywall/paywallCopy";
import { matchParams } from "@/features/match/matchMoment";
import { cardPicture, showsDuoLabel } from "@/features/swipe/cardChips";
import { DeckStrip } from "@/features/swipe/DeckStrip";
import { EmptyDeck } from "@/features/swipe/EmptyDeck";
import { LikePassButtons } from "@/features/swipe/LikePassButtons";
import { SwipeDeck, type SwipeDeckHandle } from "@/features/swipe/SwipeDeck";
import type { DeckCard, SwipeDirection } from "@/features/swipe/types";
import { useDeck } from "@/features/swipe/useDeck";
import { SwipeLimitReachedError, useSwipeAction } from "@/features/swipe/useSwipeAction";
import { useSwipeQuota } from "@/features/swipe/useSwipeQuota";
import { hapticLight } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

export default function DeckScreen() {
  const { colors, spacing, type, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { cards, isLoading, error, popTop, restoreTop, refetch } = useDeck();
  const swipeAction = useSwipeAction();
  const superPing = useSuperPing();
  const activateBoost = useActivateBoost();
  const { data: quota } = useSwipeQuota();
  const { data: admirersCount } = useAdmirersCount();
  const { data: credits } = useConsumableCredits();
  const deckRef = useRef<SwipeDeckHandle>(null);

  async function handleSwiped(card: DeckCard, direction: SwipeDirection) {
    popTop();
    try {
      const result = await swipeAction.mutateAsync({ targetId: card.profile_id, direction });
      if (result.matched && result.match_id) {
        // The match screen fires the one success haptic at the moment the rings lock.
        router.push({
          pathname: "/match/[matchId]",
          params: matchParams({
            matchId: result.match_id,
            name: card.display_name,
            photo: cardPicture(card),
            canDuo: showsDuoLabel(card),
            sharedGames: card.shared_games_count,
          }),
        });
      }
    } catch (err) {
      // The card already animated off — the RPC failed, so put it back at the
      // front of the deck instead of silently discarding an unrecorded swipe.
      restoreTop(card);
      if (err instanceof SwipeLimitReachedError) {
        // Straight to the paywall rather than an alert that asks permission to show it.
        //
        // This is the app's highest-intent moment: somebody who has just spent every free swipe
        // is, by definition, using the thing the subscription unlocks. An OS alert in front of it
        // added a tap, put "Not now" in the reflexive-dismiss position, and named a price and a
        // benefit the paywall was about to state properly anyway.
        //
        // Nothing is lost by skipping it, because the paywall is a modal with the close X on every
        // page: dismissing is one gesture, and the deck is still underneath with the card
        // restored above.
        //
        // It opens on page one, which for this entry is about the limit ("Out of swipes for today").
        router.push(paywallHref("limit"));
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
          { text: "Upgrade", onPress: () => router.push(paywallHref("superping")) },
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
          { text: "Get Power-Ups", onPress: () => router.push(paywallHref("powerup")) },
        ]);
      } else {
        Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
      }
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GraticuleBackground />
      <GrainOverlay />

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
            disabled={activateBoost.isPending}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              opacity: activateBoost.isPending ? 0.5 : pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="rocket" size={16} color={colors.volt} />
            <Text style={[type.caption, { color: colors.voltDim }]}>{credits?.boosts ?? 0}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/online-now")} hitSlop={8}>
            <Text style={[type.caption, { color: colors.voltDim }]}>Online</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/admirers")} hitSlop={8}>
            <Text style={[type.caption, { color: colors.voltDim }]}>
              Requests{admirersCount ? ` (${admirersCount})` : ""}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push("/filters")} hitSlop={8}>
            <Text style={[type.caption, { color: colors.voltDim }]}>Filters</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <DeckStrip quota={quota} />
      </View>

      {/* 12pt under the strip; 8pt above the buttons leaves room for the two cards peeking
          under the top one. */}
      <View style={{ flex: 1, marginHorizontal: spacing.lg, marginTop: spacing.tight, marginBottom: spacing.sm }}>
        {isLoading ? (
          <Skeleton style={{ flex: 1, borderRadius: radius.card }} />
        ) : error ? (
          <EmptyState
            icon="cloud-offline"
            title="Couldn't load your deck"
            subtitle="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
            tick="OFFLINE"
          />
        ) : cards.length === 0 ? (
          <EmptyDeck onRefresh={() => void refetch()} />
        ) : (
          <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
            <SwipeDeck ref={deckRef} cards={cards} onSwiped={(card, direction) => void handleSwiped(card, direction)} />
          </Animated.View>
        )}
      </View>

      {cards.length > 0 && (
        <LikePassButtons
          onPass={() => deckRef.current?.pass()}
          onLike={() => deckRef.current?.like()}
          onSuperPing={() => void handleSuperPing()}
          disabled={swipeAction.isPending || superPing.isPending}
        />
      )}
    </View>
  );
}
