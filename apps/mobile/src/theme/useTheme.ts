import { useColorScheme } from "react-native";

import { useThemeStore } from "@/store/theme-store";

import {
  darkColors, fonts, foil, glow, hairline, heroGradient, lightColors, motion,
  pressedOffset, radius, SCRIM_RGB, shadow, shadowLifted, solarGradient, spacing, type,
} from "./tokens";

export function useTheme() {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  // Aurora is dark-first: an unreadable system scheme resolves dark.
  const scheme = preference === "system" ? (systemScheme ?? "dark") : preference;
  const colors = scheme === "dark" ? darkColors : lightColors;
  return {
    colors, spacing, radius, scheme, type, fonts, motion,
    glow,
    heroGradient: heroGradient(colors),
    solarGradient: solarGradient(colors),
    scrimRgb: SCRIM_RGB,
    // Compat (all inert or deprecated — see tokens.ts):
    shadow: shadow(scheme), shadowLifted: shadowLifted(scheme), pressedOffset, hairline, foil,
  } as const;
}
