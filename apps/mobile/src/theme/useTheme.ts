import { useColorScheme } from "react-native";

import { useThemeStore } from "@/store/theme-store";

import {
  darkColors, fonts, glow, hairline, heroGradient, lightColors, motion,
  radius, SCRIM_RGB, solarGradient, spacing, type,
} from "./tokens";

export function useTheme() {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  // Volt is dark-first: an unreadable system scheme resolves dark.
  const scheme = preference === "system" ? (systemScheme ?? "dark") : preference;
  const colors = scheme === "dark" ? darkColors : lightColors;
  return {
    colors, spacing, radius, scheme, type, fonts, motion, hairline,
    glow,
    heroGradient: heroGradient(colors),
    solarGradient: solarGradient(colors),
    scrimRgb: SCRIM_RGB,
  } as const;
}
