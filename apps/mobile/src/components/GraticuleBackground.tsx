import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";

import { useTheme } from "@/theme/useTheme";

interface GraticuleBackgroundProps {
  /** "match" draws slightly stronger lines for the moment screens. */
  variant?: "default" | "match";
}

/** Volt's atmosphere: a static engineering graticule — 24px grid of hairlines with
 * sparse crosshair ticks. Replaces Aurora's drifting washes; grain supplies life. */
export function GraticuleBackground({ variant = "default" }: GraticuleBackgroundProps) {
  const { scheme } = useTheme();
  const strength = variant === "match" ? 1.6 : 1;
  const lineColor = scheme === "dark" ? "rgba(205,255,61," : "rgba(74,107,0,";
  const lineAlpha = (scheme === "dark" ? 0.035 : 0.05) * strength;
  const tickAlpha = (scheme === "dark" ? 0.06 : 0.08) * strength;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="0" x2="24" y2="0" stroke={`${lineColor}${lineAlpha})`} strokeWidth="1" />
            <Line x1="0" y1="0" x2="0" y2="24" stroke={`${lineColor}${lineAlpha})`} strokeWidth="1" />
          </Pattern>
          <Pattern id="ticks" width="96" height="96" patternUnits="userSpaceOnUse">
            <Circle cx="0" cy="0" r="1.2" fill={`${lineColor}${tickAlpha})`} />
            <Circle cx="48" cy="48" r="1.2" fill={`${lineColor}${tickAlpha})`} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grid)" />
        <Rect width="100%" height="100%" fill="url(#ticks)" />
      </Svg>
    </View>
  );
}
