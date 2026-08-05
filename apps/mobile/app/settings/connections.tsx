import { Pressable, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useLinkedAccounts, useLinkSteamAccount, useUnlinkAccount } from "@/features/profile/useLinkedAccounts";
import { useRequireSession } from "@/hooks/useRequireSession";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

function ProviderRow({
  name,
  status,
  action,
  onPress,
  disabled,
  destructive,
}: {
  name: string;
  status: string;
  action?: string;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
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
        <Text style={[type.bodyStrong, { color: colors.text }]}>{name}</Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>{status}</Text>
      </View>
      {action &&
        (onPress ? (
          <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={8}>
            <Text style={[type.label, { color: destructive ? colors.danger : colors.voltDim }]}>{action}</Text>
          </Pressable>
        ) : (
          <Text style={[type.label, { color: colors.textMuted }]}>{action}</Text>
        ))}
    </View>
  );
}

export default function ConnectionsSettings() {
  useRequireSession();
  const { colors, type } = useTheme();
  const profile = useSessionStore((s) => s.profile);
  const { data: linked } = useLinkedAccounts(profile?.id);
  const { startLink, linking, error } = useLinkSteamAccount(profile?.id);
  const { unlink, unlinking } = useUnlinkAccount(profile?.id);

  const steamLink = linked?.find((a) => a.provider === "steam");

  return (
    <ScreenContainer title="Connections" showBack>
      <Text style={[type.body, { color: colors.textMuted }]}>
        A verified badge pulls your rank and username straight from the source, rather than trusting a typed-in
        claim.
      </Text>

      {/* Steam only. Riot and Xbox rows used to sit here marked "Coming soon" — App
          Review reads placeholder features as an incomplete app (Guideline 2.1), and
          an empty promise is worse than no row. The providers stay in the enum and the
          sync function still understands them; when one is genuinely wired, its row
          comes back. */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <ProviderRow
          name="Steam"
          status={steamLink ? `Verified as ${steamLink.display_name}` : "Not connected"}
          action={steamLink ? (unlinking ? "Unlinking…" : "Unlink") : linking ? "Connecting…" : "Connect"}
          onPress={steamLink ? () => void unlink("steam") : () => void startLink()}
          disabled={steamLink ? unlinking : linking}
          destructive={!!steamLink}
        />
      </Card>

      {error && <Text style={[type.caption, { color: colors.danger }]}>{error}</Text>}
    </ScreenContainer>
  );
}
