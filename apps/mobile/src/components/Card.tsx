import type { PropsWithChildren } from "react";
import type { ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/theme/useTheme";

interface CardProps extends PropsWithChildren {
  style?: ViewStyle;
  /** No glass fill — for rows inside dense lists. */
  flat?: boolean;
  /** 1px hero-gradient edge. Hero surfaces only (deck card, match sheet, own-profile header). */
  luminous?: boolean;
}

/** Layout props that position/size the CARD AS A WHOLE. In `luminous` mode these must
 * land on the outer LinearGradient wrapper, not the inner surface — otherwise e.g. a
 * caller's `marginTop` pushes the inner white surface down *inside* the gradient
 * border, exposing a thick gradient slab above it instead of a uniform 1px edge. */
const WRAPPER_STYLE_KEYS = [
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
  "marginHorizontal", "marginVertical",
  "alignSelf", "flex", "width", "maxWidth",
] as const satisfies readonly (keyof ViewStyle)[];

export function Card({ children, style, flat, luminous }: CardProps) {
  const { colors, radius, spacing, heroGradient } = useTheme();
  const flatStyle = style ? StyleSheet.flatten(style) : undefined;

  let wrapperStyle: ViewStyle | undefined;
  let innerStyle = flatStyle;
  if (luminous && flatStyle) {
    wrapperStyle = {};
    innerStyle = {};
    for (const key of Object.keys(flatStyle) as (keyof ViewStyle)[]) {
      if ((WRAPPER_STYLE_KEYS as readonly string[]).includes(key)) {
        (wrapperStyle as Record<string, unknown>)[key] = flatStyle[key];
      } else {
        (innerStyle as Record<string, unknown>)[key] = flatStyle[key];
      }
    }
  }

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
        innerStyle,
      ]}
    >
      {children}
    </View>
  );
  if (!luminous) return inner;
  return (
    <LinearGradient {...heroGradient} style={[{ borderRadius: radius.card, padding: 1 }, wrapperStyle]}>
      {inner}
    </LinearGradient>
  );
}
