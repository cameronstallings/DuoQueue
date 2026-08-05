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
import { useHeaderHeight } from "@react-navigation/elements";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MESSAGE_MAX_LENGTH } from "@duoqueue/shared-types";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Skeleton } from "@/components/Skeleton";
import { usePartyMembers } from "@/features/party/useParty";
import { usePartyMessages, useSendPartyMessage } from "@/features/party/usePartyMessages";
import { containsHiddenWord, useHiddenWords } from "@/features/settings/useHiddenWords";
import { useRequireSession } from "@/hooks/useRequireSession";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

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
            {isHidden ? "Message hidden — tap to reveal" : content}
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
  const headerHeight = useHeaderHeight();
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

  const nameById = new Map((members ?? []).map((m) => [m.profile_id, m.display_name]));

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    try {
      await sendMessage.mutateAsync(content);
    } catch (err) {
      Alert.alert("Message not sent", err instanceof Error ? err.message : "Please try again.");
      setDraft(content);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GraticuleBackground />
      <GrainOverlay />

      <Stack.Screen options={{ title: "Party chat", headerShown: true }} />

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

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
      >
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
            blurOnSubmit={false}
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
    </View>
  );
}
