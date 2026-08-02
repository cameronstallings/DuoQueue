import { useRef } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { AuroraBackground } from "@/components/AuroraBackground";
import { EmptyState } from "@/components/EmptyState";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Skeleton } from "@/components/Skeleton";
import { usePartyMembers } from "@/features/party/useParty";
import { usePartyDeck, usePartySwipeAction } from "@/features/party/usePartyDeck";
import { LikePassButtons } from "@/features/swipe/LikePassButtons";
import { SwipeDeck, type SwipeDeckHandle } from "@/features/swipe/SwipeDeck";
import type { DeckCard, SwipeDirection } from "@/features/swipe/types";
import { hapticSuccess } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

export default function PartyDeckScreen() {
  const { colors, spacing, type, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { data: members } = usePartyMembers(partyId);
  const { cards, isLoading, error, popTop, refetch } = usePartyDeck(partyId);
  const swipeAction = usePartySwipeAction(partyId);
  const deckRef = useRef<SwipeDeckHandle>(null);

  async function handleSwiped(card: DeckCard, direction: SwipeDirection) {
    popTop();
    try {
      const result = await swipeAction.mutateAsync({ targetId: card.profile_id, direction });
      if (result.invited) {
        hapticSuccess();
        Alert.alert(
          "Everyone said yes!",
          `The whole party liked ${card.display_name} — they've been invited to join.`,
        );
      }
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AuroraBackground />
      <GrainOverlay />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.md,
        }}
      >
        {/* This screen hides the native header, so without an explicit control there
            is no way back on Android at all. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={8}
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.round,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <Ionicons name="chevron-back" size={19} color={colors.text} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={{ ...type.screenTitle, color: colors.text }}>Party</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {(members ?? []).map((m) => m.display_name).join(" & ") || "Loading…"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Party chat"
          onPress={() => router.push({ pathname: "/party/[partyId]/chat", params: { partyId } })}
          hitSlop={8}
        >
          <Ionicons name="chatbubbles" size={24} color={colors.brandInk} />
        </Pressable>
      </View>

      <Text style={[type.caption, { color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }]}>
        Everyone in the party has to like someone before they get invited.
      </Text>

      <View style={{ flex: 1, margin: spacing.lg }}>
        {isLoading ? (
          <Skeleton style={{ flex: 1, borderRadius: radius.card }} />
        ) : error ? (
          <EmptyState
            icon="cloud-offline"
            title="Couldn't load the party deck"
            subtitle="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        ) : cards.length === 0 ? (
          <EmptyState
            icon="people"
            title="No more profiles right now"
            subtitle="Check back later for more people to consider together."
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
      />
    </View>
  );
}
