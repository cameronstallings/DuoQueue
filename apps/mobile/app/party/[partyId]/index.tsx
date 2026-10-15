import { useRef } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { EmptyState } from "@/components/EmptyState";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Skeleton } from "@/components/Skeleton";
import { PartyLfgRow } from "@/features/party/PartyLfgRow";
import { joinNames, PARTY_DECK_COPY, PARTY_LFG_COPY } from "@/features/party/partyCopy";
import { PARTY_CAP, PARTY_POLL_MS, usePartyMembers, usePartyPendingInvites } from "@/features/party/useParty";
import { usePartyDeck, usePartySwipeAction } from "@/features/party/usePartyDeck";
import { usePartyLfg } from "@/features/party/usePartyLfg";
import { LikePassButtons } from "@/features/swipe/LikePassButtons";
import { SwipeDeck, type SwipeDeckHandle } from "@/features/swipe/SwipeDeck";
import type { DeckCard, SwipeDirection } from "@/features/swipe/types";
import { useRequireSession } from "@/hooks/useRequireSession";
import { hapticSuccess } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

// A screen opened as the app's cold-start/deep-link entry has no history to pop —
// router.back() would be a silent no-op, stranding the user with a dead button.
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}

export default function PartyDeckScreen() {
  useRequireSession();
  const { colors, spacing, type, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  // Polled while this screen is up, because the moment that matters here (the third person
  // accepting, or saying no) happens on somebody else's phone. A party push or a return to the
  // app refreshes both sooner (usePartyFreshness); the poll covers anyone with pushes off.
  const {
    data: members,
    isLoading: membersLoading,
    isError: membersError,
  } = usePartyMembers(partyId, { refetchInterval: PARTY_POLL_MS });
  const { data: pendingInvites } = usePartyPendingInvites(partyId);
  const { cards, isLoading, error, popTop, restoreTop, refetch } = usePartyDeck(partyId);
  const swipeAction = usePartySwipeAction(partyId);
  const deckRef = useRef<SwipeDeckHandle>(null);

  // Full means three people: nobody is left to invite, and the server sends no more invites
  // (0070), so the deck would only be swipes that go nowhere. The chat is the party now.
  const isFull = (members?.ids.length ?? 0) >= PARTY_CAP;
  const waitingOn = joinNames((pendingInvites ?? []).map((invite) => invite.display_name));
  const lfg = usePartyLfg(partyId, members, membersError);
  // Only a row that is really there (Share, or the live post) changes the caption: a skeleton
  // must not, or the caption would switch and switch back before 0089 is live.
  const lfgShown = lfg.view.kind === "idle" || lfg.view.kind === "live";

  function openChat() {
    router.push({ pathname: "/party/[partyId]/chat", params: { partyId } });
  }

  async function handleSwiped(card: DeckCard, direction: SwipeDirection) {
    popTop();
    try {
      const result = await swipeAction.mutateAsync({ targetId: card.profile_id, direction });
      if (result.invited) {
        hapticSuccess();
        Alert.alert(
          "Invite sent",
          `You all liked ${card.display_name}. They join your party chat once they accept.`,
        );
      }
    } catch (err) {
      // The card already animated off — the RPC failed, so put it back at the
      // front of the deck instead of silently discarding an unrecorded swipe.
      restoreTop(card);
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GraticuleBackground />
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
          onPress={goBack}
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
            {joinNames((members?.profiles ?? []).map((m) => m.display_name)) || "Loading…"}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Party chat" onPress={openChat} hitSlop={8}>
          <Ionicons name="chatbubbles" size={24} color={colors.voltDim} />
        </Pressable>
      </View>

      {!isFull && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs }}>
          {/* "From the deck" while a post can also bring someone in: the deck's rule is no longer
              the only way a third arrives. */}
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {lfgShown ? PARTY_DECK_COPY.captionWithPost : PARTY_DECK_COPY.caption}
          </Text>
          {/* The party LFG post (build 20, 0089): a party of two can share a code to find their
              third anywhere. Hidden for any other size, and whenever the server has no 0089. */}
          <PartyLfgRow lfg={lfg} />
          {/* Somebody the party already said yes to. Until they answer, the like is not lost, it
              is waiting, and without this line a sent invite looked like nothing had happened. */}
          {waitingOn ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <Ionicons name="hourglass-outline" size={14} color={colors.voltDim} />
              <Text style={[type.caption, { color: colors.text, flex: 1 }]} numberOfLines={2}>
                Waiting on {waitingOn}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={{ flex: 1, margin: spacing.lg }}>
        {isFull ? (
          <EmptyState
            icon="people"
            title="Your party is full"
            subtitle="All three of you are in. Plan your next game in the party chat."
            actionLabel="Open party chat"
            onAction={openChat}
            tick="PARTY FULL"
          />
        ) : isLoading || membersLoading ? (
          <Skeleton style={{ flex: 1, borderRadius: radius.card }} />
        ) : error ? (
          <EmptyState
            icon="cloud-offline"
            title="Couldn't load the party deck"
            subtitle="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
            tick="OFFLINE"
          />
        ) : cards.length === 0 ? (
          // Out of people to consider together: the post is the way to find a third anywhere, so
          // it leads when one can be made; Refresh stays for the deck itself. Without the feature
          // (or with a post already live, shown just above) it is today's single Refresh.
          lfg.view.kind === "idle" ? (
            <EmptyState
              icon="people"
              title={PARTY_DECK_COPY.emptyTitle}
              subtitle={PARTY_DECK_COPY.emptySubtitleWithPost}
              actionLabel={PARTY_LFG_COPY.share}
              actionVariant="primary"
              onAction={lfg.share}
              secondaryActionLabel={PARTY_DECK_COPY.refresh}
              onSecondaryAction={() => void refetch()}
              tick="QUEUE CLEAR"
            />
          ) : (
            <EmptyState
              icon="people"
              title={PARTY_DECK_COPY.emptyTitle}
              subtitle={PARTY_DECK_COPY.emptySubtitle}
              actionLabel={PARTY_DECK_COPY.refresh}
              onAction={() => void refetch()}
              tick="QUEUE CLEAR"
            />
          )
        ) : (
          <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
            <SwipeDeck
              ref={deckRef}
              cards={cards}
              context="party"
              onSwiped={(card, direction) => void handleSwiped(card, direction)}
            />
          </Animated.View>
        )}
      </View>

      {!isFull && (
        <LikePassButtons
          disabled={cards.length === 0}
          onPass={() => deckRef.current?.pass()}
          onLike={() => deckRef.current?.like()}
        />
      )}
    </View>
  );
}
