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
 * The redesign before this one dropped the old two-plate misregistration gag (that
 * was a Cartridge-era signature, and it fought the glow-based depth system used
 * everywhere else at the time). What's left is a single line of Unbounded, set
 * lowercase for the wordmark — a
 * heavyweight display face read in lowercase is distinctive on its own, no trick
 * needed. Volt keeps the accent only on the compact "Q" mark — small enough to
 * read as a symbol; the full "queue" half of the wordmark reads as plain ink,
 * same as the rest of the word.
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
    // The mark stays untracked (two letters need no help); the wordmark gets a
    // touch of tracking so "duoqueue" doesn't set too tight at this weight.
    letterSpacing: variant === "wordmark" ? fontSize * 0.02 : 0,
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
          D<Text style={{ color: colors.volt }}>Q</Text>
        </>
      ) : (
        <>
          duo<Text style={{ color: colors.text }}>queue</Text>
        </>
      )}
    </Text>
  );
}
