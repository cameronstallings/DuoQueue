import { useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { Skeleton } from "@/components/Skeleton";
import { usePartyMembers } from "@/features/party/useParty";
import { usePartyMessages, useSendPartyMessage } from "@/features/party/usePartyMessages";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

function MessageBubble({ content, isMine, senderName }: { content: string; isMine: boolean; senderName: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "80%", gap: 2 }}>
      {!isMine && <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: spacing.sm }}>{senderName}</Text>}
      <View
        style={{
          backgroundColor: isMine ? colors.brand : colors.surface,
          borderRadius: 16,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        }}
      >
        <Text style={{ color: isMine ? "#fff" : colors.text }}>{content}</Text>
      </View>
    </View>
  );
}

export default function PartyChatScreen() {
  const { colors, spacing } = useTheme();
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const myId = useSessionStore((s) => s.session?.user.id);
  const { data: members } = usePartyMembers(partyId);
  const { messages, isLoading } = usePartyMessages(partyId);
  const sendMessage = useSendPartyMessage(partyId);
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
      <Stack.Screen options={{ title: "Party chat", headerShown: true }} />

      {isLoading ? (
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <Skeleton width="60%" height={36} borderRadius={16} style={{ alignSelf: "flex-start" }} />
          <Skeleton width="45%" height={36} borderRadius={16} style={{ alignSelf: "flex-end" }} />
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
              <Text style={{ color: colors.textMuted }}>Say hi to the party!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <MessageBubble
              content={item.content}
              isMine={item.sender_id === myId}
              senderName={nameById.get(item.sender_id) ?? "Someone"}
            />
          )}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
            onChangeText={setDraft}
            placeholder="Message the party..."
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
      </KeyboardAvoidingView>
    </View>
  );
}
