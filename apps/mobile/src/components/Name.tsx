import { Text, type TextProps, type TextStyle } from "react-native";

import { useTheme } from "@/theme/useTheme";

/** Type scale entries that can render a user-authored name. */
type NameVariant = "cardName" | "screenTitle" | "title" | "bodyStrong" | "body";

interface NameProps extends Omit<TextProps, "style"> {
  children: string;
  /** Named `variant` rather than `role` — `role` is React Native's accessibility prop. */
  variant?: NameVariant;
  style?: TextStyle | TextStyle[];
}

/**
 * Latin, plus the marks and punctuation that legitimately appear inside Latin
 * names (combining accents, apostrophes, hyphens, spaces, digits).
 */
const LATIN_SAFE = /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]*$/u;

/**
 * Renders a name a user typed.
 *
 * Archivo covers Latin, Latin-Ext and Vietnamese — and nothing else. The app
 * offers twenty spoken languages including Russian, Japanese, Korean, Chinese,
 * Arabic and Hindi, so a real share of display names contain glyphs the face
 * does not have. React Native has no font-stack fallback: naming a missing
 * family does not cascade, it renders tofu or silently substitutes with the
 * wrong metrics.
 *
 * So for non-Latin strings we drop `fontFamily` only, and keep the size,
 * line-height and letter-spacing. The OS font handles the glyphs, and the name
 * still sits correctly in the layout it was designed for.
 */
export function Name({ children, variant = "cardName", style, ...rest }: NameProps) {
  const { type } = useTheme();
  const variantStyle = type[variant] as TextStyle;

  if (LATIN_SAFE.test(children)) {
    return (
      <Text style={[variantStyle, style]} {...rest}>
        {children}
      </Text>
    );
  }

  const { fontFamily: _dropped, ...metrics } = variantStyle;
  return (
    <Text style={[metrics, style]} {...rest}>
      {children}
    </Text>
  );
}
