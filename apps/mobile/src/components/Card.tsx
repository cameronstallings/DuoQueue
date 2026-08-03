import type { PropsWithChildren } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface CardProps extends PropsWithChildren {
  style?: ViewStyle;
  /** No fill or edge — for rows inside dense lists. */
  flat?: boolean;
  /** 1px volt edge instead of the plain border. Hero surfaces only (deck card, match
   *  sheet, own-profile header). */
  luminous?: boolean;
}

export function Card({ children, style, flat, luminous }: CardProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: flat ? "transparent" : colors.surface,
          borderRadius: radius.card,
          padding: spacing.lg,
          borderWidth: flat ? 0 : 1,
          borderColor: luminous ? colors.volt : colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
