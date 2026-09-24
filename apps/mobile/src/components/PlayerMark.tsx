import { View } from "react-native";

import { initialOf } from "@/lib/initialOf";
import { useTheme } from "@/theme/useTheme";

import { Name } from "./Name";

interface PlayerMarkProps {
  name: string;
  size: number;
  /** "circle" for avatars; "none" for the card's large decorative initial. */
  shape?: "circle" | "none";
  color?: string;
  backgroundColor?: string;
  /** Glyph size as a share of `size`. */
  glyphScale?: number;
}

/**
 * A player's initial, drawn where their picture would be. It is decoration: hidden from screen
 * readers, because the name is always said next to it. Rendered through <Name> so a non-Latin
 * initial falls back to the system font instead of drawing tofu.
 */
export function PlayerMark({ name, size, shape = "circle", color, backgroundColor, glyphScale = 0.42 }: PlayerMarkProps) {
  const { colors } = useTheme();
  const round = shape === "circle";
  const fontSize = Math.max(1, Math.round(size * glyphScale));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : 0,
        overflow: round ? "hidden" : "visible",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: backgroundColor ?? (round ? colors.surfaceAlt : "transparent"),
      }}
    >
      <Name
        variant="screenTitle"
        allowFontScaling={false}
        style={{ fontSize, lineHeight: Math.round(fontSize * 1.2), color: color ?? colors.textMuted }}
      >
        {initialOf(name)}
      </Name>
    </View>
  );
}
