import { View } from "react-native";

import { Chip } from "@/components/Chip";
import { SectionLabel } from "@/components/SectionLabel";
import { useTheme } from "@/theme/useTheme";

/**
 * The games grid: one chip per game, the rank (or, failing that, the skill level)
 * riding along as the chip's detail text. Shared verbatim by the own-profile screen
 * and the stranger-profile detail view so a game reads the same in either place.
 */
export function GamesSection({
  games,
}: {
  games: { name: string; skillLevel?: string | null; rank?: string | null }[];
}) {
  const { spacing } = useTheme();

  if (games.length === 0) return null;

  return (
    <View>
      <SectionLabel>Games</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {games.map((game) => (
          <Chip key={game.name} label={game.name} detail={game.rank ?? game.skillLevel ?? undefined} />
        ))}
      </View>
    </View>
  );
}
