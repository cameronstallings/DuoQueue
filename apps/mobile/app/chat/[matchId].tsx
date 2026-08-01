import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { MATCH_FEEDBACK_TAGS, type MatchFeedbackTag, type ReportReason } from "@duoqueue/shared-types";

import { ChipSelect } from "@/components/ChipSelect";
import { ReportModal } from "@/components/ReportModal";
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

function ScheduleModal({
  visible,
  onClose,
  matchId,
}: {
  visible: boolean;
  onClose: () => void;
  matchId: string;
}) {
  const { colors, spacing, type } = useTheme();
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable
          style={{
            backgroundColor: colors.background,
            padding: spacing.lg,
            gap: spacing.sm,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          <Text style={{ ...type.title, color: colors.text }}>Propose a time to play</Text>
          {getSessionPresets().map((preset) => (
            <Pressable
              key={preset.label}
              onPress={() => void handlePick(preset.date)}
              disabled={propose.isPending}
              style={{ paddingVertical: spacing.sm }}
            >
              <Text style={{ color: colors.brand, fontWeight: "600", fontSize: 16 }}>{preset.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SessionBanner({ matchId, myId }: { matchId: string; myId: string | undefined }) {
  const { colors, radius, spacing } = useTheme();
  const { data: session } = useActiveMatchSession(matchId);
  const respond = useRespondSession(matchId);
  const cancel = useCancelSession(matchId);

  if (!session) return null;

  const isProposer = session.proposed_by === myId;
  const label = SESSION_TIME_FORMAT.format(new Date(session.scheduled_at));

  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        backgroundColor: colors.brandSoft,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "700" }}>
        {session.status === "confirmed" ? "Playing " : "Proposed: "}
        {label}
      </Text>
      {session.status === "pending" && !isProposer && (
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Pressable onPress={() => respond.mutate({ sessionId: session.id, accept: true })}>
            <Text style={{ color: colors.brand, fontWeight: "700" }}>Confirm</Text>
          </Pressable>
          <Pressable onPress={() => respond.mutate({ sessionId: session.id, accept: false })}>
            <Text style={{ color: colors.textMuted, fontWeight: "700" }}>Decline</Text>
          </Pressable>
        </View>
      )}
      {(session.status === "confirmed" || isProposer) && (
        <Pressable onPress={() => cancel.mutate(session.id)}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Cancel</Text>
        </Pressable>
      )}
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable
          style={{
            backgroundColor: colors.background,
            padding: spacing.lg,
            gap: spacing.md,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          <Text style={{ ...type.title, color: colors.text }}>How was playing with {otherName}?</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            Optional and private to how it shapes their reputation — pick anything that applies.
          </Text>
          <ChipSelect
            options={MATCH_FEEDBACK_TAGS.map((value) => ({ value, label: MATCH_FEEDBACK_LABELS[value] }))}
            selected={selected}
            onToggle={toggle}
          />
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={submit.isPending || selected.length === 0}
            style={{
              backgroundColor: colors.brand,
              opacity: submit.isPending || selected.length === 0 ? 0.5 : 1,
              borderRadius: 20,
              paddingVertical: spacing.sm,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Submit</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MessageBubble({
  content,
  isMine,
  readAt,
  hiddenWords,
}: {
  content: string;
  isMine: boolean;
  readAt: string | null;
  hiddenWords: string[];
}) {
  const { colors, spacing } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const isHidden = !isMine && !revealed && containsHiddenWord(content, hiddenWords);

  return (
    <Pressable
      disabled={!isHidden}
      onPress={() => setRevealed(true)}
      style={{
        alignSelf: isMine ? "flex-end" : "flex-start",
        backgroundColor: isMine ? colors.brand : colors.surface,
        borderRadius: 16,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        maxWidth: "80%",
      }}
    >
      <Text style={{ color: isMine ? "#fff" : isHidden ? colors.textMuted : colors.text, fontStyle: isHidden ? "italic" : "normal" }}>
        {isHidden ? "Message hidden — tap to reveal" : content}
      </Text>
      {isMine && (
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, textAlign: "right", marginTop: 2 }}>
          {readAt ? "Read" : "Sent"}
        </Text>
      )}
    </Pressable>
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
  const { colors, radius, spacing } = useTheme();
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
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.xs,
        maxWidth: "80%",
        marginVertical: spacing.sm,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
        {isMine ? "You shared your Discord" : "Shared their Discord"}
      </Text>
      {isLoading && !isMine ? (
        <Skeleton width={120} height={16} style={{ alignSelf: "center" }} />
      ) : username ? (
        <Pressable
          onPress={() => void handleCopy()}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}
        >
          <Text style={{ fontWeight: "700", color: colors.text }}>{username}</Text>
          <Text style={{ color: colors.brand, fontSize: 12, fontWeight: "600" }}>Copy</Text>
        </Pressable>
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>No longer available</Text>
      )}
    </View>
  );
}

export default function ChatScreen() {
  const { colors, spacing, type } = useTheme();
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
  const listRef = useRef<FlatList<ChatTimelineItem>>(null);

  useEffect(() => {
    void markAsRead();
  }, [timeline.length, markAsRead]);

  const hasSharedDiscord = timeline.some(
    (item) => item.kind === "discord_share" && item.share.shared_by === myId && !item.share.revoked,
  );

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: matchInfo?.other_display_name ?? "Chat",
          // Without this iOS labels the back button with the previous route's name,
          // which here is the literal route group "(tabs)".
          headerBackTitle: "Matches",
          headerTintColor: colors.brandInk,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { ...type.title, color: colors.text },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable onPress={() => setMenuVisible(true)} hitSlop={12} accessibilityLabel="Chat options">
              <Text style={{ color: colors.brandInk, fontSize: 20 }}>•••</Text>
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <Skeleton width="60%" height={36} borderRadius={16} style={{ alignSelf: "flex-start" }} />
          <Skeleton width="45%" height={36} borderRadius={16} style={{ alignSelf: "flex-end" }} />
          <Skeleton width="70%" height={36} borderRadius={16} style={{ alignSelf: "flex-start" }} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: "600" }}>Couldn&apos;t load this conversation</Text>
          <Pressable onPress={() => void refetch()}>
            <Text style={{ color: colors.brand, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={timeline}
          keyExtractor={(item) => (item.kind === "message" ? item.message.id : item.share.id)}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs }}>
              <Text style={{ fontWeight: "600", color: colors.text }}>
                Say hi to {matchInfo?.other_display_name ?? "your match"}!
              </Text>
              <Text style={{ color: colors.textMuted, textAlign: "center" }}>
                You matched — break the ice with a message about a game you both play.
              </Text>
            </View>
          }
          renderItem={({ item }: { item: ChatTimelineItem }) => {
            if (item.kind === "discord_share") {
              if (item.share.revoked) return null;
              return <DiscordShareBubble matchId={matchId} sharedBy={item.share.shared_by} isMine={item.share.shared_by === myId} />;
            }
            const isMine = item.message.sender_id === myId;
            return (
              <MessageBubble
                content={item.message.content}
                isMine={isMine}
                readAt={item.message.read_at}
                hiddenWords={hiddenWords ?? []}
              />
            );
          }}
        />
      )}

      {otherIsTyping && (
        <Text style={{ color: colors.textMuted, paddingHorizontal: spacing.md, fontSize: 12 }}>
          {matchInfo?.other_display_name ?? "They"} are typing…
        </Text>
      )}

      <SessionBanner matchId={matchId} myId={myId} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {matchInfo?.is_locked ? (
          <View style={{ padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textMuted, textAlign: "center" }}>
              This conversation is locked. Upgrade to DuoQueue+ for unlimited active conversations, or
              unmatch an older one to free up a slot.
            </Text>
            <Pressable onPress={() => router.push("/paywall")} style={{ alignItems: "center" }}>
              <Text style={{ color: colors.brand, fontWeight: "700" }}>Upgrade to DuoQueue+</Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              padding: spacing.md,
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
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 20,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                color: colors.text,
              }}
              multiline
            />
            <Pressable
              onPress={() => void handleSend()}
              disabled={sendMessage.isPending || !draft.trim()}
              style={{
                backgroundColor: colors.brand,
                opacity: sendMessage.isPending || !draft.trim() ? 0.5 : 1,
                borderRadius: 20,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={menuVisible} animationType="fade" transparent onRequestClose={() => setMenuVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }}
          onPress={() => setMenuVisible(false)}
        >
          <View style={{ backgroundColor: colors.background, padding: spacing.lg, gap: spacing.sm, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <Pressable onPress={() => void handlePlayNow()} style={{ padding: spacing.sm }}>
              <Text style={{ color: colors.brand, fontWeight: "600" }}>Ping: I&apos;m free to play now</Text>
            </Pressable>
            <Pressable onPress={() => void handleInviteThird()} style={{ padding: spacing.sm }}>
              <Text style={{ color: colors.brand, fontWeight: "600" }}>Invite a third to duo</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuVisible(false);
                setScheduleVisible(true);
              }}
              style={{ padding: spacing.sm }}
            >
              <Text style={{ color: colors.brand, fontWeight: "600" }}>Schedule a session</Text>
            </Pressable>
            <Pressable onPress={handleShareDiscord} disabled={hasSharedDiscord} style={{ padding: spacing.sm }}>
              <Text style={{ color: hasSharedDiscord ? colors.textMuted : colors.brand, fontWeight: "600" }}>
                {hasSharedDiscord ? "Discord already shared" : "Share my Discord"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuVisible(false);
                setFeedbackVisible(true);
              }}
              style={{ padding: spacing.sm }}
            >
              <Text style={{ color: colors.text, fontWeight: "600" }}>Rate this session</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuVisible(false);
                setReportVisible(true);
              }}
              style={{ padding: spacing.sm }}
            >
              <Text style={{ color: colors.text, fontWeight: "600" }}>Report</Text>
            </Pressable>
            <Pressable onPress={handleBlock} style={{ padding: spacing.sm }}>
              <Text style={{ color: colors.danger, fontWeight: "600" }}>Block</Text>
            </Pressable>
            <Pressable onPress={handleUnmatch} style={{ padding: spacing.sm }}>
              <Text style={{ color: colors.danger, fontWeight: "600" }}>Unmatch</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
