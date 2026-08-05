import { Text, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import { useTheme } from "@/theme/useTheme";

interface LogoProps {
  width?: number;
  /** `mark` is the interlocked-rings monogram; `wordmark` spells the name out;
   * `lockup` stacks the mark over the wordmark for hero placements. */
  variant?: "mark" | "wordmark" | "lockup";
}

/**
 * The brand mark: an O-ring and a Q-ring woven together — the duo, locked.
 * The Q is a round-capped arc opening toward the O; one ink, two strengths.
 * mask, so the mark sits on any surface. Geometry mirrors
 * scripts/generate-app-icons.mjs (the icon set's source of truth) — keep the
 * constants in sync when tuning either.
 */
const CANVAS = 1024;
const R = CANVAS * 0.21;
const W = R * 0.46;
const D = R * 1.5;
const NUDGE = CANVAS * 0.012;
const CY = CANVAS / 2;
const CXA = CY - NUDGE - D / 2;
const CXB = CY - NUDGE + D / 2;
const NUB_DIST = R + W * 0.42;
const NUB = {
  cx: CXB + NUB_DIST * Math.SQRT1_2,
  cy: CY + NUB_DIST * Math.SQRT1_2,
  r: W * 0.56,
};
// The Q is a true arc with round end-caps — ±103° off the leftward axis leaves
// the breathing gap toward the O without any flat mask-cut edges.
const ARC = (103 * Math.PI) / 180;
const Q_PATH = `M ${CXB + R * Math.cos(-ARC)} ${CY + R * Math.sin(-ARC)} A ${R} ${R} 0 1 1 ${CXB + R * Math.cos(ARC)} ${CY + R * Math.sin(ARC)}`;
const PAD = 4;
const VB_X = CXA - R - W / 2 - PAD;
const VB_Y = CY - R - W / 2 - PAD;
const VB_W = Math.max(CXB + R + W / 2, NUB.cx + NUB.r) - VB_X + PAD;
const VB_H = CY + R + W / 2 - VB_Y + PAD;
/** Height-per-width of the cropped mark. */
export const LOGO_MARK_ASPECT = VB_H / VB_W;

function LogoMark({ width }: { width: number }) {
  const { colors } = useTheme();
  // Deliberately hue-free (the mark doubles as the umbrella company brand):
  // one ink at two strengths — text color full for the front ring, ~58% for
  // the Q ring — so it sits on Volt and on any future app's colorway alike.
  const ink = colors.text;

  return (
    <View accessibilityRole="image" accessibilityLabel="DuoQueue">
      <Svg width={width} height={width * LOGO_MARK_ASPECT} viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}>
        <G opacity={0.58}>
          <Path d={Q_PATH} fill="none" stroke={ink} strokeWidth={W} strokeLinecap="round" />
          <Circle cx={NUB.cx} cy={NUB.cy} r={NUB.r} fill={ink} />
        </G>
        <Circle cx={CXA} cy={CY} r={R} fill="none" stroke={ink} strokeWidth={W} />
      </Svg>
    </View>
  );
}

export function Logo({ width = 64, variant = "mark" }: LogoProps) {
  const { colors, fonts, spacing } = useTheme();

  if (variant === "mark") {
    return <LogoMark width={width} />;
  }

  // Unbounded runs wide, so the wordmark needs a small ratio to fit the box.
  const fontSize = width * 0.145;
  const wordmark = (
    <Text
      accessibilityRole="image"
      accessibilityLabel="DuoQueue"
      allowFontScaling={false}
      style={{
        fontFamily: fonts.displayBold,
        fontSize,
        lineHeight: fontSize * 1.16,
        color: colors.text,
        letterSpacing: fontSize * 0.02,
      }}
    >
      duoqueue
    </Text>
  );

  if (variant === "wordmark") {
    return <View style={{ alignSelf: "flex-start" }}>{wordmark}</View>;
  }

  // lockup: mark above wordmark, both centered.
  return (
    <View style={{ alignItems: "center", gap: spacing.md }}>
      <LogoMark width={width * 0.5} />
      {wordmark}
    </View>
  );
}
