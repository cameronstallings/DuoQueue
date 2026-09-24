import { Text, View } from "react-native";

import { SectionLabel } from "@/components/SectionLabel";
import { useTheme } from "@/theme/useTheme";

import type { HowIPlayTile } from "./howIPlay";

/** A 2x2 grid of panel tiles. flexBasis 45% + flexGrow puts two on a row and lets an odd last
 * tile take the full width; tiles on one row stretch to the taller one. */
export function HowIPlayGrid({ tiles }: { tiles: HowIPlayTile[] }) {
  const { colors, fonts, radius, spacing, type } = useTheme();

  return (
    <View>
      <SectionLabel>How I play</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {tiles.map((tile) => (
          <View
            key={tile.key}
            accessible
            accessibilityLabel={tile.accessibilityLabel}
            style={{
              flexBasis: "45%",
              flexGrow: 1,
              minHeight: 76,
              padding: spacing.tight,
              gap: 2,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.cardEdge,
              backgroundColor: colors.cardPanel,
            }}
          >
            <Text style={[type.tick, { color: colors.textMuted }]}>{tile.label}</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 23, color: colors.text }}
            >
              {tile.value}
            </Text>
            {tile.caption ? (
              <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.textMuted }}>
                {tile.caption}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
