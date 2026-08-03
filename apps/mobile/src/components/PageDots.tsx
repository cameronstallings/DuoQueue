import { View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface PageDotsProps {
  count: number;
  activeIndex: number;
  /** Overrides both dots to one flat tone (opacity-differentiated) instead of the
   *  default volt-active / border-inactive pair — an escape hatch for a photo scrim
   *  that doesn't suit those two colors. Unused by any caller today. */
  color?: string;
}

/** Small dot row marking position in a horizontal photo pager. Renders nothing for 0
 * or 1 page, since there's nothing to page between — callers don't need to gate on
 * count themselves. */
export function PageDots({ count, activeIndex, color }: PageDotsProps) {
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
              backgroundColor: color ?? (active ? colors.volt : colors.border),
              opacity: color ? (active ? 1 : 0.4) : 1,
            }}
          />
        );
      })}
    </View>
  );
}
