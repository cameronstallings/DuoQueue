import { Linking, Platform, View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { Card } from "@/components/Card";
import { NavRow, RowDivider } from "@/components/NavRow";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { usePremiumStatus } from "@/features/matching/usePremiumStatus";
import { LEGAL_URLS } from "@/lib/legal";
import { type ThemePreference, useThemeStore } from "@/store/theme-store";
import { useTheme } from "@/theme/useTheme";

const APPEARANCE_SUMMARY: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

// A subscription bought through Apple can only be changed or cancelled through Apple —
// an in-app "cancel" button would be a lie, and Guideline 3.1.2 expects the real one to
// be findable. These are the canonical deep links into each store's own subscription
// management, and they are the same destination the paywall's disclosure text points at.
const MANAGE_SUBSCRIPTION_URL = Platform.select({
  ios: "https://apps.apple.com/account/subscriptions",
  android: "https://play.google.com/store/account/subscriptions",
  default: "https://apps.apple.com/account/subscriptions",
});

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
  const { isPremium } = usePremiumStatus();

  return (
    <ScreenContainer title="Settings">
      <View>
        <SectionLabel>Subscription</SectionLabel>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <NavRow
            icon="flash-outline"
            label="DuoQueue+"
            hint={
              isPremium
                ? "See what's included and your current plan"
                : "Unlimited swipes, filters, and a daily Super Ping"
            }
            value={isPremium ? "Active" : undefined}
            onPress={() => router.push("/paywall")}
          />
          <RowDivider />
          {/* Shown whether or not this device thinks you're subscribed: someone who
              subscribed on another device, or whose webhook hasn't landed yet, still
              needs the way out — and that is exactly the person most likely to look. */}
          <NavRow
            icon="card-outline"
            label="Manage subscription"
            hint="Change your plan or cancel in the App Store"
            onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
          />
        </Card>
      </View>

      <View style={{ marginTop: spacing.md }}>
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

      <View style={{ marginTop: spacing.md }}>
        <SectionLabel>Legal</SectionLabel>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <NavRow
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.privacyPolicy)}
          />
          <RowDivider />
          <NavRow
            icon="reader-outline"
            label="Terms of Service"
            onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.termsOfService)}
          />
          <RowDivider />
          <NavRow
            icon="mail-outline"
            label="Contact Support"
            onPress={() => void Linking.openURL(`mailto:${LEGAL_URLS.supportEmail}`)}
          />
        </Card>
      </View>
    </ScreenContainer>
  );
}
