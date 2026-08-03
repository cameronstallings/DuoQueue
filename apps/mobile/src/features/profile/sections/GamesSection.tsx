import { View } from "react-native";

import { Chip } from "@/components/Chip";
import { SectionLabel } from "@/components/SectionLabel";
import { useTheme } from "@/theme/useTheme";

/**
 * The games grid: one chip per game, the rank (or, failing that, the skill level)
 * riding along as the chip's detail text. Shared verbatim by the own-profile screen
 * and the stranger-profile detail view so a game reads the same in either place.
 *
 * When a game has a platform-verified stat (rank or playtime, keyed by game name —
 * see useVerifiedStats), it wins over the self-reported rank/skill entirely: the chip
 * shows a checkmark-prefixed verified value in accent tone instead. Absent an entry,
 * rendering is byte-for-byte what it was before verified stats existed.
 */
export function GamesSection({
  games,
  verifiedByName,
}: {
  games: { name: string; skillLevel?: string | null; rank?: string | null }[];
  verifiedByName?: Record<string, string>;
}) {
  const { spacing } = useTheme();

  if (games.length === 0) return null;

  return (
    <View>
      <SectionLabel>Games</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {games.map((game) => {
          const verified = verifiedByName?.[game.name];
          if (verified) {
            return <Chip key={game.name} label={game.name} detail={`✓ ${verified}`} tone="accent" />;
          }
          return <Chip key={game.name} label={game.name} detail={game.rank ?? game.skillLevel ?? undefined} />;
        })}
      </View>
    </View>
  );
}
