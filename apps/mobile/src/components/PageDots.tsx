import { View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface PageDotsProps {
  count: number;
  activeIndex: number;
  /** Defaults to colors.onFill (white) — dots are meant to sit over a photo's scrim,
   * not on a plain surface. */
  color?: string;
}

/** Small dot row marking position in a horizontal photo pager. Renders nothing for 0
 * or 1 page, since there's nothing to page between — callers don't need to gate on
 * count themselves. */
export function PageDots({ count, activeIndex, color }: PageDotsProps) {
  const { colors, spacing } = useTheme();
  if (count <= 1) return null;
  const dotColor = color ?? colors.onFill;

  return (
    <View pointerEvents="none" style={{ flexDirection: "row", justifyContent: "center", gap: spacing.xs }}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: dotColor,
            opacity: index === activeIndex ? 1 : 0.4,
          }}
        />
      ))}
    </View>
  );
}
