import { Text } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface LogoProps {
  width?: number;
  /** `mark` is the compact DQ lettermark; `wordmark` spells the name out. */
  variant?: "mark" | "wordmark";
}

/**
 * The logo is drawn, not shipped as a bitmap.
 *
 * Aurora drops the old two-plate misregistration gag (that was a Cartridge-era
 * signature, and it fought the glow-based depth system everywhere else). What's
 * left is a single line of Unbounded, set lowercase for the wordmark — a
 * heavyweight display face read in lowercase is distinctive on its own, no trick
 * needed — with the "Q" / "queue" half carrying the accent color as a nested
 * `Text` span so the pairing idea (two halves, one word) survives in the type
 * itself instead of in a printing-press effect.
 */
export function Logo({ width = 64, variant = "mark" }: LogoProps) {
  const { colors, fonts } = useTheme();

  // Unbounded runs wide, so the wordmark needs a much smaller ratio to fit the same box.
  const fontSize = variant === "mark" ? width * 0.52 : width * 0.145;

  const base = {
    fontFamily: fonts.displayBold,
    fontSize,
    lineHeight: fontSize * 1.16,
    color: colors.text,
  } as const;

  return (
    <Text
      accessibilityRole="image"
      accessibilityLabel="DuoQueue"
      allowFontScaling={false}
      style={[base, { alignSelf: "flex-start" }]}
    >
      {variant === "mark" ? (
        <>
          D<Text style={{ color: colors.accent }}>Q</Text>
        </>
      ) : (
        <>
          duo<Text style={{ color: colors.accent }}>queue</Text>
        </>
      )}
    </Text>
  );
}
