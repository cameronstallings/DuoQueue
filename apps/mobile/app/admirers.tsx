import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { usePremiumStatus } from "@/features/matching/usePremiumStatus";
import { useAdmirers, useAdmirersCount, type AdmirerListItem } from "@/features/matching/useAdmirers";
import { useSwipeAction } from "@/features/swipe/useSwipeAction";
import { useTheme } from "@/theme/useTheme";

function AdmirerRow({ item }: { item: AdmirerListItem }) {
  const { colors, radius, spacing } = useTheme();
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
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
      }}
    >
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} />
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.background }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "700", color: colors.text }}>
          {item.display_name}, {item.age}
        </Text>
        {item.bio ? (
          <Text numberOfLines={1} style={{ color: colors.textMuted }}>
            {item.bio}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => void handleLikeBack()}
        disabled={swipeAction.isPending}
        style={{ backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Like back</Text>
      </Pressable>
    </View>
  );
}

function AdmirerRowSkeleton() {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
      }}
    >
      <Skeleton width={56} height={56} borderRadius={28} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="70%" height={12} />
      </View>
    </View>
  );
}

export default function AdmirersScreen() {
  const { colors, spacing, type } = useTheme();
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus();
  const { data: count } = useAdmirersCount();
  const { data: admirers, isLoading, isFetching, error, refetch } = useAdmirers(isPremium);

  if (premiumLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.brand} />
      </ScreenContainer>
    );
  }

  if (!isPremium) {
    return (
      <ScreenContainer>
        <Text style={{ ...type.screenTitle, color: colors.text }}>Who liked you</Text>
        <Text style={{ color: colors.textMuted }}>
          {count && count > 0
            ? `${count} ${count === 1 ? "person has" : "people have"} already swiped right on you.`
            : "See who swipes right on you before you match."}
        </Text>
        <Button label="Unlock with DuoQueue+" onPress={() => router.push("/paywall")} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={colors.brand} />
      }
    >
      <Text style={{ ...type.screenTitle, color: colors.text }}>Who liked you</Text>
      {isLoading ? (
        <View>
          {[0, 1, 2].map((i) => (
            <AdmirerRowSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.textMuted }}>Couldn&apos;t load your admirers.</Text>
          <Button label="Try again" variant="ghost" onPress={() => void refetch()} />
        </View>
      ) : !admirers || admirers.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="No admirers yet"
          subtitle="Keep your profile fresh — new likes will show up here."
        />
      ) : (
        <FlatList
          data={admirers}
          keyExtractor={(item) => item.profile_id}
          renderItem={({ item }) => <AdmirerRow item={item} />}
          scrollEnabled={false}
        />
      )}
    </ScreenContainer>
  );
}
