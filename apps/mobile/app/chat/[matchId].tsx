import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { router, Stack, useLocalSearchParams } from "expo-router";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MATCH_FEEDBACK_TAGS, type MatchFeedbackTag, type ReportReason } from "@duoqueue/shared-types";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { Button, ButtonRow } from "@/components/Button";
import { Card } from "@/components/Card";
import { ChipSelect } from "@/components/ChipSelect";
import { EmptyState } from "@/components/EmptyState";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Name } from "@/components/Name";
import { ReportModal } from "@/components/ReportModal";
import { SectionLabel } from "@/components/SectionLabel";
import { Sheet } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { useChatMessages } from "@/features/chat/useChatMessages";
import { useDiscordShare, useSharedDiscordUsername } from "@/features/chat/useDiscordShare";
import { useBlockUser, useReportUser, useUnmatch } from "@/features/chat/useMatchActions";
import { useMatches } from "@/features/chat/useMatches";
import { useSendMessage, ConversationLockedError } from "@/features/chat/useSendMessage";
import { useTypingIndicator } from "@/features/chat/useTypingIndicator";
import type { ChatTimelineItem } from "@/features/chat/types";
import { useActiveMatchSession, useCancelSession, useProposeSession, useRespondSession } from "@/features/chat/useMatchSessions";
import { MATCH_FEEDBACK_LABELS } from "@/features/onboarding/profile-labels";
import { useCreateParty } from "@/features/party/useParty";
import { useSubmitMatchFeedback } from "@/features/reputation/useReputation";
import { containsHiddenWord, useHiddenWords } from "@/features/settings/useHiddenWords";
import { hapticLight } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

const SESSION_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function getSessionPresets(): { label: string; date: Date }[] {
  const now = new Date();
  function atHour(daysFromNow: number, hour: number): Date {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  const presets: { label: string; date: Date }[] = [];
  const tonight = atHour(0, 20);
  if (tonight.getTime() > now.getTime() + 30 * 60 * 1000) {
    presets.push({ label: "Tonight, 8pm", date: tonight });
  }
  presets.push({ label: "Tomorrow, 6pm", date: atHour(1, 18) });
  presets.push({ label: "Tomorrow, 8pm", date: atHour(1, 20) });
  const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
  presets.push({ label: "Saturday, 7pm", date: atHour(daysUntilSaturday, 19) });
  return presets;
}

/**
 * One tappable row: icon + label. Shared by the schedule presets and the overflow
 * sheet's grouped actions — a flat list item, not a `Button` (a full-width pill would
 * be too heavy repeated this many times in one sheet) and not `NavRow` (its trailing
 * chevron implies a destination screen; these are one-shot actions, not navigation).
 */
function ActionRow({
  icon,
  label,
  onPress,
  danger,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors, spacing, type } = useTheme();
  const tint = danger ? colors.danger : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm + 2,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.textMuted} />
      <Text style={[type.body, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

function ScheduleModal({
  visible,
  onClose,
  matchId,
}: {
  visible: boolean;
  onClose: () => void;
  matchId: string;
}) {
  const { spacing } = useTheme();
  const propose = useProposeSession(matchId);

  async function handlePick(date: Date) {
    try {
      await propose.mutateAsync(date);
      onClose();
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Propose a time to play">
      <View style={{ gap: spacing.xs }}>
        {getSessionPresets().map((preset) => (
          <ActionRow
            key={preset.label}
            icon="time-outline"
            label={preset.label}
            onPress={() => void handlePick(preset.date)}
            disabled={propose.isPending}
          />
        ))}
      </View>
    </Sheet>
  );
}

function SessionBanner({ matchId, myId }: { matchId: string; myId: string | undefined }) {
  const { colors, spacing, type } = useTheme();
  const { data: session } = useActiveMatchSession(matchId);
  const respond = useRespondSession(matchId);
  const cancel = useCancelSession(matchId);

  if (!session) return null;

  const isProposer = session.proposed_by === myId;
  const label = SESSION_TIME_FORMAT.format(new Date(session.scheduled_at));

  return (
    <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }}>
      <Card style={{ flexDirection: "row", padding: 0, overflow: "hidden" }}>
        {/* The volt left edge is its own inner view, not a border on the card —
            keeps the glow-free "colored stripe" look consistent with other rails. */}
        <View style={{ width: 2, backgroundColor: colors.volt }} />
        <View style={{ flex: 1, padding: spacing.md, gap: spacing.sm }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>
            {session.status === "confirmed" ? "Playing " : "Proposed: "}
            {label}
          </Text>
          {session.status === "pending" && !isProposer && (
            <ButtonRow>
              <Button
                variant="ghost"
                label="Confirm"
                onPress={() => respond.mutate({ sessionId: session.id, accept: true })}
              />
              <Button
                variant="ghost"
                label="Decline"
                onPress={() => respond.mutate({ sessionId: session.id, accept: false })}
              />
            </ButtonRow>
          )}
          {(session.status === "confirmed" || isProposer) && (
            <Button variant="ghost" label="Cancel" onPress={() => cancel.mutate(session.id)} />
          )}
        </View>
      </Card>
    </View>
  );
}

function FeedbackModal({
  visible,
  onClose,
  matchId,
  otherName,
}: {
  visible: boolean;
  onClose: () => void;
  matchId: string;
  otherName: string;
}) {
  const { colors, spacing, type } = useTheme();
  const [selected, setSelected] = useState<MatchFeedbackTag[]>([]);
  const submit = useSubmitMatchFeedback(matchId);

  function toggle(tag: MatchFeedbackTag) {
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit() {
    try {
      await submit.mutateAsync(selected);
      setSelected([]);
      onClose();
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    // Carries a selection the user built up — a mis-tap on the scrim shouldn't
    // throw it away, so this is the one sheet that opts out of tap-to-dismiss
    // (matches ReportModal). It still needs its own way out — the Cancel button.
    <Sheet visible={visible} onClose={onClose} title={`How was playing with ${otherName}?`} dismissable={false}>
      <View style={{ gap: spacing.md }}>
        <Text style={[type.caption, { color: colors.textMuted }]}>
          Optional and private to how it shapes their reputation — pick anything that applies.
        </Text>
        <ChipSelect
          options={MATCH_FEEDBACK_TAGS.map((value) => ({ value, label: MATCH_FEEDBACK_LABELS[value] }))}
          selected={selected}
          onToggle={toggle}
        />
        <Button
          label="Submit"
          onPress={() => void handleSubmit()}
          disabled={selected.length === 0}
          loading={submit.isPending}
        />
        <Button label="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}

function MessageBubble({
  content,
  isMine,
  isSending,
  showReceipt,
  readAt,
  hiddenWords,
}: {
  content: string;
  isMine: boolean;
  isSending: boolean;
  showReceipt: boolean;
  readAt: string | null;
  hiddenWords: string[];
}) {
  const { colors, spacing, radius, type } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const isHidden = !isMine && !revealed && containsHiddenWord(content, hiddenWords);

  const bubbleShape = {
    // radius.md is the base; the tail corner tightens to 3 so the bubble still
    // points toward its sender instead of reading as a uniform rounded rect.
    borderRadius: radius.md,
    ...(isMine ? { borderBottomRightRadius: 3 } : { borderBottomLeftRadius: 3 }),
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: spacing.md - 2,
  };

  const text = (
    <Text
      style={[
        type.body,
        {
          color: isHidden ? colors.textMuted : colors.text,
          fontStyle: isHidden ? "italic" : "normal",
        },
      ]}
    >
      {isHidden ? "Message hidden — tap to reveal" : content}
    </Text>
  );

  return (
    // Opacity dips while the optimistic row is still in flight (id starts with
    // "temp-") — a perceptible "sending" lifecycle instead of a binary pop to
    // full-strength once the server row swaps in.
    <View style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "78%", opacity: isSending ? 0.75 : 1 }}>
      <Pressable disabled={!isHidden} onPress={() => setRevealed(true)}>
        {isMine ? (
          <View style={[bubbleShape, { backgroundColor: colors.bubbleOwn }]}>{text}</View>
        ) : (
          <View style={[bubbleShape, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
            {text}
          </View>
        )}
      </Pressable>
      {/* Lives below the bubble, not inside it — a one-word receipt inside a short
          bubble was inflating every own message into a near-square blob. Shown only
          on the latest own message (computed by the caller) so a whole run of "Sent"
          labels doesn't repeat down the screen. */}
      {isMine && showReceipt && (
        <Text style={[type.tick, { color: colors.voltDim, textAlign: "right", marginTop: 2 }]}>
          {readAt ? "Read" : isSending ? "Sending…" : "Sent"}
        </Text>
      )}
    </View>
  );
}

function DiscordShareBubble({
  matchId,
  sharedBy,
  isMine,
}: {
  matchId: string;
  sharedBy: string;
  isMine: boolean;
}) {
  const { colors, radius, spacing, type } = useTheme();
  const myDiscordUsername = useSessionStore((s) => s.profile?.discord_username ?? null);
  const { data: revealedUsername, isLoading } = useSharedDiscordUsername(matchId, sharedBy, !isMine);
  const username = isMine ? myDiscordUsername : revealedUsername;

  async function handleCopy() {
    if (!username) return;
    await Clipboard.setStringAsync(username);
  }

  return (
    <View
      style={{
        alignSelf: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.card,
        padding: spacing.md,
        gap: spacing.xs,
        maxWidth: "80%",
        marginVertical: spacing.sm,
      }}
    >
      <Text style={[type.caption, { color: colors.textMuted, textAlign: "center" }]}>
        {isMine ? "You shared your Discord" : "Shared their Discord"}
      </Text>
      {isLoading && !isMine ? (
        <Skeleton width={120} height={16} style={{ alignSelf: "center" }} />
      ) : username ? (
        <Pressable
          onPress={() => void handleCopy()}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}
        >
          <Text style={[type.bodyStrong, { color: colors.text }]}>{username}</Text>
          <Text style={[type.caption, { color: colors.voltDim }]}>Copy</Text>
        </Pressable>
      ) : (
        <Text style={[type.caption, { color: colors.textMuted, textAlign: "center" }]}>No longer available</Text>
      )}
    </View>
  );
}

export default function ChatScreen() {
  const { colors, spacing, radius, type } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const myId = useSessionStore((s) => s.session?.user.id);
  const { data: matches } = useMatches();
  const matchInfo = matches?.find((m) => m.match_id === matchId);

  const { timeline, isLoading, error, markAsRead, refetch } = useChatMessages(matchId);
  const sendMessage = useSendMessage(matchId);
  const { otherIsTyping, notifyTyping } = useTypingIndicator(matchId);
  const { data: hiddenWords } = useHiddenWords();
  const discordShare = useDiscordShare(matchId);
  const unmatch = useUnmatch();
  const blockUser = useBlockUser();
  const reportUser = useReportUser();
  const createParty = useCreateParty();

  const [draft, setDraft] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList<ChatTimelineItem>>(null);
  // Gates the entrance animation below: only rows that showed up after the screen
  // mounted spring in. History loaded on open (or refetched later) must never replay it.
  const mountedAt = useRef(Date.now()).current;

  useEffect(() => {
    void markAsRead();
  }, [timeline.length, markAsRead]);

  // Drives the composer's bottom padding below. When the keyboard is open,
  // KeyboardAvoidingView already pads the composer up by the keyboard's own height —
  // that height sits flush with the physical screen bottom, so there's no home-indicator
  // gap left to protect. Collapsing to a plain spacing.md here (instead of stacking
  // insets.bottom on top) keeps the raised-off-the-edge look without doubling the gap
  // once the keyboard covers that edge itself. "will" events match what
  // KeyboardAvoidingView itself listens for on iOS, so this flips in the same frame it does.
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // `timeline` is chronological (oldest first) from the hook. The list below renders
  // it `inverted` (standard chat pattern — anchors to the bottom, keeps scroll-to-latest
  // free), which needs the data reversed to newest-first.
  const reversedTimeline = useMemo(() => [...timeline].reverse(), [timeline]);

  // The read receipt only ever belongs on the newest message I sent — walk from the
  // end of the chronological list once rather than recomputing per bubble.
  const latestOwnMessageId = useMemo(() => {
    for (let i = timeline.length - 1; i >= 0; i--) {
      const item = timeline[i];
      if (item?.kind === "message" && item.message.sender_id === myId) return item.message.id;
    }
    return null;
  }, [timeline, myId]);

  const hasSharedDiscord = timeline.some(
    (item) => item.kind === "discord_share" && item.share.shared_by === myId && !item.share.revoked,
  );

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    // Fired right as the optimistic row goes out (mutateAsync triggers onMutate's
    // cache append synchronously) — a tap you can feel, not just see.
    hapticLight();
    try {
      await sendMessage.mutateAsync(content);
    } catch (err) {
      if (err instanceof ConversationLockedError) {
        Alert.alert("Conversation locked", err.message, [
          { text: "Not now" },
          { text: "Upgrade", onPress: () => router.push("/paywall") },
        ]);
      } else {
        Alert.alert("Message not sent", err instanceof Error ? err.message : "Please try again.");
        setDraft(content);
      }
    }
  }

  function handleShareDiscord() {
    setMenuVisible(false);
    if (hasSharedDiscord) return;
    discordShare.mutate();
  }

  async function handleInviteThird() {
    setMenuVisible(false);
    try {
      const partyId = await createParty.mutateAsync(matchId);
      router.push({ pathname: "/party/[partyId]", params: { partyId } });
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function handlePlayNow() {
    setMenuVisible(false);
    try {
      await sendMessage.mutateAsync("🎮 I'm free to play right now!");
    } catch (err) {
      if (err instanceof ConversationLockedError) {
        Alert.alert("Conversation locked", err.message, [
          { text: "Not now" },
          { text: "Upgrade", onPress: () => router.push("/paywall") },
        ]);
      } else {
        Alert.alert("Couldn't send ping", err instanceof Error ? err.message : "Please try again.");
      }
    }
  }

  function handleUnmatch() {
    setMenuVisible(false);
    Alert.alert("Unmatch?", "This removes the conversation for both of you.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unmatch",
        style: "destructive",
        onPress: () => unmatch.mutate(matchId, { onSuccess: () => router.back() }),
      },
    ]);
  }

  function handleBlock() {
    setMenuVisible(false);
    if (!matchInfo) return;
    Alert.alert("Block this user?", "They will be removed from your matches and deck.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: () => blockUser.mutate(matchInfo.other_profile_id, { onSuccess: () => router.back() }),
      },
    ]);
  }

  function handleReportSubmit(reason: ReportReason, details: string) {
    if (!matchInfo) return;
    reportUser.mutate(
      { reportedId: matchInfo.other_profile_id, matchId, reason, details },
      {
        onSuccess: () => {
          setReportVisible(false);
          Alert.alert("Report submitted", "Thanks — our team will review this.");
        },
        onError: () => Alert.alert("Something went wrong", "Please try again."),
      },
    );
  }

  const canSend = !sendMessage.isPending && !!draft.trim();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GraticuleBackground />
      <GrainOverlay />

      <Stack.Screen
        options={{
          title: matchInfo?.other_display_name ?? "Chat",
          // Without this iOS labels the back button with the previous route's name,
          // which here is the literal route group "(tabs)".
          headerBackTitle: "Matches",
          headerTintColor: colors.voltDim,
          headerStyle: { backgroundColor: colors.surfaceSolid },
          headerShadowVisible: false,
          // The name itself is the way into their profile — smallest change that
          // keeps the native header chrome but makes the title tappable.
          headerTitle: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View profile"
              disabled={!matchInfo}
              onPress={() => matchInfo && router.push(`/profile/${matchInfo.other_profile_id}`)}
              hitSlop={8}
            >
              <Name variant="title" style={{ color: colors.text }} numberOfLines={1}>
                {matchInfo?.other_display_name ?? "Chat"}
              </Name>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={() => setMenuVisible(true)} hitSlop={12} accessibilityLabel="Chat options">
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.voltDim} />
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <Skeleton width="60%" height={36} borderRadius={radius.md} style={{ alignSelf: "flex-start" }} />
          <Skeleton width="45%" height={36} borderRadius={radius.md} style={{ alignSelf: "flex-end" }} />
          <Skeleton width="70%" height={36} borderRadius={radius.md} style={{ alignSelf: "flex-start" }} />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline"
          title="Couldn't load this conversation"
          subtitle="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void refetch()}
          tick="OFFLINE"
        />
      ) : (
        <FlatList
          ref={listRef}
          data={reversedTimeline}
          // Only invert once there's something to show — an inverted empty list flips
          // `ListEmptyComponent` upside down too, since it isn't wrapped in the cell
          // renderer that cancels the list's own flip for real rows.
          inverted={reversedTimeline.length > 0}
          keyExtractor={(item) => (item.kind === "message" ? item.message.id : item.share.id)}
          contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles"
              title={`Say hi to ${matchInfo?.other_display_name ?? "your match"}!`}
              subtitle="You matched — break the ice with a message about a game you both play."
              tick="SAY HI"
            />
          }
          renderItem={({ item, index }: { item: ChatTimelineItem; index: number }) => {
            if (item.kind === "discord_share") {
              if (item.share.revoked) return null;
              return <DiscordShareBubble matchId={matchId} sharedBy={item.share.shared_by} isMine={item.share.shared_by === myId} />;
            }
            const isMine = item.message.sender_id === myId;
            // `reversedTimeline` is newest-first, so the chronologically-previous
            // message (the one rendered just above this one, since the list is
            // inverted) sits at index + 1. Same sender back-to-back → tighten the
            // gap into a "run"; anything else (including the very first item) gets
            // the normal run-separating gap.
            const previous = reversedTimeline[index + 1];
            const isRunContinuation = previous?.kind === "message" && previous.message.sender_id === item.message.sender_id;
            // A discord_share bubble carries its own marginVertical (spacing.sm top AND
            // bottom). If the message right below it (chronologically after, rendered
            // below on screen) ALSO applied the normal spacing.sm marginTop, the gap
            // below the bubble would be 2x spacing.sm while the gap above it stays 1x.
            // Zero this message's own marginTop so the share bubble's bottom margin is
            // the only contributor — symmetric spacing.sm on both sides of the bubble.
            const followsDiscordShare = previous?.kind === "discord_share";
            const marginTop = index === reversedTimeline.length - 1 ? 0 : followsDiscordShare ? 0 : isRunContinuation ? 3 : spacing.sm;
            // Entrance animation is gated so it only plays for rows that showed up
            // after this screen mounted — never for history loaded on open or pulled
            // in by a refetch.
            //   - Own sends: gate on the temp- id prefix, not created_at. The
            //     optimistic row and its server replacement carry different ids, so
            //     keyExtractor treats the swap as an unmount/remount of this cell —
            //     without this the real row would replay the animation a second time
            //     right after the temp row already played it once.
            //   - Incoming rows (from the other person): they only ever arrive once,
            //     as their real id, so created_at > mountedAt is sufficient.
            const isSending = isMine && item.message.id.startsWith("temp-");
            const isNewIncoming = !isMine && new Date(item.message.created_at).getTime() > mountedAt;
            const isNew = isSending || isNewIncoming;
            return (
              <Animated.View
                style={{ marginTop }}
                entering={isNew ? FadeInUp.springify().damping(16).stiffness(180) : undefined}
              >
                <MessageBubble
                  content={item.message.content}
                  isMine={isMine}
                  isSending={isSending}
                  showReceipt={isMine && item.message.id === latestOwnMessageId}
                  readAt={item.message.read_at}
                  hiddenWords={hiddenWords ?? []}
                />
              </Animated.View>
            );
          }}
        />
      )}

      {otherIsTyping && (
        <Text style={[type.caption, { color: colors.textMuted, paddingHorizontal: spacing.md }]}>
          {matchInfo?.other_display_name ?? "They"} are typing…
        </Text>
      )}

      <SessionBanner matchId={matchId} myId={myId} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        {matchInfo?.is_locked ? (
          <View style={{ padding: spacing.md, borderTopWidth: 1, borderColor: colors.border }}>
            <View
              style={{
                backgroundColor: colors.surfaceSolid,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: colors.amber,
                padding: spacing.md,
                gap: spacing.sm,
                alignItems: "center",
              }}
            >
              <Text style={[type.caption, { color: colors.textMuted, textAlign: "center" }]}>
                This conversation is locked — upgrade for unlimited active conversations, or unmatch an
                older conversation to free up a slot.
              </Text>
              <Button variant="premium" label="Get DuoQueue+" onPress={() => router.push("/paywall")} />
            </View>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              // Floated off the home-indicator edge when idle; collapses to just
              // breathing room once the keyboard is up and already owns that space
              // (see the keyboardVisible effect above for why).
              paddingBottom: keyboardVisible ? spacing.md : insets.bottom + spacing.md,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                notifyTyping();
              }}
              placeholder="Message..."
              placeholderTextColor={colors.textMuted}
              style={[
                type.body,
                {
                  flex: 1,
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.input,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  color: colors.text,
                },
              ]}
              multiline
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => void handleSend()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              onPress={() => void handleSend()}
              disabled={!canSend}
              style={({ pressed }) => [
                {
                  width: 40,
                  height: 40,
                  borderRadius: radius.round,
                  backgroundColor: colors.volt,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: canSend ? 1 : 0.45,
                },
                { transform: [{ scale: pressed ? 0.94 : 1 }] },
              ]}
            >
              <Ionicons name="arrow-up" size={20} color={colors.onVolt} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <Sheet visible={menuVisible} onClose={() => setMenuVisible(false)}>
        <View style={{ gap: spacing.xs }}>
          <SectionLabel>Play together</SectionLabel>
          <ActionRow icon="flash" label="Ping I'm free now" onPress={() => void handlePlayNow()} />
          <ActionRow icon="people" label="Invite a third" onPress={() => void handleInviteThird()} />
          <ActionRow
            icon="calendar"
            label="Schedule a session"
            onPress={() => {
              setMenuVisible(false);
              setScheduleVisible(true);
            }}
          />
          <ActionRow
            icon="logo-discord"
            label={hasSharedDiscord ? "Discord already shared" : "Share my Discord"}
            onPress={handleShareDiscord}
            disabled={hasSharedDiscord}
          />
        </View>

        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          <SectionLabel>After the session</SectionLabel>
          <ActionRow
            icon="star"
            label="Rate this session"
            onPress={() => {
              setMenuVisible(false);
              setFeedbackVisible(true);
            }}
          />
        </View>

        <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
          <SectionLabel>Safety</SectionLabel>
          <ActionRow
            icon="flag"
            label="Report"
            danger
            onPress={() => {
              setMenuVisible(false);
              setReportVisible(true);
            }}
          />
          <ActionRow icon="ban" label="Block" danger onPress={handleBlock} />
          <ActionRow icon="close-circle" label="Unmatch" danger onPress={handleUnmatch} />
        </View>
      </Sheet>

      <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} onSubmit={handleReportSubmit} />
      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        matchId={matchId}
        otherName={matchInfo?.other_display_name ?? "them"}
      />
      <ScheduleModal visible={scheduleVisible} onClose={() => setScheduleVisible(false)} matchId={matchId} />
    </View>
  );
}
