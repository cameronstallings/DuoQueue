export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const type = {
  screenTitle: { fontSize: 28, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "700" },
  bodyStrong: { fontSize: 15, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "400" },
  caption: { fontSize: 13, fontWeight: "500" },
  micro: { fontSize: 11, fontWeight: "700" },
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

const palette = {
  brand: "#7C4DFF",
  brandDark: "#5E35B1",
  danger: "#E5484D",
  success: "#30A46C",
  warning: "#F5A623",
  info: "#2F80ED",
};

export const lightColors = {
  ...palette,
  background: "#FFFFFF",
  surface: "#F5F5F7",
  border: "#E4E4E7",
  text: "#17171A",
  textMuted: "#6B6B72",
} as const;

export const darkColors = {
  ...palette,
  background: "#111113",
  surface: "#1C1C1F",
  border: "#2C2C30",
  text: "#F4F4F5",
  textMuted: "#A1A1AA",
} as const;

export type ThemeColors = typeof lightColors;

/** Soft card elevation, tuned per-scheme since shadows barely read on a dark background. */
export function shadow(scheme: "light" | "dark") {
  return {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: scheme === "light" ? 6 : 3 },
    shadowOpacity: scheme === "light" ? 0.08 : 0.4,
    shadowRadius: scheme === "light" ? 16 : 8,
    elevation: scheme === "light" ? 4 : 2,
  } as const;
}
