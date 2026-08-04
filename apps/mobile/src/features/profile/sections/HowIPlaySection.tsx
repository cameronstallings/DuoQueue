import { View } from "react-native";

import { Chip } from "@/components/Chip";
import { SectionLabel } from "@/components/SectionLabel";
import { useTheme } from "@/theme/useTheme";

/**
 * Platforms and playstyles in one shared wrap — platform chips carry the default
 * tone, playstyle chips carry volt, so the two families stay visually distinct
 * without needing a rule or a second heading between them.
 */
export function HowIPlaySection({ platforms, playstyles }: { platforms: string[]; playstyles: string[] }) {
  const { spacing } = useTheme();

  if (platforms.length === 0 && playstyles.length === 0) return null;

  return (
    <View>
      <SectionLabel>How I Play</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {platforms.map((platform) => (
          <Chip key={`platform-${platform}`} label={platform} tone="default" />
        ))}
        {playstyles.map((playstyle) => (
          <Chip key={`playstyle-${playstyle}`} label={playstyle} tone="volt" />
        ))}
      </View>
    </View>
  );
}
