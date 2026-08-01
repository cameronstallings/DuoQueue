import type { ComponentProps } from "react";
import { Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useTheme } from "@/theme/useTheme";

type InfoChipProps = { label: string; sublabel?: string } & (
  | { icon?: ComponentProps<typeof Ionicons>["name"]; iconFamily?: "ionicons" }
  | { icon: ComponentProps<typeof MaterialCommunityIcons>["name"]; iconFamily: "material-community" }
);

/** A read-only sticker — displays (rather than selects) games, shows, platforms and
 * playstyles. Deliberately the same geometry as ChipSelect so the two read as the same
 * object in different states, with no plate since these are never pressable. */
export function InfoChip(props: InfoChipProps) {
  const { label, sublabel, icon } = props;
  const { colors, radius, spacing, type, hairline } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.xs + 1,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.chip,
        backgroundColor: colors.surface,
        borderWidth: hairline,
        borderColor: colors.ink,
      }}
    >
      {icon &&
        (props.iconFamily === "material-community" ? (
          <MaterialCommunityIcons name={props.icon} size={13} color={colors.brandInk} />
        ) : (
          <Ionicons name={props.icon} size={13} color={colors.brandInk} />
        ))}
      <Text style={[type.caption, { color: colors.text }]}>{label}</Text>
      {sublabel && <Text style={[type.statSm, { color: colors.textMuted }]}>{sublabel}</Text>}
    </View>
  );
}
