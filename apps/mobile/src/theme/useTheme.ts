import { useColorScheme } from "react-native";

import { useThemeStore } from "@/store/theme-store";

import {
  darkColors,
  fonts,
  foil,
  lightColors,
  motion,
  pressedOffset,
  radius,
  SCRIM_RGB,
  shadow,
  shadowLifted,
  spacing,
  type,
} from "./tokens";

export function useTheme() {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const scheme = preference === "system" ? (systemScheme ?? "light") : preference;
  const colors = scheme === "dark" ? darkColors : lightColors;
  return {
    colors,
    spacing,
    radius,
    shadow: shadow(scheme),
    shadowLifted: shadowLifted(scheme),
    pressedOffset,
    scheme,
    type,
    fonts,
    foil,
    motion,
    scrimRgb: SCRIM_RGB,
  } as const;
}
