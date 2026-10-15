import { useEffect } from "react";
import { Text, type TextStyle, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

import { POPPED_FADE_MS, POPPED_ROLL_MS } from "./lockTimeline";
import { poppedInLabel, poppedInSpoken, type RollColumn, rollColumns } from "./matchMoment";

/** type.label at 13/18 with 2pt tracking: "POPPED IN 0:41". */
const FONT_SIZE = 13;
const LINE_HEIGHT = 18;
const LETTER_SPACING = 2;
/** Plex Mono advances 0.6em a glyph, and iOS adds the tracking after each one, so every digit
 * column is exactly one character wide and the rolled time reads as one word with the label. */
const DIGIT_W = FONT_SIZE * 0.6 + LETTER_SPACING;
/** Each digit column's strip: 0 to 9, twice, so the last column can roll a whole extra turn. */
const STRIP = Array.from({ length: 20 }, (_, i) => String(i % 10));

interface PoppedInLineProps {
  /** How long the Duo Pop took to be answered, 1 to 600. */
  seconds: number;
  /** When to start, in ms from mount (lockSchedule's poppedAt). */
  startAt: number;
  reduced: boolean;
  /** The digits have landed (DuoLockedScreen taps a selection haptic here). */
  onLanded?: () => void;
}

/**
 * "POPPED IN 0:41" under DUO LOCKED after a Duo Pop. The line fades in at `startAt` and every digit
 * rolls down its own clipped column, a strip of 0 to 9 twice moved by translateY only, to its
 * digit over POPPED_ROLL_MS; the last column takes one extra turn and calls `onLanded` when it
 * stops. Under Reduce Motion nothing rolls: the label is drawn as it ends, fades in, and
 * `onLanded` is called at once. voltDim on the background (an audited pair); the text does not
 * grow with Dynamic Type, because the columns are cut to one line of it (VoiceOver reads
 * "Popped in 41 seconds").
 */
export function PoppedInLine({ seconds, startAt, reduced, onLanded }: PoppedInLineProps) {
  const { colors, type } = useTheme();
  const opacity = useSharedValue(0);
  const columns = rollColumns(seconds);
  const lastDigit = columns.reduce((last, column, i) => (column.kind === "digit" ? i : last), -1);

  useEffect(() => {
    opacity.value = withDelay(
      reduced ? 0 : startAt,
      withTiming(1, { duration: POPPED_FADE_MS, reduceMotion: ReduceMotion.Never }),
    );
    if (reduced) onLanded?.();
    return () => cancelAnimation(opacity);
    // Once, at mount: the line plays one time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const textStyle: TextStyle = {
    ...type.label,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    letterSpacing: LETTER_SPACING,
    color: colors.voltDim,
  };

  return (
    <Animated.View
      accessible
      accessibilityLabel={poppedInSpoken(seconds)}
      style={[{ flexDirection: "row", alignItems: "center", height: LINE_HEIGHT }, style]}
    >
      {reduced ? (
        <Text style={textStyle} maxFontSizeMultiplier={1}>
          {poppedInLabel(seconds)}
        </Text>
      ) : (
        <>
          <Text style={textStyle} maxFontSizeMultiplier={1}>
            {"Popped in "}
          </Text>
          {columns.map((column, i) =>
            column.kind === "static" ? (
              <Text key={i} style={textStyle} maxFontSizeMultiplier={1}>
                {column.text}
              </Text>
            ) : (
              <DigitColumn
                key={i}
                column={column}
                startAt={startAt}
                textStyle={textStyle}
                onLanded={i === lastDigit ? onLanded : undefined}
              />
            ),
          )}
        </>
      )}
    </Animated.View>
  );
}

function DigitColumn({
  column,
  startAt,
  textStyle,
  onLanded,
}: {
  column: Extract<RollColumn, { kind: "digit" }>;
  startAt: number;
  textStyle: TextStyle;
  onLanded?: () => void;
}) {
  const cells: SharedValue<number> = useSharedValue(0);

  useEffect(() => {
    const landed = onLanded;
    cells.value = withDelay(
      startAt,
      withTiming(column.cells, { duration: POPPED_ROLL_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && landed) runOnJS(landed)();
      }),
    );
    return () => cancelAnimation(cells);
    // Once, at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -cells.value * LINE_HEIGHT }] }));

  return (
    <View style={{ width: DIGIT_W, height: LINE_HEIGHT, overflow: "hidden" }}>
      <Animated.View style={stripStyle}>
        {STRIP.map((digit, i) => (
          <Text key={i} style={textStyle} maxFontSizeMultiplier={1}>
            {digit}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}
