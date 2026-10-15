import { useEffect, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MESSAGE_MAX_LENGTH, type ReportReason } from "@duoqueue/shared-types";

import { ChatHeader } from "@/components/ChatHeader";
import { GraticuleBackground } from "@/components/GraticuleBackground";
import { GrainOverlay } from "@/components/GrainOverlay";
import { ReportModal } from "@/components/ReportModal";
import { SectionLabel } from "@/components/SectionLabel";
import { Sheet } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { useBlockUser, useReportUser } from "@/features/chat/useMatchActions";
import { type PartyMemberProfile, partyMembersQueryKey, usePartyMembers } from "@/features/party/useParty";
import { usePartyMessages, useSendPartyMessage } from "@/features/party/usePartyMessages";
import { containsHiddenWord, useHiddenWords } from "@/features/settings/useHiddenWords";
import { useRequireSession } from "@/hooks/useRequireSession";
import { useSheetHandoff } from "@/hooks/useSheetHandoff";
import { hapticError } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

/**
 * One tappable row: icon + label. Mirrors chat/[matchId].tsx's overflow-sheet rows —
 * party chat needed the same Report/Block affordance the 1:1 thread already had, just
 * scoped per-member since a party can hold more than one other person.
 */
function ActionRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors, spacing, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm + 2,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.textMuted} />
      <Text style={[type.body, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function MessageBubble({
  content,
  isMine,
  senderName,
  hiddenWords,
}: {
  content: string;
  isMine: boolean;
  senderName: string;
  hiddenWords: string[];
}) {
  const { colors, radius, spacing, type } = useTheme();
  // Mirrors the 1:1 chat's per-device hidden-word filter (chat/[matchId].tsx) — party
  // chat had no equivalent, so a masked word there stayed unmasked here even though
  // it's the same reader with the same hidden-word list.
  const [revealed, setRevealed] = useState(false);
  const isHidden = !isMine && !revealed && containsHiddenWord(content, hiddenWords);

  return (
    <View style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "80%", gap: 2 }}>
      {/* p2Line — this label only ever names someone other than the reader ("them");
          the reader's own messages carry no name caption, so p1Line ("you") has no
          text to attach to here. */}
      {!isMine && (
        <Text style={[type.caption, { color: colors.p2Line, marginLeft: spacing.sm }]}>{senderName}</Text>
      )}
      <Pressable disabled={!isHidden} onPress={() => setRevealed(true)}>
        <View
          style={{
            backgroundColor: isMine ? colors.bubbleOwn : colors.surface,
            borderRadius: radius.md,
            ...(isMine ? null : { borderWidth: 1, borderColor: colors.border }),
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
          }}
        >
          <Text
            style={[
              type.body,
              { color: isHidden ? colors.textMuted : colors.text, fontStyle: isHidden ? "italic" : "normal" },
            ]}
          >
            {isHidden ? "Message hidden. Tap to reveal." : content}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export default function PartyChatScreen() {
  useRequireSession();
  const { colors, radius, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  // Mirrors the 1:1 chat composer: the bar floats off the home indicator when idle
  // and collapses once the keyboard is up, since the keyboard already owns that space.
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const myId = useSessionStore((s) => s.session?.user.id);
  const { data: members } = usePartyMembers(partyId);
  const { messages, isLoading } = usePartyMessages(partyId);
  const sendMessage = useSendPartyMessage(partyId);
  const { data: hiddenWords } = useHiddenWords();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList>(null);
  const blockUser = useBlockUser();
  const reportUser = useReportUser();

  // Safety actions are per-member, not per-match — a party can hold someone neither
  // existing member has an individual match with, so this can't reuse chat/[matchId]'s
  // single "other person" menu. Two-level sheet: pick a member, then pick an action.
  const [membersSheetVisible, setMembersSheetVisible] = useState(false);
  const [actionsFor, setActionsFor] = useState<PartyMemberProfile | null>(null);
  const [reportTarget, setReportTarget] = useState<PartyMemberProfile | null>(null);
  // Both steps open a sheet from a sheet, which iOS drops while the first is still sliding
  // out, so each waits for its sheet's onDismiss. Block needs none: an Alert has its own window.
  const membersHandoff = useSheetHandoff();
  const actionsHandoff = useSheetHandoff();

  const otherMembers = (members?.profiles ?? []).filter((m) => m.profile_id !== myId);
  const nameById = new Map((members?.profiles ?? []).map((m) => [m.profile_id, m.display_name]));

  // A message from somebody the member list has never heard of means the list is behind: the
  // third person accepted after it was read, and their first "hi" would otherwise sit under
  // "Someone" until something else refetched it. Asked once per sender, so a sender the list
  // can never name (they left, or are hidden from this viewer) cannot make it refetch forever.
  const queryClient = useQueryClient();
  const askedAbout = useRef(new Set<string>());
  useEffect(() => {
    if (!partyId || !members) return;
    const known = new Set(members.ids);
    const strangers = messages
      .map((m) => m.sender_id)
      .filter((id) => id !== myId && !known.has(id) && !askedAbout.current.has(id));
    if (strangers.length === 0) return;
    for (const id of strangers) askedAbout.current.add(id);
    void queryClient.invalidateQueries({ queryKey: partyMembersQueryKey(partyId) });
  }, [partyId, members, messages, myId, queryClient]);

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    try {
      await sendMessage.mutateAsync(content);
    } catch (err) {
      hapticError();
      Alert.alert("Message not sent", err instanceof Error ? err.message : "Please try again.");
      setDraft(content);
    }
  }

  function handleBlockMember(member: PartyMemberProfile) {
    setActionsFor(null);
    Alert.alert("Block this user?", "They will be removed from your matches and deck.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: () => blockUser.mutate(member.profile_id),
      },
    ]);
  }

  function handleReportSubmit(reason: ReportReason, details: string) {
    if (!reportTarget) return;
    reportUser.mutate(
      { reportedId: reportTarget.profile_id, reason, details },
      {
        onSuccess: () => {
          setReportTarget(null);
          Alert.alert("Report submitted", "Thanks. Our team will review this.");
        },
        onError: () => {
          hapticError();
          Alert.alert("Something went wrong", "Please try again.");
        },
      },
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GraticuleBackground />
      <GrainOverlay />

      <ChatHeader
        optionsLabel="Party options"
        onOptions={() => setMembersSheetVisible(true)}
        title={
          <Text style={[type.title, { color: colors.text }]} numberOfLines={1}>
            Party chat
          </Text>
        }
      />

      {isLoading ? (
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <Skeleton width="60%" height={36} borderRadius={radius.md} style={{ alignSelf: "flex-start" }} />
          <Skeleton width="45%" height={36} borderRadius={radius.md} style={{ alignSelf: "flex-end" }} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={[type.body, { color: colors.textMuted }]}>Say hi to the party!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <MessageBubble
              content={item.content}
              isMine={item.sender_id === myId}
              senderName={nameById.get(item.sender_id) ?? "Someone"}
              hiddenWords={hiddenWords ?? []}
            />
          )}
        />
      )}

      {/* No keyboardVerticalOffset: with no native header this screen starts at the top of
          the window, so there is nothing above it for the offset to account for. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: keyboardVisible ? spacing.md : insets.bottom + spacing.md,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the party..."
            placeholderTextColor={colors.textMuted}
            maxLength={MESSAGE_MAX_LENGTH}
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
            // Same as the 1:1 composer: without this the keyboard's Send key inserted a newline.
            submitBehavior="submit"
            onSubmitEditing={() => void handleSend()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={() => void handleSend()}
            disabled={sendMessage.isPending || !draft.trim()}
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: radius.round,
                backgroundColor: colors.volt,
                alignItems: "center",
                justifyContent: "center",
                opacity: sendMessage.isPending || !draft.trim() ? 0.45 : 1,
              },
              { transform: [{ scale: pressed ? 0.94 : 1 }] },
            ]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.onVolt} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Sheet
        visible={membersSheetVisible}
        onClose={() => setMembersSheetVisible(false)}
        onDismiss={membersHandoff.onDismissed}
        title="Party members"
      >
        <View style={{ gap: spacing.xs }}>
          {otherMembers.length === 0 ? (
            <Text style={[type.body, { color: colors.textMuted }]}>No one else here yet.</Text>
          ) : (
            otherMembers.map((member) => (
              <ActionRow
                key={member.profile_id}
                icon="person-circle-outline"
                label={member.display_name}
                onPress={() =>
                  membersHandoff.handOff(
                    () => setMembersSheetVisible(false),
                    () => setActionsFor(member),
                  )
                }
              />
            ))
          )}
        </View>
      </Sheet>

      <Sheet
        visible={!!actionsFor}
        onClose={() => setActionsFor(null)}
        onDismiss={actionsHandoff.onDismissed}
        title={actionsFor?.display_name}
      >
        <View style={{ gap: spacing.xs }}>
          <SectionLabel>Safety</SectionLabel>
          <ActionRow
            icon="flag"
            label="Report"
            danger
            onPress={() => {
              if (!actionsFor) return;
              const member = actionsFor;
              actionsHandoff.handOff(
                () => setActionsFor(null),
                () => setReportTarget(member),
              );
            }}
          />
          <ActionRow icon="ban" label="Block" danger onPress={() => actionsFor && handleBlockMember(actionsFor)} />
        </View>
      </Sheet>

      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={handleReportSubmit}
        submitting={reportUser.isPending}
      />
    </View>
  );
}
