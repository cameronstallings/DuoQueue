import type { ComponentProps } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useTheme } from "@/theme/useTheme";

import { Chip } from "./Chip";

type InfoChipProps = { label: string; sublabel?: string } & (
  | { icon?: ComponentProps<typeof Ionicons>["name"]; iconFamily?: "ionicons" }
  | { icon: ComponentProps<typeof MaterialCommunityIcons>["name"]; iconFamily: "material-community" }
);

/**
 * @deprecated use Chip. Kept as a thin wrapper so existing call sites (games,
 * shows, platforms, playstyle tags) keep compiling and stay correctly styled
 * until they migrate directly to Chip.
 */
export function InfoChip(props: InfoChipProps) {
  const { label, sublabel, icon } = props;
  const { colors } = useTheme();

  const iconElement = icon ? (
    props.iconFamily === "material-community" ? (
      <MaterialCommunityIcons name={props.icon} size={13} color={colors.accentInk} />
    ) : (
      <Ionicons name={props.icon} size={13} color={colors.accentInk} />
    )
  ) : undefined;

  return <Chip label={label} detail={sublabel} icon={iconElement} />;
}
