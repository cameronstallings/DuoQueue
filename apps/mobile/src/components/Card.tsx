import type { PropsWithChildren } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface CardProps extends PropsWithChildren {
  style?: ViewStyle;
  /** Drops the offset plate — for cards inside a scrolling list, where a plate on
   * every row turns into visual noise rather than depth. */
  flat?: boolean;
}

/** A grouped content block. The hard keyline and offset plate are what make it read
 * as a printed object sitting on the surface rather than a tinted rectangle. */
export function Card({ children, style, flat }: CardProps) {
  const { colors, radius, spacing, shadow, hairline } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.lg,
          borderWidth: hairline,
          borderColor: colors.ink,
        },
        flat ? null : shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}
