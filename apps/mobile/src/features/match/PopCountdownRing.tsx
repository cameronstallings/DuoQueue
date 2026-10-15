import { StyleSheet, Text, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { CXA, CY, LOGO_MARK_ASPECT, R, VB_H, VB_W, VB_X, VB_Y, W } from "@/theme/logo-geometry";
import { useTheme } from "@/theme/useTheme";

import { countdownFraction, formatClock, oRingCentre, oRingInnerDiameter, timeLeftSpoken } from "./matchMoment";

/** The ring's whole length in the viewBox, for the arc's dash. */
const CIRCUMFERENCE = 2 * Math.PI * R;
/** The m:ss inside the ring: type.label at 16/22 with 1pt tracking. "10:00" is 53pt wide at
 * that size, inside the ring's 64.7pt hole at the match screen's 168pt mark (matchMoment.test.ts). */
const TIME_FONT_SIZE = 16;
const TIME_LINE_HEIGHT = 22;

interface PopCountdownRingProps {
  /** The mark's width (RingsLock's), so this draws in the same box and viewBox as the O ring. */
  width: number;
  secondsLeft: number;
  totalSeconds: number;
  /** The full volt O over the countdown (0 while counting, 1 once the ring has closed). */
  closed: SharedValue<number>;
  /** The draining volt arc (faded out when the Pop is over). */
  arc: SharedValue<number>;
  /** The m:ss in the middle (faded out when the ring closes or the Pop is over). */
  time: SharedValue<number>;
}

/**
 * The Duo Pop's ten minutes, drawn as the logo's own O ring, under the ink O in RingsLock's O
 * layer (its `oOverlay`), so when the ring closes and slides into the mark it is already the O.
 * Four layers, bottom to top, each filling the mark's box in RingsLock's viewBox:
 *
 * 1. the track: the O's geometry stroked in the border colour, the part of the ring already spent;
 * 2. the arc: the time left, in volt, from twelve o'clock clockwise. It is a static Circle whose
 *    dash is re-rendered once a second by the parent's tick (no animated SVG props: those run on
 *    the JS thread and stutter), so it steps like a clock rather than sweeping;
 * 3. the closed ring: the whole O in volt, faded in when someone taps I'm in (the drained gap
 *    fills), before the rings slide together;
 * 4. the m:ss, centred in the ring's hole.
 *
 * No glow and no new colours: border and volt on the background are audited pairs. VoiceOver
 * reads it as a timer ("9 minutes 41 seconds left").
 */
export function PopCountdownRing({ width, secondsLeft, totalSeconds, closed, arc, time }: PopCountdownRingProps) {
  const { colors, type } = useTheme();
  const height = width * LOGO_MARK_ASPECT;
  const viewBox = `${VB_X} ${VB_Y} ${VB_W} ${VB_H}`;
  const fraction = countdownFraction(secondsLeft, totalSeconds);
  const centre = oRingCentre(width);
  const hole = oRingInnerDiameter(width);

  const closedStyle = useAnimatedStyle(() => ({ opacity: closed.value }));
  const arcStyle = useAnimatedStyle(() => ({ opacity: arc.value }));
  const timeStyle = useAnimatedStyle(() => ({ opacity: time.value }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={timeLeftSpoken(secondsLeft)}
    >
      <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height} viewBox={viewBox}>
          <Circle cx={CXA} cy={CY} r={R} fill="none" stroke={colors.border} strokeWidth={W} />
        </Svg>
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, arcStyle]}>
        <Svg width={width} height={height} viewBox={viewBox}>
          <Circle
            cx={CXA}
            cy={CY}
            r={R}
            fill="none"
            stroke={colors.volt}
            strokeWidth={W}
            strokeDasharray={[CIRCUMFERENCE * fraction, CIRCUMFERENCE]}
            rotation={-90}
            origin={[CXA, CY]}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, closedStyle]}>
        <Svg width={width} height={height} viewBox={viewBox}>
          <Circle cx={CXA} cy={CY} r={R} fill="none" stroke={colors.volt} strokeWidth={W} />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: centre.x - hole / 2,
            top: centre.y - TIME_LINE_HEIGHT / 2,
            width: hole,
            height: TIME_LINE_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          },
          timeStyle,
        ]}
      >
        <Text
          numberOfLines={1}
          // The hole is a fixed 64.7pt: the clock does not grow with Dynamic Type (VoiceOver has
          // the time in words).
          maxFontSizeMultiplier={1}
          style={{
            ...type.label,
            fontSize: TIME_FONT_SIZE,
            lineHeight: TIME_LINE_HEIGHT,
            letterSpacing: 1,
            color: colors.text,
            textAlign: "center",
          }}
        >
          {formatClock(secondsLeft)}
        </Text>
      </Animated.View>
    </View>
  );
}
