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
 * The brand mark: an O-ring and a Q-ring — the duo, locked. The Q is a
 * round-capped arc opening toward the O; one ink at two strengths, so the
 * mark sits on any surface and any colorway. Geometry mirrors
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
// True chain interlock: full Q circle under the O, then the Q's
// bottom-crossing segment repainted on top (butt caps — the ends land on the
// visible Q band in the same color, so the joins are seamless). Crossings sit
// at ±acos(-D/2R) = ±138.6° off the Q's leftward axis; the overlay spans ±27.5° (full band width of the lens, not just centerline).
const SEG_S = ((138.59 - 27.5) * Math.PI) / 180;
const SEG_E = ((138.59 + 27.5) * Math.PI) / 180;
const SEG_PATH = `M ${CXB + R * Math.cos(SEG_S)} ${CY + R * Math.sin(SEG_S)} A ${R} ${R} 0 0 1 ${CXB + R * Math.cos(SEG_E)} ${CY + R * Math.sin(SEG_E)}`;

/** Solid 58% blend of ink toward the field — the weave paints the Q OVER the O
 * at one crossing, so translucency would tint instead of cover. */
function mix(fg: string, bg: string, t: number) {
  const c = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const ch = (i: number) => Math.round(c(fg, i) * t + c(bg, i) * (1 - t));
  return `rgb(${ch(1)},${ch(3)},${ch(5)})`;
}
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
