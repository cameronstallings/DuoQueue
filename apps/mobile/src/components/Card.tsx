import type { PropsWithChildren } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/theme/useTheme";

interface CardProps extends PropsWithChildren {
  style?: ViewStyle;
  /** No glass fill — for rows inside dense lists. */
  flat?: boolean;
  /** 1px hero-gradient edge. Hero surfaces only (deck card, match sheet, own-profile header). */
  luminous?: boolean;
}

export function Card({ children, style, flat, luminous }: CardProps) {
  const { colors, radius, spacing, heroGradient } = useTheme();
  const inner = (
    <View
      style={[
        {
          backgroundColor: flat ? "transparent" : luminous ? colors.surfaceSolid : colors.surface,
          borderRadius: luminous ? radius.card - 1 : radius.card,
          padding: spacing.lg,
          borderWidth: flat || luminous ? 0 : 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!luminous) return inner;
  return (
    <LinearGradient {...heroGradient} style={{ borderRadius: radius.card, padding: 1 }}>
      {inner}
    </LinearGradient>
  );
}
