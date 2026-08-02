import { View } from "react-native";

import { Chip } from "@/components/Chip";
import { SectionLabel } from "@/components/SectionLabel";
import { useTheme } from "@/theme/useTheme";

/** Shows & movies: a plain wrap of default-tone chips, same idiom as Games. */
export function ShowsSection({ shows }: { shows: string[] }) {
  const { spacing } = useTheme();

  if (shows.length === 0) return null;

  return (
    <View>
      <SectionLabel>Shows & Movies</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {shows.map((show) => (
          <Chip key={show} label={show} />
        ))}
      </View>
    </View>
  );
}
