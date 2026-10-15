import { Text, View } from "react-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";

import { versionLabel } from "@/lib/appStamp";
import { RIOT_NOTICE } from "@/lib/legal";
import { useTheme } from "@/theme/useTheme";

/**
 * Under Settings > Legal: Riot's non-endorsement line (their Developer Policies ask for it
 * wherever League of Legends names appear), then the build line, "DuoQueue 1.0.2 (19)" plus the
 * OTA update when one is running. The build line is selectable so a player can paste it into a
 * support email, and it is how Cameron sees on his own phone that an update landed.
 *
 * Plain text only: no Riot art and no link. Muted ink on the screen background, an audited pair.
 */
export function AboutFooter() {
  const { colors, fonts, spacing, type } = useTheme();
  const label = versionLabel({
    version: Application.nativeApplicationVersion,
    build: Application.nativeBuildVersion,
    updateId: Updates.updateId,
    embedded: Updates.isEmbeddedLaunch,
  });

  return (
    <View style={{ marginTop: spacing.sm, gap: spacing.sm, paddingHorizontal: spacing.xs }}>
      <Text style={[type.caption, { color: colors.textMuted }]}>{RIOT_NOTICE}</Text>
      <Text selectable style={[type.caption, { fontFamily: fonts.mono, color: colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}
