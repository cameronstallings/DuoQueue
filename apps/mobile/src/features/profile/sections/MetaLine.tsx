import { Text } from "react-native";

import { useTheme } from "@/theme/useTheme";

/**
 * The one-line "region · languages · play window" summary that sits under a name.
 * Not a section (no SectionLabel) — just a muted caption joining whichever parts
 * are actually present.
 */
export function MetaLine({
  region,
  languages,
  playWindow,
}: {
  region?: string | null;
  languages?: string[] | null;
  playWindow?: string | null;
}) {
  const { colors, type } = useTheme();

  const parts = [region, languages && languages.length > 0 ? languages.join(", ").toUpperCase() : null, playWindow]
    .filter((part): part is string => !!part);

  if (parts.length === 0) return null;

  return <Text style={[type.caption, { color: colors.textMuted }]}>{parts.join(" · ")}</Text>;
}
