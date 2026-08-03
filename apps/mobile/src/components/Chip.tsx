import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

export type ChipTone = "default" | "volt" | "success" | "amber" | "danger" | "soft"
  /** @deprecated Volt migration aliases — DELETE in Task 11 */
  | "accent" | "solar";

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
 * The one chip idiom: a sharp 3px mono tag that either sits flat (informational)
 * or presses (selectable), with the same geometry either way so the two read as the
 * same object in different states.
 */
export function Chip({ label, detail, icon, selected, tone = "default", onPress, accessibilityLabel }: ChipProps) {
  const { colors, radius, spacing, type } = useTheme();

  const resolved = tone === "accent" ? "volt" : tone === "solar" ? "amber" : tone;
  const isVolt = selected || resolved === "volt";

  let backgroundColor: string = "transparent";
  let borderColor: string = colors.border;
  let textColor: string = colors.textMuted;

  if (isVolt) {
    borderColor = colors.volt;
    textColor = colors.volt;
  } else if (resolved === "soft") {
    backgroundColor = colors.voltSoft;
    borderColor = "transparent";
    textColor = colors.volt;
  } else if (resolved === "success") {
    backgroundColor = colors.successFill;
    borderColor = colors.success;
    textColor = colors.success;
  } else if (resolved === "amber") {
    backgroundColor = colors.amberSoft;
    borderColor = colors.amber;
    textColor = colors.amber;
  } else if (resolved === "danger") {
    borderColor = colors.danger;
    textColor = colors.danger;
  }

  // Paper mode: colors.volt resolves to olive (#4A6B00 on light) — exactly the "inks mark"
  // rule; voltSoft's text pairs with colors.volt (olive ≈ #4A6B00). Nothing scheme-branched.

  const content = (
    <>
      {icon}
      {/* Both texts shrink and ellipsize: a long "League of Legends · Unranked" must
          truncate inside its container, never push the tag past a bento tile's edge. */}
      <Text numberOfLines={1} style={[type.chipText, { color: textColor, flexShrink: 1 }]}>
        {label}
      </Text>
      {detail && (
        <Text numberOfLines={1} style={[type.caption, { color: colors.textMuted, flexShrink: 1 }]}>
          · {detail}
        </Text>
      )}
    </>
  );

  const containerStyle = [
    styles.base,
    {
      borderRadius: radius.chip,
      paddingVertical: spacing.xs + 1,
      paddingHorizontal: spacing.sm + 1,
      gap: spacing.xs,
      backgroundColor,
      borderWidth: 1,
      borderColor,
    },
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
    maxWidth: "100%",
    flexShrink: 1,
  },
});
