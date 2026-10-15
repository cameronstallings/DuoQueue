import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { type OnlineNowCard, useOnlineNow } from "@/features/online-now/useOnlineNow";
import { matchParams } from "@/features/match/matchMoment";
import { InlineError } from "@/features/queue/InlineError";
import { ONLINE_NOW_COPY, QUEUE_COPY, queueErrorMessage, untilLine } from "@/features/queue/queueCopy";
import { formatTime, QueueUpSheet } from "@/features/queue/QueueUpSheet";
import { useMyQueueUp, useStopQueueUp } from "@/features/queue/useQueueUp";
import { useQueueState } from "@/features/queue/useQueueState";
import { cardPicture } from "@/features/swipe/cardChips";
import { useSwipeAction } from "@/features/swipe/useSwipeAction";
import { useFirstReveal } from "@/hooks/useFirstReveal";
import { useRequireSession } from "@/hooks/useRequireSession";
import { hapticError } from "@/lib/haptics";
import { toUserMessage } from "@/lib/userMessage";
import { listItemEntering } from "@/theme/entering";
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
          params: matchParams({
            matchId: result.match_id,
            name: item.display_name,
            photo: cardPicture(item),
            canDuo: false,
            sharedGames: item.shared_games_count,
          }),
        });
      }
    } catch (err) {
      hapticError();
      Alert.alert(ONLINE_NOW_COPY.duoFailedTitle, toUserMessage(err, ONLINE_NOW_COPY.duoFailedBody));
    }
  }

  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
      <PresenceAvatar uri={cardPicture(item)} name={item.display_name} size={56} isActive />
      <View style={{ flex: 1 }}>
        {/* AGES STAY (Cameron's decision 2). */}
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
      <Button
        label={ONLINE_NOW_COPY.duo}
        haptic="light"
        onPress={() => void handleLike()}
        loading={swipeAction.isPending}
      />
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

/**
 * Where the player stands, at the top of the list: queued (for which game, until when, and
 * Stop), or not (and Queue up, which opens the same sheet the deck's header does, here on this
 * screen). This card replaced the "I'm free to duo right now" switch in 1.0.2: Queue up is the one
 * idea (Cameron's decision 7), and it sets exactly what the switch set, for the same hour, plus
 * the Duo Pops and the Duo Call. The switch's own fault went with it: it read only the flag, so a
 * flag that outlived its expiry showed "on" for nobody (useQueueState reads the expiry).
 */
function QueueStatusCard({ onQueueUp }: { onQueueUp: () => void }) {
  const { colors, spacing, type } = useTheme();
  const queueState = useQueueState();
  const queued = queueState.kind === "queued";
  const status = useMyQueueUp({ enabled: queued });
  const stop = useStopQueueUp();
  // Said under the card: this screen is a modal, and the root Toast draws under it (InlineError).
  const [stopError, setStopError] = useState<string | null>(null);

  const until = queueState.kind === "queued" ? formatTime(queueState.untilMs, false) : null;
  const title = queued ? ONLINE_NOW_COPY.queuedTitle(status.data?.game_name ?? null) : ONLINE_NOW_COPY.idleTitle;
  const line = queued ? (until ? untilLine(until) : null) : ONLINE_NOW_COPY.idleBody;

  function stopQueueing() {
    setStopError(null);
    stop.mutate(undefined, { onError: (err) => setStopError(queueErrorMessage(err, QUEUE_COPY.stopFailed)) });
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
          {line ? <Text style={[type.caption, { color: colors.textMuted }]}>{line}</Text> : null}
        </View>
        {queued ? (
          <Button
            size="sm"
            variant="ghost"
            haptic="light"
            label={ONLINE_NOW_COPY.stop}
            loading={stop.isPending}
            onPress={stopQueueing}
          />
        ) : (
          <Button size="sm" haptic="light" label={ONLINE_NOW_COPY.queueUp} onPress={onQueueUp} />
        )}
      </Card>
      <InlineError message={queued ? stopError : null} align="right" />
    </View>
  );
}

export default function OnlineNowScreen() {
  useRequireSession();
  const { spacing, type, colors } = useTheme();
  const reduced = useReducedMotion();
  const { data: people, isLoading, error, refetch } = useOnlineNow();
  const firstReveal = useFirstReveal(!isLoading && !!people);
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <ScreenContainer title="Online Now" showClose>
      <QueueStatusCard onQueueUp={() => setSheetVisible(true)} />

      {isLoading ? (
        <View style={{ gap: spacing.sm }}>
          {[0, 1, 2].map((i) => (
            <OnlineNowRowSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.body, { color: colors.textMuted }]}>{ONLINE_NOW_COPY.loadFailed}</Text>
          <Button label={ONLINE_NOW_COPY.tryAgain} variant="ghost" onPress={() => void refetch()} />
        </View>
      ) : !people || people.length === 0 ? (
        <EmptyState
          icon="flash"
          title={ONLINE_NOW_COPY.emptyTitle}
          subtitle={ONLINE_NOW_COPY.emptyBody}
          tick={ONLINE_NOW_COPY.emptyTick}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {people.map((item, index) => (
            // The cascade plays once, on the first load; the 30-second refresh never replays it.
            <Animated.View key={item.profile_id} entering={firstReveal ? listItemEntering(index, reduced) : undefined}>
              <OnlineNowRow item={item} />
            </Animated.View>
          ))}
        </View>
      )}

      <QueueUpSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} showOnlineLink={false} />
    </ScreenContainer>
  );
}
