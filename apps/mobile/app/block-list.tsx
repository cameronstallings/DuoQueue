import { useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useBlockedUsers, useUnblockUser, type BlockedUser } from "@/features/settings/useBlockedUsers";
import { useRequireSession } from "@/hooks/useRequireSession";
import { useTheme } from "@/theme/useTheme";

function BlockedRow({ item }: { item: BlockedUser }) {
  const { colors, spacing, type } = useTheme();
  const unblock = useUnblockUser();

  function handleUnblock() {
    Alert.alert("Unblock this user?", "They'll be able to appear in your deck again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Unblock", onPress: () => unblock.mutate(item.blocked_id) },
    ]);
  }

  return (
    <Card
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={[type.bodyStrong, { color: colors.text }]}>{item.display_name}</Text>
      <Button label="Unblock" variant="ghost" onPress={handleUnblock} loading={unblock.isPending} />
    </Card>
  );
}

function BlockedRowSkeleton() {
  const { spacing } = useTheme();
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", padding: spacing.md, marginBottom: spacing.sm }}>
      <Skeleton width="50%" height={16} />
    </Card>
  );
}

export default function BlockListScreen() {
  useRequireSession();
  const { colors, spacing, type } = useTheme();
  const { data: blocked, isLoading, error, refetch } = useBlockedUsers();

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ScreenContainer
      title="Block List"
      showClose
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.volt} />
      }
    >
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing.sm }]}>
        People you&apos;ve blocked. Unblocking lets them appear in your deck again. They won&apos;t be notified
        either way.
      </Text>

      {isLoading ? (
        <View>
          {[0, 1, 2].map((i) => (
            <BlockedRowSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.body, { color: colors.textMuted }]}>Couldn&apos;t load your block list.</Text>
          <Button label="Try again" variant="ghost" onPress={() => void refetch()} />
        </View>
      ) : !blocked || blocked.length === 0 ? (
        <Text style={[type.body, { color: colors.textMuted }]}>You haven&apos;t blocked anyone.</Text>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.blocked_id}
          renderItem={({ item }) => <BlockedRow item={item} />}
          scrollEnabled={false}
        />
      )}
    </ScreenContainer>
  );
}
