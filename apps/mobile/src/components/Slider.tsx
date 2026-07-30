import { useEffect, useState } from "react";
import { type LayoutChangeEvent, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

interface SliderProps {
  /** 0-100. */
  value: number;
  onChange: (value: number) => void;
  leftLabel: string;
  rightLabel: string;
}

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 6;

function clamp(n: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(n, min), max);
}

/** A drag-to-set 0-100 slider, built on gesture-handler + Reanimated (the same stack
 * SwipeCard already uses) instead of pulling in a native slider dependency. */
export function Slider({ value, onChange, leftLabel, rightLabel }: SliderProps) {
  const { colors, spacing } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useSharedValue(0);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (trackWidth > 0 && !dragging.value) {
      position.value = withTiming((clamp(value, 0, 100) / 100) * trackWidth, { duration: 150 });
    }
  }, [value, trackWidth, position, dragging]);

  function handleLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  function commit(pct: number) {
    onChange(Math.round(pct));
  }

  const pan = Gesture.Pan()
    .onBegin((e) => {
      dragging.value = true;
      position.value = clamp(e.x, 0, trackWidth);
    })
    .onUpdate((e) => {
      position.value = clamp(e.x, 0, trackWidth);
    })
    .onEnd(() => {
      const pct = trackWidth > 0 ? (position.value / trackWidth) * 100 : 0;
      runOnJS(commit)(pct);
      dragging.value = false;
    });

  const fillStyle = useAnimatedStyle(() => ({ width: position.value }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value - THUMB_SIZE / 2 }] }));

  return (
    <View style={{ gap: spacing.xs }}>
      <GestureDetector gesture={pan}>
        <View
          onLayout={handleLayout}
          style={{ height: THUMB_SIZE, justifyContent: "center" }}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <View
            style={{
              height: TRACK_HEIGHT,
              borderRadius: TRACK_HEIGHT / 2,
              backgroundColor: colors.surfaceAlt,
              overflow: "hidden",
            }}
          >
            <Animated.View style={[{ height: TRACK_HEIGHT, backgroundColor: colors.brand }, fillStyle]} />
          </View>
          <Animated.View
            style={[
              {
                position: "absolute",
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_SIZE / 2,
                backgroundColor: colors.brand,
                borderWidth: 2,
                borderColor: colors.surface,
              },
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{leftLabel}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{rightLabel}</Text>
      </View>
    </View>
  );
}
