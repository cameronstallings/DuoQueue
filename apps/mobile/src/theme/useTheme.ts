import { useColorScheme } from "react-native";

import { useThemeStore } from "@/store/theme-store";

import { darkColors, lightColors, radius, shadow, spacing, type } from "./tokens";

export function useTheme() {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const scheme = preference === "system" ? (systemScheme ?? "light") : preference;
  const colors = scheme === "dark" ? darkColors : lightColors;
  return { colors, spacing, radius, shadow: shadow(scheme), scheme, type } as const;
}
