import { View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface PageDotsProps {
  count: number;
  activeIndex: number;
  /** Active-dot color override. Pairs with `inactiveColor` for callers rendering over
   *  a photo scrim, where the default volt-active / border-inactive pair doesn't have
   *  enough contrast (olive-on-scrim in Paper, near-invisible border in dark). Defaults
   *  to `colors.volt`. */
  color?: string;
  /** Inactive-dot color override. Defaults to `colors.border`. */
  inactiveColor?: string;
}

/** Small dot row marking position in a horizontal photo pager. Renders nothing for 0
 * or 1 page, since there's nothing to page between — callers don't need to gate on
 * count themselves. */
export function PageDots({ count, activeIndex, color, inactiveColor }: PageDotsProps) {
  const { colors, radius, spacing } = useTheme();
  if (count <= 1) return null;

  return (
    <View pointerEvents="none" style={{ flexDirection: "row", justifyContent: "center", gap: spacing.xs }}>
      {Array.from({ length: count }, (_, index) => {
        const active = index === activeIndex;
        return (
          <View
            key={index}
            style={{
              width: 6,
              height: 6,
              borderRadius: radius.round,
              backgroundColor: active ? (color ?? colors.volt) : (inactiveColor ?? colors.border),
            }}
          />
        );
      })}
    </View>
  );
}
