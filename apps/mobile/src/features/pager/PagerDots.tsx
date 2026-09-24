import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

import { DOT_GAP, DOT_SIZE, dotLight, pagerA11yValue } from "./pagerMath";
import type { PagerController } from "./usePager";

/** A hollow textMuted ring with a volt fill laid over it, faded by the pager's offset: on and off
 * differ in fill, not only lightness, and the light passes from dot to dot under the finger. */
function Dot({ index, pager }: { index: number; pager: PagerController }) {
  const { colors } = useTheme();
  const { scrollX, width } = pager;
  const fill = useAnimatedStyle(() => ({ opacity: dotLight(scrollX.value, index, width) }));

  return (
    <View
      style={{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, borderWidth: 1, borderColor: colors.textMuted }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            top: -1,
            left: -1,
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            backgroundColor: colors.volt,
          },
          fill,
        ]}
      />
    </View>
  );
}

/**
 * Where you are, and VoiceOver's way through: with no Continue buttons, the dot row is one
 * adjustable element ("Page, 1 of 3") that a swipe up or down turns.
 */
export function PagerDots({ pager, label }: { pager: PagerController; label: string }) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={pagerA11yValue(pager.page, pager.count)}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => pager.adjust(event.nativeEvent.actionName)}
      style={{ flexDirection: "row", gap: DOT_GAP, alignItems: "center", justifyContent: "center", paddingVertical: 8 }}
    >
      {Array.from({ length: pager.count }, (_, i) => (
        <Dot key={i} index={i} pager={pager} />
      ))}
    </View>
  );
}
