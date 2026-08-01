import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { useDeleteAccount } from "@/features/settings/useDeleteAccount";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function AccountSettings() {
  const { colors, spacing, type, hairline, radius } = useTheme();
  const signOut = useSessionStore((s) => s.signOut);
  const deleteAccount = useDeleteAccount();
  const [deleting, setDeleting] = useState(false);

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
              { text: "Delete my account", style: "destructive", onPress: () => void confirmDelete() },
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
    <ScreenContainer title="Account" showBack>
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />

      <View style={{ marginTop: spacing.xl }}>
        <SectionLabel>Danger zone</SectionLabel>
        <Card
          style={{
            borderWidth: hairline,
            borderColor: colors.danger,
            borderRadius: radius.md,
            backgroundColor: "transparent",
            gap: spacing.md,
          }}
          flat
        >
          <Text style={[type.body, { color: colors.textMuted }]}>
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
