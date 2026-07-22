import type { PropsWithChildren } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface CardProps extends PropsWithChildren {
  style?: ViewStyle;
}

/** A grouped, elevated content block — used to visually separate sections instead of
 * relying on bare headings and vertical spacing alone. */
export function Card({ children, style }: CardProps) {
  const { colors, radius, spacing, shadow } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          ...shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
