import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { NotificationSettingsRow } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ChipSelect } from "@/components/ChipSelect";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { useDeleteAccount } from "@/features/settings/useDeleteAccount";
import { useNotificationSettings } from "@/features/settings/useNotificationSettings";
import { useSessionStore } from "@/store/session-store";
import { type ThemePreference, useThemeStore } from "@/store/theme-store";
import { useTheme } from "@/theme/useTheme";

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

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
      <Text style={{ color: colors.text, fontSize: 15 }}>{CATEGORY_LABELS[category]}</Text>
      <Switch
        value={settings[category]}
        onValueChange={(value) => onToggle(category, value)}
        trackColor={{ true: colors.brand }}
      />
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: spacing.sm,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { colors, spacing } = useTheme();
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
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

  const categories = ["new_match", "new_message", "super_ping", "daily_swipes_refreshed"] as const;

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>Settings</Text>

      <View style={{ marginTop: spacing.md }}>
        <SectionLabel>Appearance</SectionLabel>
        <Card>
          <ChipSelect
            options={APPEARANCE_OPTIONS}
            selected={[themePreference]}
            onToggle={(value) => setThemePreference(value)}
          />
        </Card>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <SectionLabel>Notifications</SectionLabel>
        <Card>
          {isLoading || !settings ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            categories.map((category, i) => (
              <View key={category}>
                {i > 0 && <Divider />}
                <NotificationRow category={category} settings={settings} onToggle={handleToggle} />
              </View>
            ))
          )}
        </Card>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <SectionLabel>Safety</SectionLabel>
        <Card>
          <NavRow label="Block List" onPress={() => router.push("/block-list")} />
        </Card>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <SectionLabel>Danger zone</SectionLabel>
        <Card style={{ borderWidth: 1, borderColor: colors.danger, backgroundColor: "transparent", gap: spacing.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            Deleting your account permanently removes your profile, photos, matches, and messages. This cannot be
            undone.
          </Text>
          <Button
            label={deleting ? "Deleting..." : "Delete account"}
            variant="ghost"
            onPress={handleDeleteAccount}
            loading={deleting}
          />
        </Card>
      </View>
    </ScreenContainer>
  );
}
