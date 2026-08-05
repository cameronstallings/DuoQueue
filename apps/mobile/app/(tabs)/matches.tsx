import { useState } from "react";
import { RefreshControl, SectionList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { Name } from "@/components/Name";
import { Skeleton } from "@/components/Skeleton";
import { SectionLabel } from "@/components/SectionLabel";
import { useMatches, type MatchListItem } from "@/features/chat/useMatches";
import { PartyInvitesBanner } from "@/features/party/PartyInvitesBanner";
import { PartyListSection } from "@/features/party/PartyListSection";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

interface MatchSection {
  title: string;
  data: MatchListItem[];
}

function groupMatches(matches: MatchListItem[], myId: string | undefined): MatchSection[] {
  const newMatches: MatchListItem[] = [];
  const yourTurn: MatchListItem[] = [];
  const theirTurn: MatchListItem[] = [];

  for (const item of matches) {
    if (!item.last_message_sender_id) {
      newMatches.push(item);
    } else if (item.last_message_sender_id !== myId) {
      yourTurn.push(item);
    } else {
      theirTurn.push(item);
    }
  }

  return [
    { title: "New matches", data: newMatches },
    { title: "Your turn", data: yourTurn },
    { title: "Their turn", data: theirTurn },
  ].filter((section) => section.data.length > 0);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function MatchRow({ item }: { item: MatchListItem }) {
  const { colors, spacing, type, radius } = useTheme();
  const unread = item.unread_count > 0;

  const unreadLabel = unread ? `, ${item.unread_count} unread` : "";
  const lockedLabel = item.is_locked ? ", locked" : "";

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item.match_id } })}
      accessibilityRole="button"
      accessibilityLabel={`${item.other_display_name}${unreadLabel}${lockedLabel}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.surfaceAlt : "transparent",
      })}
    >
      {/* A round avatar, own Pressable so a tap opens the profile without also
          opening the chat underneath it. Border brightens to volt — the one unread signal. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View profile"
        onPress={() => router.push(`/profile/${item.other_profile_id}`)}
        hitSlop={8}
        style={{
          width: 54,
          height: 54,
          borderRadius: radius.round,
          borderWidth: unread ? 2 : 1,
          borderColor: unread ? colors.voltRaw : colors.border,
        }}
      >
        {item.otherPhotoUrl ? (
          <Image
            source={{ uri: item.otherPhotoUrl }}
            style={{ width: "100%", height: "100%", borderRadius: radius.round }}
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: "100%",
              borderRadius: radius.round,
              backgroundColor: colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={[type.title, { color: colors.textMuted }]}>{item.other_display_name[0]}</Text>
          </View>
        )}
      </Pressable>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Name variant="bodyStrong" style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
            {item.other_display_name}
          </Name>
          <Text style={[type.caption, { color: colors.textMuted }]}>{timeAgo(item.last_message_at)}</Text>
        </View>
        <Text
          numberOfLines={1}
          style={[unread ? type.bodyStrong : type.body, { color: unread ? colors.text : colors.textMuted }]}
        >
          {item.last_message ?? "Say hi!"}
        </Text>
      </View>

      {item.is_locked && <Chip tone="amber" label="Locked" />}
    </Pressable>
  );
}

function MatchRowSkeleton() {
  const { spacing, radius } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}>
      <Skeleton width={54} height={54} borderRadius={radius.round} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="80%" height={12} />
      </View>
    </View>
  );
}

export default function MatchesScreen() {
  const { colors, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useSessionStore((s) => s.profile);
  const { data: matches, isLoading, error, refetch } = useMatches();
  const sections = matches ? groupMatches(matches, profile?.id) : [];

  // Spinner only for user-initiated pulls — driving it from isFetching made the list
  // flash a refresh spinner on every background refetch when returning to this tab.
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Text
        style={{
          ...type.screenTitle,
          color: colors.text,
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.lg,
        }}
      >
        Matches
      </Text>

      <PartyInvitesBanner />
      <PartyListSection />

      {isLoading ? (
        <View>
          {[0, 1, 2, 3, 4].map((i) => (
            <MatchRowSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline"
          title="Couldn't load matches"
          subtitle="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void refetch()}
          tick="OFFLINE"
        />
      ) : !matches || matches.length === 0 ? (
        <EmptyState
          icon="game-controller"
          title="No matches yet"
          subtitle="Keep swiping in the Deck tab — when you both want to duo, they show up here."
          tick="NO DUOS YET"
        />
      ) : (
        <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.match_id}
            renderItem={({ item }) => <MatchRow item={item} />}
            renderSectionHeader={({ section }) => (
              <View
                style={{
                  backgroundColor: colors.background,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.md,
                  paddingBottom: spacing.xs,
                }}
              >
                <SectionLabel>{`${section.title} (${section.data.length})`}</SectionLabel>
              </View>
            )}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.volt} />
            }
          />
        </Animated.View>
      )}
    </View>
  );
}
