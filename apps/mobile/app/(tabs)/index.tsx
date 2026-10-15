import { useRef } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { CountBadge } from "@/components/CountBadge";
import { EmptyState } from "@/components/EmptyState";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Skeleton } from "@/components/Skeleton";
import { useAdmirersCount } from "@/features/matching/useAdmirers";
import { PushPreAskCard } from "@/features/push/PushPreAskCard";
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
import { DeckStrip } from "@/features/swipe/DeckStrip";
import { EmptyDeck } from "@/features/swipe/EmptyDeck";
import { LIKE_PASS_ROW_HEIGHT, LikePassButtons } from "@/features/swipe/LikePassButtons";
import { SwipeDeck, type SwipeDeckHandle } from "@/features/swipe/SwipeDeck";
import { useDeck } from "@/features/swipe/useDeck";
import { useDeckPrefetch } from "@/features/swipe/useDeckPrefetch";
import { useDeckSwipeFlow } from "@/features/swipe/useDeckSwipeFlow";
import { useEmptyDeckReason } from "@/features/swipe/useEmptyDeckReason";
import { useSwipeQuota } from "@/features/swipe/useSwipeQuota";
import { hapticError, hapticLight } from "@/lib/haptics";
import { quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

export default function DeckScreen() {
  const { colors, spacing, type, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { cards, isLoading, error, popTop, restoreTop, refetch } = useDeck();
  const superPing = useSuperPing();
  const activateBoost = useActivateBoost();
  const { data: quota } = useSwipeQuota();
  const { data: admirersCount } = useAdmirersCount();
  const { data: credits } = useConsumableCredits();
  const deckRef = useRef<SwipeDeckHandle>(null);
  // The swipe itself (decide early, the free limit, putting a failed card back, DUO LOCKED, the
  // limit paywall) lives in useDeckSwipeFlow.
  const flow = useDeckSwipeFlow({ cards, popTop, restoreTop, quota, openLimitPaywall: () => router.push(paywallHref("limit")) });
  useDeckPrefetch(cards, !isLoading && !error);
  // Asked here as well as in EmptyDeck (the same query keys), so when the deck drains the one
  // skeleton below stays up until the empty deck knows which screen it is, and EmptyDeck mounts
  // with the answer cached instead of showing a second skeleton of its own.
  const emptyReason = useEmptyDeckReason(!isLoading && !error && cards.length === 0);
  const holdSkeleton = isLoading || (!error && cards.length === 0 && emptyReason.kind === "resolving");

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
        hapticError();
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
        hapticError();
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
          {/* The Power-Up rocket shows only when there is a Power-Up to use: at 0 it was a
              button that could only say "Out of Power-Ups", on every free player's deck. Its
              count is a badge over the icon, so it takes 16pt of the header row (the measured
              header fits a 375pt phone with it shown). */}
          {(credits?.boosts ?? 0) > 0 && (
            <Animated.View entering={revealEntering()} exiting={quickExiting()}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Activate Power-Up"
                onPress={() => void handleActivateBoost()}
                disabled={activateBoost.isPending}
                hitSlop={8}
                style={({ pressed }) => ({
                  opacity: activateBoost.isPending ? 0.5 : pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="rocket" size={16} color={colors.volt} />
                <CountBadge count={credits?.boosts ?? 0} style={{ position: "absolute", top: -6, right: -10 }} />
              </Pressable>
            </Animated.View>
          )}
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
        {/* One Skeleton covers loading and the empty deck working out why it is empty; it keeps
            this place in the tree, so its pulse never restarts between the two. */}
        {holdSkeleton ? (
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
          <Animated.View entering={revealEntering()} style={{ flex: 1 }}>
            <SwipeDeck
              ref={deckRef}
              cards={cards}
              canCommit={flow.canCommit}
              restored={flow.restored}
              onDecided={flow.onDecided}
              onSwiped={(card, direction) => void flow.onSwiped(card, direction)}
              onBlocked={flow.onBlocked}
            />
          </Animated.View>
        )}
        {/* The notification pre-ask, over the bottom of the deck after a Duo that did not match.
            Only while there are cards: when the deck empties it fades out with them, so it never
            covers the empty deck's buttons. */}
        {cards.length > 0 && <PushPreAskCard surface="deck" />}
      </View>

      {/* The row's height is reserved while loading, swiping and empty, so the card area never
          changes size. A swipe in flight no longer dims Duo and Pass (a request per card would
          flash them on every swipe); Super Ping is for DuoQueue+ only, and fades in. */}
      <View style={{ height: LIKE_PASS_ROW_HEIGHT, justifyContent: "center" }}>
        {!isLoading && cards.length > 0 && (
          <LikePassButtons
            onPass={() => deckRef.current?.pass()}
            onLike={() => deckRef.current?.like()}
            onSuperPing={quota?.is_premium === true ? () => void handleSuperPing() : undefined}
            disabled={superPing.isPending}
            blocked={!flow.canCommit}
          />
        )}
      </View>
    </View>
  );
}
