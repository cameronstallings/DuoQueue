import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { useTheme } from "@/theme/useTheme";

interface AuroraBackgroundProps {
  variant?: "default" | "match" | "solar";
}

/** Two soft radial washes — violet upper-left, pink lower-right (gold pair for solar).
 * Fixed geometry per variant; background only, content never sits inside a gradient. */
export function AuroraBackground({ variant = "default" }: AuroraBackgroundProps) {
  const { colors, scheme } = useTheme();
  // Not colors.heroA/heroB: those were darkened for onFill text contrast (contrast
  // audit, task 23). These washes are pure background — content never sits inside a
  // gradient — so they deliberately keep the brighter hue-true pink/violet.
  const a = variant === "solar" ? colors.solarB : scheme === "dark" ? "#8B5CF6" : "#7C3AED";
  const b = variant === "solar" ? colors.solarA : scheme === "dark" ? "#FF6EC7" : "#E0479E";
  const opacity = scheme === "dark" ? (variant === "solar" ? 0.30 : 0.34) : 0.14;
  // match: the two washes sit close, about to merge behind the avatars.
  const posA = variant === "match" ? { cx: "35%", cy: "42%" } : { cx: "12%", cy: "8%" };
  const posB = variant === "match" ? { cx: "65%", cy: "46%" } : { cx: "92%", cy: "94%" };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="aurA"><Stop offset="0" stopColor={a} stopOpacity={opacity} /><Stop offset="1" stopColor={a} stopOpacity="0" /></RadialGradient>
          <RadialGradient id="aurB"><Stop offset="0" stopColor={b} stopOpacity={opacity * 0.75} /><Stop offset="1" stopColor={b} stopOpacity="0" /></RadialGradient>
        </Defs>
        <Ellipse {...posA} rx="70%" ry="45%" fill="url(#aurA)" />
        <Ellipse {...posB} rx="65%" ry="42%" fill="url(#aurB)" />
      </Svg>
    </View>
  );
}
