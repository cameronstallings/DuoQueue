import { Switch, Text, View } from "react-native";

import { hapticSelection } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

interface ToggleRowProps {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Fires `hapticSelection()` before `onValueChange` (the haptic map: toggles are selection).
   * Default on. Only the Haptics switch itself passes false, because it has to choose the order
   * of the tap and the change (see app/settings/appearance.tsx). */
  haptic?: boolean;
}

/**
 * THE settings switch row, and the only one: a label with a muted hint on the left, a volt Switch
 * on the right. Lifted from Settings > Notifications so every switch in the app looks, reads and
 * buzzes the same, and so a screen never calls a haptic by hand next to a Switch.
 *
 * Rows sit edge to edge inside a `<Card style={{ padding: 0, overflow: "hidden" }}>`; the caller
 * draws the 1px dividers between them.
 */
export function ToggleRow({ label, hint, value, onValueChange, disabled, haptic = true }: ToggleRowProps) {
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
        {hint ? <Text style={[type.caption, { color: colors.textMuted }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (haptic) hapticSelection();
          onValueChange(next);
        }}
        trackColor={{ true: colors.volt }}
        accessibilityLabel={label}
        accessibilityHint={hint}
      />
    </View>
  );
}
