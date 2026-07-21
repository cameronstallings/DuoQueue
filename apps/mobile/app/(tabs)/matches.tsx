import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { useMatches, type MatchListItem } from "@/features/chat/useMatches";
import { useTheme } from "@/theme/useTheme";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function MatchRow({ item }: { item: MatchListItem }) {
  const { colors, spacing } = useTheme();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item.match_id } })}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
      }}
    >
      {item.otherPhotoUrl ? (
        <Image source={{ uri: item.otherPhotoUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} />
      ) : (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 20 }}>{item.other_display_name[0]}</Text>
        </View>
      )}

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "700", color: colors.text, fontSize: 16 }}>
            {item.other_display_name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{timeAgo(item.last_message_at)}</Text>
        </View>
        <Text
          numberOfLines={1}
          style={{
            color: item.unread_count > 0 ? colors.text : colors.textMuted,
            fontWeight: item.unread_count > 0 ? "600" : "400",
          }}
        >
          {item.is_locked ? "Locked — upgrade to keep chatting" : (item.last_message ?? "Say hi!")}
        </Text>
      </View>

      {item.unread_count > 0 && (
        <View
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.brand,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 6,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{item.unread_count}</Text>
        </View>
      )}
      {item.is_locked && (
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>LOCKED</Text>
      )}
    </Pressable>
  );
}

export default function MatchesScreen() {
  const { colors, spacing } = useTheme();
  const { data: matches, isLoading } = useMatches();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, padding: spacing.lg }}>
        Matches
      </Text>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : !matches || matches.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.lg }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>No matches yet</Text>
          <Text style={{ color: colors.textMuted, textAlign: "center" }}>
            Keep swiping in the Deck tab — mutual likes show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.match_id}
          renderItem={({ item }) => <MatchRow item={item} />}
        />
      )}
    </View>
  );
}
