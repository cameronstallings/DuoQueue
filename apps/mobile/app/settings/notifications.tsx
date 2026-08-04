import { Switch, Text, View } from "react-native";
import type { NotificationSettingsRow } from "@duoqueue/shared-types";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useNotificationSettings } from "@/features/settings/useNotificationSettings";
import { useRequireSession } from "@/hooks/useRequireSession";
import { hapticSelection } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

type NotificationCategory =
  | "new_match"
  | "new_message"
  | "super_ping"
  | "daily_swipes_refreshed"
  | "nudge_unread"
  | "nudge_online";

const CATEGORIES: { value: NotificationCategory; label: string; hint: string }[] = [
  { value: "new_match", label: "New match", hint: "When someone you liked likes you back." },
  { value: "new_message", label: "New message", hint: "When a match sends you something." },
  { value: "super_ping", label: "Super Ping", hint: "When someone sends you a Super Ping." },
  {
    value: "daily_swipes_refreshed",
    label: "Swipes refreshed",
    hint: "Once a day, when your free swipes reset.",
  },
  {
    value: "nudge_unread",
    label: "Your duo is waiting",
    hint: "A gentle nudge when you haven't read a match's message.",
  },
  {
    value: "nudge_online",
    label: "Free to duo right now",
    hint: "When a match turns on Online Now.",
  },
];

function Row({
  category,
  label,
  hint,
  settings,
  onToggle,
}: {
  category: NotificationCategory;
  label: string;
  hint: string;
  settings: NotificationSettingsRow;
  onToggle: (category: NotificationCategory, value: boolean) => void;
}) {
  const { colors, spacing, type } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.body, { color: colors.text }]}>{label}</Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>{hint}</Text>
      </View>
      <Switch
        value={settings[category]}
        onValueChange={(value) => {
          hapticSelection();
          onToggle(category, value);
        }}
        trackColor={{ true: colors.volt }}
      />
    </View>
  );
}

function RowSkeleton() {
  const { radius, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Skeleton width="45%" height={15} />
        <Skeleton width="70%" height={12} />
      </View>
      <Skeleton width={44} height={26} borderRadius={radius.chip} />
    </View>
  );
}

export default function NotificationSettings() {
  useRequireSession();
  const { colors, spacing } = useTheme();
  const { settings, isLoading, error, update, refetch } = useNotificationSettings();

  return (
    <ScreenContainer title="Notifications" showBack>
      {error && !settings ? (
        <EmptyState
          icon="cloud-offline"
          title="Couldn't load your settings"
          subtitle="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void refetch()}
          tick="OFFLINE"
        />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {isLoading || !settings
            ? [0, 1, 2, 3].map((i) => (
                <View key={i}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing.md }} />}
                  <RowSkeleton />
                </View>
              ))
            : CATEGORIES.map((c, i) => (
                <View key={c.value}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing.md }} />}
                  <Row
                    category={c.value}
                    label={c.label}
                    hint={c.hint}
                    settings={settings}
                    onToggle={(category, value) => update.mutate({ [category]: value })}
                  />
                </View>
              ))}
        </Card>
      )}
    </ScreenContainer>
  );
}
