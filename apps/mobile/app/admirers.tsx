import { useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { usePremiumStatus } from "@/features/matching/usePremiumStatus";
import { useAdmirers, useAdmirersCount, type AdmirerListItem } from "@/features/matching/useAdmirers";
import { useSwipeAction } from "@/features/swipe/useSwipeAction";
import { useTheme } from "@/theme/useTheme";

function AdmirerRow({ item }: { item: AdmirerListItem }) {
  const { colors, spacing, type } = useTheme();
  const swipeAction = useSwipeAction();

  async function handleLikeBack() {
    try {
      const result = await swipeAction.mutateAsync({ targetId: item.profile_id, direction: "like" });
      if (result.matched && result.match_id) {
        router.push({
          pathname: "/match/[matchId]",
          params: { matchId: result.match_id, name: item.display_name, photo: item.photoUrl ?? "" },
        });
      }
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm }}>
      <PresenceAvatar uri={item.photoUrl} size={56} />
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: colors.text }]}>
          {item.display_name}, {item.age}
        </Text>
        {item.bio ? (
          <Text numberOfLines={1} style={[type.body, { color: colors.textMuted }]}>
            {item.bio}
          </Text>
        ) : null}
      </View>
      <Button label="Like back" onPress={() => void handleLikeBack()} loading={swipeAction.isPending} />
    </Card>
  );
}

function AdmirerRowSkeleton() {
  const { radius, spacing } = useTheme();
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm }}>
      <Skeleton width={56} height={56} borderRadius={radius.round} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="70%" height={12} />
      </View>
    </Card>
  );
}

export default function AdmirersScreen() {
  const { colors, radius, spacing, type } = useTheme();
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus();
  const { data: count } = useAdmirersCount();
  const { data: admirers, isLoading, error, refetch } = useAdmirers(!premiumLoading);

  // Spinner only for user-initiated pulls, not every background refetch.
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  if (premiumLoading) {
    return (
      <ScreenContainer title="Who liked you" showClose>
        <View>
          {[0, 1, 2].map((i) => (
            <AdmirerRowSkeleton key={i} />
          ))}
        </View>
      </ScreenContainer>
    );
  }

  // Free users see a rotating daily trio (enforced server-side); anyone beyond
  // those 3 is the upsell.
  const hiddenCount = !isPremium && count ? Math.max(count - (admirers?.length ?? 0), 0) : 0;

  return (
    <ScreenContainer
      title="Who liked you"
      showClose
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.volt} />
      }
    >
      {!isPremium && (
        <Text style={[type.body, { color: colors.textMuted }]}>
          Here are 3 people who liked you — a new set appears every day.
        </Text>
      )}
      {isLoading ? (
        <View>
          {[0, 1, 2].map((i) => (
            <AdmirerRowSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.body, { color: colors.textMuted }]}>Couldn&apos;t load your admirers.</Text>
          <Button label="Try again" variant="ghost" onPress={() => void refetch()} />
        </View>
      ) : !admirers || admirers.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="No admirers yet"
          subtitle="Keep your profile fresh — new likes will show up here."
          tick="NO ADMIRERS"
        />
      ) : (
        <Animated.View entering={FadeIn.duration(220)}>
          <FlatList
            data={admirers}
            keyExtractor={(item) => item.profile_id}
            renderItem={({ item }) => <AdmirerRow item={item} />}
            scrollEnabled={false}
          />
        </Animated.View>
      )}

      {hiddenCount > 0 && (
        <View
          style={{
            backgroundColor: colors.voltSoft,
            borderRadius: radius.lg,
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          <Text style={[type.bodyStrong, { color: colors.text }]}>
            {hiddenCount} more {hiddenCount === 1 ? "person" : "people"} liked you
          </Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            DuoQueue+ shows you everyone at once — no waiting for tomorrow&apos;s set.
          </Text>
          <Button variant="premium" label="See them all with DuoQueue+" onPress={() => router.push("/paywall")} />
        </View>
      )}
    </ScreenContainer>
  );
}
