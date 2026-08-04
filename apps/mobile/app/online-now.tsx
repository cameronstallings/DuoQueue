import { useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useLookingNow } from "@/features/online-now/useLookingNow";
import { type OnlineNowCard, useOnlineNow } from "@/features/online-now/useOnlineNow";
import { useSwipeAction } from "@/features/swipe/useSwipeAction";
import { useTheme } from "@/theme/useTheme";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "Active just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Active ${hours}h ago`;
}

function OnlineNowRow({ item }: { item: OnlineNowCard }) {
  const { colors, spacing, type } = useTheme();
  const swipeAction = useSwipeAction();

  async function handleLike() {
    try {
      const result = await swipeAction.mutateAsync({ targetId: item.profile_id, direction: "like" });
      if (result.matched && result.match_id) {
        router.push({
          pathname: "/match/[matchId]",
          params: { matchId: result.match_id, name: item.display_name, photo: item.profilePhotoUrl ?? "" },
        });
      }
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
      <PresenceAvatar uri={item.profilePhotoUrl} size={56} isActive backdropColor={colors.surface} />
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: colors.text }]}>
          {item.display_name}, {item.age}
        </Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>{timeAgo(item.lastActiveAt)}</Text>
        {item.shared_games_count > 0 && (
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {item.shared_games_count} game{item.shared_games_count === 1 ? "" : "s"} in common
          </Text>
        )}
      </View>
      <Button label="Like" onPress={() => void handleLike()} loading={swipeAction.isPending} />
    </Card>
  );
}

function OnlineNowRowSkeleton() {
  const { radius, spacing } = useTheme();
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
      <Skeleton width={56} height={56} borderRadius={radius.round} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="55%" height={12} />
      </View>
    </Card>
  );
}

export default function OnlineNowScreen() {
  const { colors, radius, spacing, type } = useTheme();
  const { isLookingNow, setLookingNow } = useLookingNow();
  const { data: people, isLoading, error, refetch } = useOnlineNow();

  // Optimistic override so the switch flips the instant you tap it instead of waiting
  // on the round trip — cleared once the mutation settles, at which point it either
  // matches the resynced server state (success) or the switch snaps back (failure,
  // now paired with an alert instead of just silently doing nothing).
  const [optimisticLooking, setOptimisticLooking] = useState<boolean | null>(null);

  function handleToggleLookingNow(value: boolean) {
    setOptimisticLooking(value);
    setLookingNow.mutate(value, {
      onSettled: () => setOptimisticLooking(null),
      onError: (err) => {
        Alert.alert("Couldn't update Online Now", err instanceof Error ? err.message : "Please try again.");
      },
    });
  }

  const lookingNowSwitchValue = optimisticLooking ?? isLookingNow;

  return (
    <ScreenContainer title="Online Now" showClose>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.voltSoft,
          borderRadius: radius.lg,
          padding: spacing.md,
        }}
      >
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>I&apos;m free to duo right now</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            Shows you in other people&apos;s Online Now list for the next hour.
          </Text>
        </View>
        <Switch
          value={lookingNowSwitchValue}
          onValueChange={handleToggleLookingNow}
          disabled={setLookingNow.isPending}
          trackColor={{ true: colors.volt }}
        />
      </View>

      {isLoading ? (
        <View style={{ gap: spacing.sm }}>
          {[0, 1, 2].map((i) => (
            <OnlineNowRowSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.body, { color: colors.textMuted }]}>Couldn&apos;t load who&apos;s online.</Text>
          <Button label="Try again" variant="ghost" onPress={() => void refetch()} />
        </View>
      ) : !people || people.length === 0 ? (
        <EmptyState
          icon="flash"
          title="No one's online right now"
          subtitle="Turn on the toggle above so others can find you when they are."
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {people.map((item) => (
            <OnlineNowRow key={item.profile_id} item={item} />
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}
