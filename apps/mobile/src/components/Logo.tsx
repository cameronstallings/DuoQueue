import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import {
  CXA,
  CXB,
  CY,
  LOGO_MARK_ASPECT,
  mix,
  NUB,
  R,
  SEG_PATH,
  VB_H,
  VB_W,
  VB_X,
  VB_Y,
  W,
} from "@/theme/logo-geometry";
import { useTheme } from "@/theme/useTheme";

// Re-exported from its old home: the geometry moved to @/theme/logo-geometry (a
// zero-import module the marketing video project can bundle too), and this keeps
// `@/components/Logo`'s public surface exactly what it was.
export { LOGO_MARK_ASPECT };

interface LogoProps {
  width?: number;
  /** `mark` is the interlocked-rings monogram; `wordmark` spells the name out;
   * `lockup` stacks the mark over the wordmark for hero placements. */
  variant?: "mark" | "wordmark" | "lockup";
}

function LogoMark({ width }: { width: number }) {
  const { colors } = useTheme();
  // Deliberately hue-free (the mark doubles as the umbrella company brand):
  // one ink at two strengths — text color full for the front ring, a solid 58%
  // field-blend for the Q — so it sits on Volt and any future colorway alike.
  const ink = colors.text;
  const duo = mix(colors.text, colors.background, 0.58);

  return (
    <View accessibilityRole="image" accessibilityLabel="DuoQueue">
      <Svg width={width} height={width * LOGO_MARK_ASPECT} viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}>
        <Circle cx={CXB} cy={CY} r={R} fill="none" stroke={duo} strokeWidth={W} />
        <Circle cx={NUB.cx} cy={NUB.cy} r={NUB.r} fill={duo} />
        <Circle cx={CXA} cy={CY} r={R} fill="none" stroke={ink} strokeWidth={W} />
        <Path d={SEG_PATH} fill="none" stroke={duo} strokeWidth={W} />
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
