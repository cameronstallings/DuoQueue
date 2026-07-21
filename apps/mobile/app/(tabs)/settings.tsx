import { useState } from "react";
import { ActivityIndicator, Alert, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import type { NotificationSettingsRow } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useDeleteAccount } from "@/features/settings/useDeleteAccount";
import { useNotificationSettings } from "@/features/settings/useNotificationSettings";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

type NotificationCategory = "new_match" | "new_message" | "super_ping" | "daily_swipes_refreshed";

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  new_match: "New match",
  new_message: "New message",
  super_ping: "Super Ping received",
  daily_swipes_refreshed: "Daily swipes refreshed",
};

function NotificationRow({
  category,
  settings,
  onToggle,
}: {
  category: NotificationCategory;
  settings: NotificationSettingsRow;
  onToggle: (category: NotificationCategory, value: boolean) => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: spacing.sm,
      }}
    >
      <Text style={{ color: colors.text }}>{CATEGORY_LABELS[category]}</Text>
      <Switch
        value={settings[category]}
        onValueChange={(value) => onToggle(category, value)}
        trackColor={{ true: colors.brand }}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, spacing } = useTheme();
  const signOut = useSessionStore((s) => s.signOut);
  const { settings, isLoading, update } = useNotificationSettings();
  const deleteAccount = useDeleteAccount();
  const [deleting, setDeleting] = useState(false);

  function handleToggle(category: NotificationCategory, value: boolean) {
    update.mutate({ [category]: value });
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your profile, photos, matches, and messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert("Are you absolutely sure?", "Your account will be deleted immediately.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete my account",
                style: "destructive",
                onPress: () => void confirmDelete(),
              },
            ]);
          },
        },
      ],
    );
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteAccount.mutateAsync();
      await signOut();
      router.replace("/(auth)/sign-in");
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>Settings</Text>

      <Text style={{ fontWeight: "700", color: colors.text, marginTop: spacing.sm }}>Notifications</Text>
      {isLoading || !settings ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        (["new_match", "new_message", "super_ping", "daily_swipes_refreshed"] as const).map((category) => (
          <NotificationRow key={category} category={category} settings={settings} onToggle={handleToggle} />
        ))
      )}

      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <Text style={{ fontWeight: "700", color: colors.danger }}>Danger zone</Text>
        <Button
          label={deleting ? "Deleting..." : "Delete account"}
          variant="ghost"
          onPress={handleDeleteAccount}
          loading={deleting}
        />
      </View>
    </ScreenContainer>
  );
}
