import { Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface LogoProps {
  width?: number;
  /** `mark` is the compact DQ lettermark; `wordmark` spells the name out. */
  variant?: "mark" | "wordmark";
}

/**
 * The logo is drawn, not shipped as a bitmap.
 *
 * The old mark was a flat PNG from the previous design, so it kept its own colour and
 * weight while everything around it changed — and it could not respond to light/dark.
 * Setting it in the same Bungee face the app already loads means the identity comes
 * from the type system rather than sitting next to it.
 *
 * The two offset plates are the app's signature move: a red and a cyan impression
 * slightly out of register behind the black one, the way a cheap print run misaligns.
 * It is also the idea of the product in one image — two plates, one picture, neither
 * complete on its own.
 */
export function Logo({ width = 64, variant = "mark" }: LogoProps) {
  const { colors, fonts } = useTheme();

  const text = variant === "mark" ? "DQ" : "DUOQUEUE";
  // Bungee is wide, so the wordmark needs a much smaller ratio to fit the same box.
  const fontSize = variant === "mark" ? width * 0.62 : width * 0.155;
  const offset = Math.max(1, Math.round(fontSize * 0.055));

  const base = {
    fontFamily: fonts.marquee,
    fontSize,
    lineHeight: fontSize * 1.16,
    letterSpacing: variant === "mark" ? fontSize * 0.02 : fontSize * 0.06,
  } as const;

  return (
    <View accessibilityRole="image" accessibilityLabel="DuoQueue" style={{ alignSelf: "flex-start" }}>
      {/* Two mis-registered plates, then the solid impression on top. */}
      <Text
        style={[base, { color: colors.brand, position: "absolute", left: -offset, top: -offset }]}
        allowFontScaling={false}
      >
        {text}
      </Text>
      <Text
        style={[base, { color: colors.accent, position: "absolute", left: offset, top: offset }]}
        allowFontScaling={false}
      >
        {text}
      </Text>
      <Text style={[base, { color: colors.text }]} allowFontScaling={false}>
        {text}
      </Text>
    </View>
  );
}
