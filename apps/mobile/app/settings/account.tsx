import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { hasAppleIdentity } from "@/features/auth/appleIdentity";
import { accountDeletionFinalMessage } from "@/features/auth/deleteThisSignIn";
import { useDeleteAccount } from "@/features/settings/useDeleteAccount";
import { useRequireSession } from "@/hooks/useRequireSession";
import { hapticError } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function AccountSettings() {
  useRequireSession();
  const { colors, spacing, type, hairline, radius } = useTheme();
  const signOut = useSessionStore((s) => s.signOut);
  const session = useSessionStore((s) => s.session);
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
            // An Apple account is told about the Apple sheet that comes next (the fresh code
            // the grant revocation needs); see useDeleteAccount. An email account's copy and
            // flow are unchanged.
            Alert.alert("Are you absolutely sure?", accountDeletionFinalMessage(hasAppleIdentity(session?.user)), [
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
      router.replace("/");
    } catch (err) {
      hapticError();
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
