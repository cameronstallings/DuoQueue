import { Linking, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { APP_STORE_DEEP_LINK, APP_STORE_URL } from "@/lib/legal";
import { revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { UPDATE_SCREEN_COPY } from "./appStatus";
import { checkAppStatus, type GateReason } from "./updateGateStore";

function openAppStore(): void {
  Linking.openURL(APP_STORE_DEEP_LINK).catch(() => {
    Linking.openURL(APP_STORE_URL).catch(() => {});
  });
}

/**
 * "Update DuoQueue to keep playing", over the whole app.
 *
 * An absolute overlay inside the app tree (above the Stack and the Toast, below the cold-start
 * LaunchIntro), never a route: replacing the Stack would throw away the navigation state of a
 * phone that a "Try again" can free a second later. A native-stack modal that is already open
 * when a resume check flips to blocked covers this until it closes (an accepted limit).
 *
 * It must not import `@/lib/supabase`: the "key" reason means the Supabase key is dead, and this
 * screen is what is left to show. "Try again" is only offered for "min-version", where lowering
 * minVersion frees the phone; a dead key stays dead for the launch.
 */
export function UpdateRequiredOverlay({ reason }: { reason: GateReason | null }) {
  const { colors, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={revealEntering()}
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFillObject,
        {
          zIndex: 10,
          backgroundColor: colors.background,
          justifyContent: "center",
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.lg,
        },
      ]}
    >
      <View style={{ alignItems: "center", gap: spacing.md }}>
        <Logo width={72} />
        <Text accessibilityRole="header" style={[type.screenTitle, { color: colors.text, textAlign: "center" }]}>
          {UPDATE_SCREEN_COPY.title}
        </Text>
        <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{UPDATE_SCREEN_COPY.body}</Text>
      </View>
      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <Button label={UPDATE_SCREEN_COPY.openStore} onPress={openAppStore} />
        {reason === "min-version" && (
          <Button variant="ghost" label={UPDATE_SCREEN_COPY.tryAgain} onPress={() => void checkAppStatus({ force: true })} />
        )}
      </View>
    </Animated.View>
  );
}
