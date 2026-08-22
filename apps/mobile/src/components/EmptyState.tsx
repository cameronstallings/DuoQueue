import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { useTheme } from "@/theme/useTheme";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  /** A second, lower-commitment way out, rendered under the primary button.
   *
   * Optional on purpose: the eight existing call sites offer one action or none, and an
   * empty screen with two equally weighted buttons is a screen that has not decided what it
   * wants the user to do. Only reach for this where the honest answer really is two things
   * (the deck's "clear my filters" versus "go and edit them"). */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Short mono status shown bracket-tagged above the title, e.g. "NO ONE IN QUEUE". */
  tick?: string;
}

/** A consistent "nothing here" / "something went wrong" presentation — used across the
 * deck, matches, admirers, and block list. The icon sits in a soft volt circle, tagged
 * above the title with a mono `[ STATUS ]` bracket, so an empty screen still looks like
 * it belongs to this app. */
export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  tick = "EMPTY",
}: EmptyStateProps) {
  const { colors, spacing, radius, type } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.round,
          backgroundColor: colors.voltSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={32} color={colors.voltDim} />
      </View>
      <Text style={[type.tick, { color: colors.voltDim }]}>{`[ ${tick} ]`}</Text>
      <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{title}</Text>
      <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{subtitle}</Text>
      {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} variant="ghost" />}
      {/* `sm` rather than a second full-size button: both are ghosts, so padding is the only
       * thing left to say which one the screen is recommending. Two identically weighted
       * buttons would make the user choose before reading. */}
      {secondaryActionLabel && onSecondaryAction && (
        <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" size="sm" />
      )}
    </View>
  );
}
