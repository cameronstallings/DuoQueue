import { View } from "react-native";
import { router } from "expo-router";

import { Card } from "@/components/Card";
import { NavRow, RowDivider } from "@/components/NavRow";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { type ThemePreference, useThemeStore } from "@/store/theme-store";
import { useTheme } from "@/theme/useTheme";

const APPEARANCE_SUMMARY: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

/**
 * A menu, not a control panel.
 *
 * Every setting used to live on this one screen, so finding anything meant reading
 * the whole thing, and adding one more toggle made it worse. The controls now live
 * behind named destinations; each row carries a one-line hint so you can tell what
 * is inside without opening it, and rows that hold a single choice show the current
 * value on the right.
 */
export default function SettingsScreen() {
  const { spacing } = useTheme();
  const themePreference = useThemeStore((s) => s.preference);

  return (
    <ScreenContainer title="Settings">
      <View>
        <SectionLabel>You</SectionLabel>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <NavRow
            icon="color-palette-outline"
            label="Appearance"
            hint="Light, dark, or follow your phone"
            value={APPEARANCE_SUMMARY[themePreference]}
            onPress={() => router.push("/settings/appearance")}
          />
          <RowDivider />
          <NavRow
            icon="notifications-outline"
            label="Notifications"
            hint="Choose what you get pinged about"
            onPress={() => router.push("/settings/notifications")}
          />
          <RowDivider />
          <NavRow
            icon="eye-off-outline"
            label="Privacy"
            hint="Pause your profile, hide last-active"
            onPress={() => router.push("/settings/privacy")}
          />
          <RowDivider />
          <NavRow
            icon="game-controller-outline"
            label="Connections"
            hint="Verify your Steam account"
            onPress={() => router.push("/settings/connections")}
          />
        </Card>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <SectionLabel>Safety</SectionLabel>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <NavRow
            icon="shield-checkmark-outline"
            label="Safety Center"
            hint="Staying safe when you meet people online"
            onPress={() => router.push("/safety")}
          />
          <RowDivider />
          <NavRow
            icon="person-remove-outline"
            label="Blocked people"
            hint="Everyone you've blocked"
            onPress={() => router.push("/block-list")}
          />
          <RowDivider />
          <NavRow
            icon="text-outline"
            label="Hidden words"
            hint="Filter messages containing words you choose"
            onPress={() => router.push("/hidden-words")}
          />
        </Card>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <SectionLabel>Account</SectionLabel>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <NavRow
            icon="log-out-outline"
            label="Sign out or delete account"
            onPress={() => router.push("/settings/account")}
          />
        </Card>
      </View>
    </ScreenContainer>
  );
}
