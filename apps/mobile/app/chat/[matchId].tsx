import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { REPORT_REASONS, type ReportReason } from "@duoqueue/shared-types";

import { ChipSelect } from "@/components/ChipSelect";
import { useChatMessages } from "@/features/chat/useChatMessages";
import { useDiscordShare, useSharedDiscordUsername } from "@/features/chat/useDiscordShare";
import { useBlockUser, useReportUser, useUnmatch } from "@/features/chat/useMatchActions";
import { useMatches } from "@/features/chat/useMatches";
import { useSendMessage, ConversationLockedError } from "@/features/chat/useSendMessage";
import { useTypingIndicator } from "@/features/chat/useTypingIndicator";
import type { ChatTimelineItem } from "@/features/chat/types";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment",
  spam: "Spam",
  inappropriate_content: "Inappropriate content",
  underage: "Underage",
  other: "Other",
};

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
        <ActivityIndicator size="small" color={colors.brand} />
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

function ReportModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => void;
}) {
  const { colors, spacing } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View style={{ backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Report this user</Text>
          <ChipSelect
            options={REPORT_REASONS.map((value) => ({ value, label: REPORT_REASON_LABELS[value] }))}
            selected={reason ? [reason] : []}
            onToggle={setReason}
          />
          <TextInput
            placeholder="Additional details (optional)"
            placeholderTextColor={colors.textMuted}
            value={details}
            onChangeText={setDetails}
            multiline
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: spacing.sm,
              color: colors.text,
              minHeight: 80,
            }}
          />
          <Pressable
            disabled={!reason}
            onPress={() => reason && onSubmit(reason, details)}
            style={{ backgroundColor: colors.danger, opacity: reason ? 1 : 0.5, padding: spacing.md, borderRadius: 12, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Submit report</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ padding: spacing.sm, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ChatScreen() {
  const { colors, spacing } = useTheme();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const myId = useSessionStore((s) => s.session?.user.id);
  const { data: matches } = useMatches();
  const matchInfo = matches?.find((m) => m.match_id === matchId);

  const { timeline, isLoading, markAsRead } = useChatMessages(matchId);
  const sendMessage = useSendMessage(matchId);
  const { otherIsTyping, notifyTyping } = useTypingIndicator(matchId);
  const discordShare = useDiscordShare(matchId);
  const unmatch = useUnmatch();
  const blockUser = useBlockUser();
  const reportUser = useReportUser();

  const [draft, setDraft] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
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
          headerRight: () => (
            <Pressable onPress={() => setMenuVisible(true)} hitSlop={12}>
              <Text style={{ color: colors.brand, fontSize: 20, fontWeight: "700" }}>•••</Text>
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={timeline}
          keyExtractor={(item) => (item.kind === "message" ? item.message.id : item.share.id)}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }: { item: ChatTimelineItem }) => {
            if (item.kind === "discord_share") {
              if (item.share.revoked) return null;
              return <DiscordShareBubble matchId={matchId} sharedBy={item.share.shared_by} isMine={item.share.shared_by === myId} />;
            }
            const isMine = item.message.sender_id === myId;
            return (
              <View
                style={{
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  backgroundColor: isMine ? colors.brand : colors.surface,
                  borderRadius: 16,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  maxWidth: "80%",
                }}
              >
                <Text style={{ color: isMine ? "#fff" : colors.text }}>{item.message.content}</Text>
                {isMine && (
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, textAlign: "right", marginTop: 2 }}>
                    {item.message.read_at ? "Read" : "Sent"}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}

      {otherIsTyping && (
        <Text style={{ color: colors.textMuted, paddingHorizontal: spacing.md, fontSize: 12 }}>
          {matchInfo?.other_display_name ?? "They"} are typing…
        </Text>
      )}

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
            <Pressable onPress={handleShareDiscord} disabled={hasSharedDiscord} style={{ padding: spacing.sm }}>
              <Text style={{ color: hasSharedDiscord ? colors.textMuted : colors.brand, fontWeight: "600" }}>
                {hasSharedDiscord ? "Discord already shared" : "Share my Discord"}
              </Text>
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
    </View>
  );
}
