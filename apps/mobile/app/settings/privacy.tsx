import { Switch, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { usePrivacyToggles } from "@/features/settings/usePrivacyToggles";
import { hapticSelection } from "@/lib/haptics";
import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
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
        value={value}
        onValueChange={(next) => {
          hapticSelection();
          onChange(next);
        }}
        trackColor={{ true: colors.brand }}
      />
    </View>
  );
}

export default function PrivacySettings() {
  const { colors, spacing } = useTheme();
  const { profile, setIsActive, setHideLastActive } = usePrivacyToggles();

  return (
    <ScreenContainer title="Privacy">
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <ToggleRow
          label="Pause my profile"
          hint="Hide yourself from other people's decks and Standouts. Your matches and messages stay."
          value={!(profile?.is_active ?? true)}
          onChange={(paused) => {
            setIsActive.mutate(!paused);
            useToastStore.getState().showToast(paused ? "Profile paused" : "Profile active again");
          }}
        />
        <View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing.md }} />
        <ToggleRow
          label="Hide last-active status"
          hint="Others won't see when you were last online."
          value={profile?.hide_last_active ?? false}
          onChange={(next) => {
            setHideLastActive.mutate(next);
            useToastStore.getState().showToast("Settings saved");
          }}
        />
      </Card>
    </ScreenContainer>
  );
}
