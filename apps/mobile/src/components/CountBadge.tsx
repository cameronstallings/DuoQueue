import type { ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { quickEntering, quickExiting } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

interface CountBadgeProps {
  count: number;
  /** Above this it reads "{max}+". */
  max?: number;
  /** Where it sits. The caller positions it absolutely over the corner of the thing it counts
   * (top -6, right -10), so it takes no width in the row. */
  style?: ViewStyle;
}

/**
 * A small volt count on the deck header: the Power-Up rocket's credits here, and Group Q's
 * Requests link. Nothing at 0.
 *
 * Why it exists. The deck header is measured, not guessed (see Group Q's deckHeaderFit.ts):
 * "Requests (9+)" written out as text is 89pt, and with the rocket and its number beside it the
 * row overflows a 375pt phone. As badges, both counts stop taking row width, and a count changing
 * never shoves the links next to it.
 *
 * Built like the tab bar's badge: a dot-like round count (radius.round is allowed for dots), volt
 * fill with onVolt mono digits (`type.tick`; an audited pair). The digits are keyed, so a new
 * count cross-fades instead of snapping, and the badge itself fades in and out.
 */
export function CountBadge({ count, max = 9, style }: CountBadgeProps) {
  const { colors, radius, type } = useTheme();
  if (!(count > 0)) return null;
  const text = count > max ? `${max}+` : String(Math.floor(count));

  return (
    <Animated.View
      pointerEvents="none"
      entering={quickEntering()}
      exiting={quickExiting()}
      style={[
        {
          minWidth: 14,
          height: 14,
          paddingHorizontal: 3,
          borderRadius: radius.round,
          backgroundColor: colors.volt,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Animated.Text
        key={text}
        entering={quickEntering()}
        exiting={quickExiting()}
        maxFontSizeMultiplier={1.2}
        style={[type.tick, { color: colors.onVolt, textAlign: "center" }]}
      >
        {text}
      </Animated.Text>
    </Animated.View>
  );
}
