import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ChipSelect } from "@/components/ChipSelect";
import { SectionLabel } from "@/components/SectionLabel";
import { Sheet } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { ToggleRow } from "@/components/ToggleRow";
import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { useEditableProfileDetails } from "@/features/profile/useEditableProfileDetails";
import { askForPush } from "@/features/push/askForPush";
import { PUSH_ON_TOAST } from "@/features/push/pushAsk";
import { usePushPermission } from "@/features/push/usePushPermission";
import { hapticSuccess } from "@/lib/haptics";
import { inviteUrl } from "@/lib/invite";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { layoutTransition, quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { isNaRegion } from "./duoPopsOptIn";
import { InlineError } from "./InlineError";
import { lfgPost, lfgRankParts, lfgTags } from "./lfgPost";
import { lockedLine, outcomeLine, QUEUE_COPY, queueErrorMessage, untilLine } from "./queueCopy";
import { popRecheckAtMs, sheetClockMs, sheetViewOf } from "./queueState";
import { useQueueUpSheetStore } from "./queueUpSheetStore";
import { useMyQueueUp, useStartQueueUp, useStopQueueUp } from "./useQueueUp";
import { useQueueState } from "./useQueueState";

/** How often the open sheet re-reads the clock, so "popping" turns into "nobody grabbed it" and
 * the minutes count down. Only while the sheet is visible. */
const SHEET_TICK_MS = 15_000;

/** The queued body's height, for the one skeleton shown while its status loads. */
const QUEUED_SKELETON_H = 300;

/** How long Copy post reads "Post copied" (the toast it replaces lasted as long). */
const COPIED_MS = 2000;

/** A time in the phone's own clock ("10:40 PM", or "10:40 PM CDT" for a post that leaves the
 * phone). Null when it cannot be formatted, and the line it belongs to is left out. Exported for
 * Online Now's status card, which says the same "On until" line. */
export function formatTime(iso: string | number, withZone: boolean): string | null {
  try {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      ...(withZone ? { timeZoneName: "short" as const } : {}),
    }).format(date);
  } catch {
    return null;
  }
}

/** The clock, re-read every SHEET_TICK_MS while `active`, and once whenever it becomes active. */
function useSheetClock(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), SHEET_TICK_MS);
    return () => clearInterval(timer);
  }, [active]);
  return nowMs;
}

/** A plain text link in voltDim (audited on the sheet's surface). */
function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      {({ pressed }) => <Text style={[type.caption, { color: colors.voltDim, opacity: pressed ? 0.7 : 1 }]}>{label}</Text>}
    </Pressable>
  );
}

interface QueueUpSheetProps {
  visible: boolean;
  onClose: () => void;
  /** "See who's on now". Online Now's own sheet leaves it out (the list is already behind it). */
  showOnlineLink?: boolean;
}

/**
 * The Queue Up sheet, opened from the deck header's pill, the empty deck, Online Now and a Duo
 * Pop that was gone. Three phases, each titled for what it is:
 *
 *   Queue up       pick a game (the profile's, in priority order, the first preselected), Ping
 *                  players (NA only, on by default: send a Duo Pop to up to 6 players in that
 *                  game), then Queue up. Outside NA there is no switch, only the honest line.
 *   You're queued  the game, until when, and the server's own result ("We let 4 players know.",
 *                  or why nobody was pinged); the Duo Call (share or copy the LFG post, with its
 *                  code); the 18+ card; a notifications row if they are off, so the sender hears
 *                  the moment someone is in; See who's on now; Stop queueing.
 *   Duo locked     who grabbed the pop, and Send a message.
 *
 * Honest by construction: every count and reason is the server's (start_queue_up's row, or
 * get_my_queue_up's on open), nothing polls (one read when it opens, one more just after the
 * 10-minute pop window closes, and the clock ticks every 15 s only while it is open), "nobody
 * grabbed it" is only ever said from a read taken after that window (queueState.sheetClockMs),
 * and nothing posts by itself: Share opens the iOS share sheet with the player's own text, and
 * they choose where it goes.
 *
 * Motion: each phase fades in as the last fades out (keyed), and the box between them glides to
 * its new height (a layout transition; if it misbehaves inside the Modal on a device, drop only
 * that prop).
 */
export function QueueUpSheet({ visible, onClose, showOnlineLink = true }: QueueUpSheetProps) {
  const { colors, spacing, type } = useTheme();
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const profile = useSessionStore((s) => s.profile);
  // The games are read from the first time the sheet opens (the deck mounts it for its whole
  // life, so not before), and kept after, so closing never swaps the body for a skeleton mid-fade.
  const [opened, setOpened] = useState(visible);
  useEffect(() => {
    if (visible) setOpened(true);
  }, [visible]);
  const details = useEditableProfileDetails(opened || visible ? profile?.id : undefined);
  const queueState = useQueueState();
  const status = useMyQueueUp({ enabled: visible });
  const start = useStartQueueUp();
  const stop = useStopQueueUp();
  const { data: permission } = usePushPermission();
  const nowMs = useSheetClock(visible);

  const [chosenGameId, setChosenGameId] = useState<string | null>(null);
  const [ping, setPing] = useState(true);
  const [asking, setAsking] = useState(false);

  // What went wrong in THIS presentation, said under the button that failed (InlineError: a toast
  // would draw behind this Modal), and "Post copied" on the Copy button itself for the same reason.
  // Cleared on the next try and whenever the sheet opens again, so a failure from an earlier visit
  // never greets the next one. The reset happens in the render that sees the sheet open (React's
  // "adjust state when a prop changes"), so not even one frame shows the old line.
  const [startError, setStartError] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [presented, setPresented] = useState(visible);
  if (presented !== visible) {
    setPresented(visible);
    if (visible) {
      setStartError(null);
      setStopError(null);
      setCopied(false);
    }
  }
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const games = details.data?.games ?? [];
  const gameId = chosenGameId && games.some((g) => g.gameId === chosenGameId) ? chosenGameId : (games[0]?.gameId ?? null);
  const inNa = isNaRegion(profile?.region);
  const row = status.data ?? null;
  // "Nobody grabbed it" only from a read taken after the pop window closed (sheetClockMs), and
  // that read is asked for once, just after it closes, while the sheet is open: a sender with
  // notifications off would otherwise be told nobody answered over a duo that exists.
  const view = sheetViewOf(row, sheetClockMs(row, nowMs, status.dataUpdatedAt));
  const recheckAt = visible ? popRecheckAtMs(row, status.dataUpdatedAt) : null;
  const refetchStatus = status.refetch;
  useEffect(() => {
    if (recheckAt === null) return;
    const timer = setTimeout(() => void refetchStatus(), Math.max(0, recheckAt - Date.now()));
    return () => clearTimeout(timer);
  }, [recheckAt, refetchStatus]);

  // Queued by the profile but the row has not come back yet: one skeleton the size of the queued
  // body, so the sheet does not flash the idle form first. A failed read says so.
  const loading = queueState.kind === "queued" && status.data === undefined && status.isFetching;
  const failed = queueState.kind === "queued" && status.data === undefined && status.isError && !status.isFetching;
  // Queued by the profile with no live queue-up behind it: 0085 is not live yet (the read is
  // null), or a 1.0.1 phone's free-to-duo switch set the flag after this queue-up ended. The pill
  // says "Queued 37m", so the sheet says so too and offers Stop (useStopQueueUp falls back to
  // set_looking_now(false) before 0085), never the idle form with no way to stop.
  const queuedByProfile = queueState.kind === "queued" && view.kind === "idle";
  const phase = loading ? "loading" : failed ? "error" : queuedByProfile ? "profile" : view.kind;

  const titleStyle = { ...type.title, color: colors.text };
  const captionMuted = [type.caption, { color: colors.textMuted }];

  function openOnlineNow() {
    onClose();
    router.push("/online-now");
  }

  function postText(): string | null {
    if (!row?.call_code || !profile) return null;
    const game = games.find((g) => g.gameId === row.game_id);
    const gameName = row.game_name ?? game?.name;
    if (!gameName) return null;
    const rank = game
      ? lfgRankParts({ rankText: game.rankText, lolTier: game.lolTier, lolDivision: game.lolDivision })
      : { rankLabel: null, duoRange: null };
    return lfgPost({
      gameName,
      regionLabel: REGION_LABELS[profile.region] ?? null,
      rankLabel: rank.rankLabel,
      duoRange: rank.duoRange,
      tags: lfgTags(details.data?.playstyles ?? []),
      untilLabel: formatTime(row.looking_until, true),
      url: inviteUrl(row.call_code, process.env.EXPO_PUBLIC_SUPABASE_URL),
      code: row.call_code,
    });
  }

  async function sharePost() {
    const message = postText();
    if (!message) return;
    try {
      // Message only, as the invite screen shares: a separate url field makes some targets drop
      // the text, and the link is already inside the post.
      const result = await Share.share({ message });
      if (result.action === Share.sharedAction) hapticSuccess();
    } catch {
      // The share sheet failed to open or was torn down. Nothing was posted; nothing to say.
    }
  }

  async function copyPost() {
    const message = postText();
    if (!message) return;
    try {
      await Clipboard.setStringAsync(message);
      hapticSuccess();
      setCopied(true);
    } catch {
      // Clipboard unavailable. Share still works.
    }
  }

  function queueUp() {
    if (!gameId) return;
    setStartError(null);
    start.mutate(
      { gameId, ping: inNa && ping },
      { onError: (err) => setStartError(queueErrorMessage(err, QUEUE_COPY.startFailed)) },
    );
  }

  function stopQueueing() {
    setStopError(null);
    stop.mutate(undefined, { onError: (err) => setStopError(queueErrorMessage(err, QUEUE_COPY.stopFailed)) });
  }

  async function turnOnNotifications() {
    if (asking || !profile) return;
    setAsking(true);
    const outcome = await askForPush(profile.id, queryClient);
    setAsking(false);
    if (outcome === "register-token") {
      hapticSuccess();
      showToast(PUSH_ON_TOAST);
    }
  }

  const footer = (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
        {showOnlineLink ? <TextLink label={QUEUE_COPY.seeWhosOn} onPress={openOnlineNow} /> : <View />}
        <Button
          size="sm"
          variant="ghost"
          haptic="light"
          label={QUEUE_COPY.stop}
          loading={stop.isPending}
          onPress={stopQueueing}
        />
      </View>
      <InlineError message={stopError} align="right" />
    </View>
  );

  let body: ReactNode;
  if (phase === "loading") {
    body = <Skeleton height={QUEUED_SKELETON_H} />;
  } else if (phase === "error") {
    body = (
      <View style={{ gap: spacing.md }}>
        <Text style={titleStyle}>{QUEUE_COPY.titleQueued}</Text>
        <Text style={captionMuted}>{QUEUE_COPY.loadFailed}</Text>
        <Button variant="ghost" label={QUEUE_COPY.tryAgain} onPress={() => void status.refetch()} />
      </View>
    );
  } else if (phase === "profile" && queueState.kind === "queued") {
    const until = formatTime(queueState.untilMs, false);
    body = (
      <View style={{ gap: spacing.md }}>
        <Text style={titleStyle}>{QUEUE_COPY.titleQueued}</Text>
        {until ? <Text style={captionMuted}>{untilLine(until)}</Text> : null}
        <Text style={[type.body, { color: colors.text }]}>{QUEUE_COPY.queuedFree}</Text>
        {footer}
      </View>
    );
  } else if (view.kind === "locked") {
    body = (
      <View style={{ gap: spacing.md }}>
        <Text style={titleStyle}>{QUEUE_COPY.titleLocked}</Text>
        <Text style={[type.body, { color: colors.text }]}>{lockedLine(view.partnerName)}</Text>
        <Button
          label={QUEUE_COPY.sendMessage}
          onPress={() => {
            onClose();
            router.push({ pathname: "/chat/[matchId]", params: { matchId: view.matchId } });
          }}
        />
        {footer}
      </View>
    );
  } else if (view.kind === "queued" && row) {
    const until = formatTime(row.looking_until, false);
    const needsPermission = permission !== undefined && permission.status !== "granted";
    body = (
      <View style={{ gap: spacing.md }}>
        <Text style={titleStyle}>{QUEUE_COPY.titleQueued}</Text>
        <View style={{ gap: spacing.xs }}>
          {row.game_name ? <Text style={[type.bodyStrong, { color: colors.text }]}>{row.game_name}</Text> : null}
          {until ? <Text style={captionMuted}>{untilLine(until)}</Text> : null}
        </View>
        <Text style={[type.body, { color: colors.text }]}>
          {outcomeLine(view.outcome, { notified: view.notified, gameName: row.game_name, minutesLeft: view.minutesLeft })}
        </Text>
        {view.canShare && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label={QUEUE_COPY.share} onPress={() => void sharePost()} />
            </View>
            <Button
              size="sm"
              variant="ghost"
              label={copied ? QUEUE_COPY.copied : QUEUE_COPY.copy}
              onPress={() => void copyPost()}
            />
          </View>
        )}
        <Card style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md }}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.voltDim} />
          <Text style={[type.caption, { color: colors.textMuted, flex: 1 }]}>{QUEUE_COPY.adultsOnly}</Text>
        </Card>
        {needsPermission && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={[type.caption, { color: colors.textMuted, flex: 1 }]}>{QUEUE_COPY.permissionPrompt}</Text>
            <Button size="sm" label={QUEUE_COPY.turnOn} loading={asking} onPress={() => void turnOnNotifications()} />
          </View>
        )}
        {footer}
      </View>
    );
  } else {
    body = (
      <View style={{ gap: spacing.md }}>
        <Text style={titleStyle}>{QUEUE_COPY.titleIdle}</Text>
        {details.isPending ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton width={60} height={12} />
            <Skeleton width="70%" height={28} />
          </View>
        ) : details.isError && !details.data ? (
          // The read failed (offline, after its retries): say so, never "Add a game" to a player
          // who has games. With no game chosen, Queue up below stays off.
          <View style={{ gap: spacing.sm, alignItems: "flex-start" }}>
            <Text style={captionMuted}>{QUEUE_COPY.gamesLoadFailed}</Text>
            <Button
              size="sm"
              variant="ghost"
              label={QUEUE_COPY.tryAgain}
              loading={details.isFetching}
              onPress={() => void details.refetch()}
            />
          </View>
        ) : games.length === 0 ? (
          <View style={{ gap: spacing.sm, alignItems: "flex-start" }}>
            <Text style={captionMuted}>{QUEUE_COPY.noGames}</Text>
            <Button
              size="sm"
              variant="ghost"
              label={QUEUE_COPY.editDetails}
              onPress={() => {
                onClose();
                router.push("/edit-details");
              }}
            />
          </View>
        ) : (
          <View>
            <SectionLabel>{QUEUE_COPY.gameSection}</SectionLabel>
            <ChipSelect
              options={games.map((g) => ({ value: g.gameId, label: g.name }))}
              selected={gameId ? [gameId] : []}
              onToggle={setChosenGameId}
            />
          </View>
        )}
        {inNa ? (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <ToggleRow label={QUEUE_COPY.pingLabel} hint={QUEUE_COPY.pingHint} value={ping} onValueChange={setPing} />
          </Card>
        ) : (
          <Text style={captionMuted}>{QUEUE_COPY.outsideNa}</Text>
        )}
        <Text style={captionMuted}>{QUEUE_COPY.matchesSeeYou}</Text>
        <Button
          label={QUEUE_COPY.queueUp}
          haptic="medium"
          loading={start.isPending}
          disabled={!gameId}
          onPress={queueUp}
        />
        <InlineError message={startError} />
        {/* The deck's old "Online" link is this pill now, so the list stays one tap away even
            before queueing (as in the mockup's setup sheet). */}
        {showOnlineLink && (
          <View style={{ alignItems: "center" }}>
            <TextLink label={QUEUE_COPY.seeWhosOn} onPress={openOnlineNow} />
          </View>
        )}
      </View>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Animated.View layout={layoutTransition()}>
        <Animated.View key={phase} entering={revealEntering()} exiting={quickExiting()}>
          {body}
        </Animated.View>
      </Animated.View>
    </Sheet>
  );
}

/**
 * The deck's sheet, opened from the header pill and the empty deck through the store. Closed
 * whenever the deck loses focus (a tab switch, a pushed screen), so it is never found open over
 * a deck the player left (the SwipeCard pattern).
 */
export function DeckQueueUpSheet() {
  const visible = useQueueUpSheetStore((s) => s.visible);
  const close = useQueueUpSheetStore((s) => s.close);
  useFocusEffect(useCallback(() => () => useQueueUpSheetStore.getState().close(), []));
  return <QueueUpSheet visible={visible} onClose={close} />;
}
