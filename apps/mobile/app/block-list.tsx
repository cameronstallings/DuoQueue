import { Alert, FlatList, RefreshControl, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useBlockedUsers, useUnblockUser, type BlockedUser } from "@/features/settings/useBlockedUsers";
import { useTheme } from "@/theme/useTheme";

function BlockedRow({ item }: { item: BlockedUser }) {
  const { colors, radius, spacing } = useTheme();
  const unblock = useUnblockUser();

  function handleUnblock() {
    Alert.alert("Unblock this user?", "They'll be able to appear in your deck again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Unblock", onPress: () => unblock.mutate(item.blocked_id) },
    ]);
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "600" }}>{item.display_name}</Text>
      <Button label="Unblock" variant="ghost" onPress={handleUnblock} loading={unblock.isPending} />
    </View>
  );
}

function BlockedRowSkeleton() {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
      }}
    >
      <Skeleton width="50%" height={16} />
    </View>
  );
}

export default function BlockListScreen() {
  const { colors, spacing, type } = useTheme();
  const { data: blocked, isLoading, isFetching, error, refetch } = useBlockedUsers();

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={colors.brand} />
      }
    >
      <Text style={{ ...type.screenTitle, color: colors.text }}>Block List</Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
        People you&apos;ve blocked. Unblocking lets them appear in your deck again — they won&apos;t be notified
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
          <Text style={{ color: colors.textMuted }}>Couldn&apos;t load your block list.</Text>
          <Button label="Try again" variant="ghost" onPress={() => void refetch()} />
        </View>
      ) : !blocked || blocked.length === 0 ? (
        <Text style={{ color: colors.textMuted }}>You haven&apos;t blocked anyone.</Text>
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
