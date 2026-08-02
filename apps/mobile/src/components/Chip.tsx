import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

export type ChipTone = "default" | "accent" | "success" | "solar" | "danger";

export interface ChipProps {
  label: string;
  /** Inline secondary value rendered after a dot — "Valorant · Diamond". */
  detail?: string;
  icon?: ReactNode; // pre-sized element, 13px
  selected?: boolean;
  tone?: ChipTone; // default "default"
  onPress?: () => void; // renders Pressable when given
  /** Screen-reader override for chips whose press action isn't "select" — removable
   * chips should announce "Remove {label}", not "{label}, selected". */
  accessibilityLabel?: string;
}

/**
 * The one chip idiom: a pill that either sits flat (informational) or presses
 * (selectable), with the same geometry either way so the two read as the same
 * object in different states.
 */
export function Chip({ label, detail, icon, selected, tone = "default", onPress, accessibilityLabel }: ChipProps) {
  const { colors, radius, spacing, type, scheme, glow } = useTheme();

  const isAccent = selected || tone === "accent";
  const solarColor = scheme === "dark" ? colors.solarA : colors.solarB;

  let backgroundColor: string = colors.surface;
  let borderColor: string = colors.border;
  let textColor: string = colors.text;

  if (isAccent) {
    backgroundColor = colors.brandSoft;
    borderColor = colors.accent;
    textColor = colors.brandInk;
  } else if (tone === "success") {
    backgroundColor = colors.successFill;
    borderColor = colors.success;
    textColor = colors.success;
  } else if (tone === "solar") {
    backgroundColor = colors.warningFill;
    borderColor = solarColor;
    textColor = solarColor;
  } else if (tone === "danger") {
    backgroundColor = "transparent";
    borderColor = colors.danger;
    textColor = colors.danger;
  }

  const content = (
    <>
      {icon}
      <Text style={[type.caption, { color: textColor }]}>{label}</Text>
      {detail && (
        <Text style={[type.caption, { color: colors.textMuted }]}>· {detail}</Text>
      )}
    </>
  );

  const containerStyle = [
    styles.base,
    {
      borderRadius: radius.chip,
      paddingVertical: spacing.sm - 1,
      paddingHorizontal: spacing.md - 2,
      gap: spacing.xs,
      backgroundColor,
      borderWidth: 1,
      borderColor,
    },
    selected ? glow(colors.glowViolet, 10) : null,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: !!selected }}
        onPress={onPress}
        style={({ pressed }) => [...containerStyle, pressed ? { opacity: 0.85 } : null]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
  },
});
