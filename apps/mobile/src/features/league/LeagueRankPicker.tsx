import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import {
  isLolDivisionalTier,
  LOL_DIVISION_LABELS,
  LOL_DIVISIONS_LOW_TO_HIGH,
  LOL_TIER_CHOICES,
  LOL_TIER_LABELS,
  lolDuoRuleSummary,
  type LolDivision,
  type LolTierChoice,
} from "@duoqueue/shared-types";

import { ChipSelect } from "@/components/ChipSelect";
import { SectionLabel } from "@/components/SectionLabel";
import { layoutTransition, quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import {
  legacyLolRankText,
  removeLegacyRankText,
  selectLolDivision,
  selectLolTier,
  type LeagueRankValue,
} from "./rankPickerState";

const TIER_OPTIONS = LOL_TIER_CHOICES.map((value) => ({ value, label: LOL_TIER_LABELS[value] }));

type DivisionKey = "1" | "2" | "3" | "4";
const DIVISION_OPTIONS: { value: DivisionKey; label: string }[] = LOL_DIVISIONS_LOW_TO_HIGH.map((d) => ({
  value: String(d) as DivisionKey,
  label: LOL_DIVISION_LABELS[d],
}));

/**
 * The League of Legends Ranked Solo/Duo rank, picked from Riot's ladder instead of typed. Shown
 * inline in the League game's card in onboarding and Edit details, in place of the free-text rank
 * field; every other game keeps that field. Plain text only: no emblems, tier icons or Riot
 * colours (design section 10.1).
 *
 * Controlled: the parent owns the value and applies `onChange`. The rules (what a tap does, what
 * gets sent) live in rankPickerState.ts, where they are unit-tested.
 */
export function LeagueRankPicker({
  value,
  onChange,
}: {
  value: LeagueRankValue;
  onChange: (next: LeagueRankValue) => void;
}) {
  const { colors, spacing, type } = useTheme();

  const tier = value.lolTier;
  const summary = tier === null ? null : lolDuoRuleSummary({ tier, division: value.lolDivision });
  const legacyText = legacyLolRankText(value);

  // The division row comes and goes with the tier (Master and above have none), so it fades and
  // the rows under it glide rather than jump (1.0.2).
  return (
    <Animated.View layout={layoutTransition()} style={{ gap: spacing.sm }}>
      <SectionLabel>Solo/Duo rank</SectionLabel>

      <ChipSelect<LolTierChoice>
        options={TIER_OPTIONS}
        selected={tier === null ? [] : [tier]}
        onToggle={(next) => onChange(selectLolTier(value, next))}
      />

      {isLolDivisionalTier(tier) && (
        <Animated.View entering={revealEntering()} exiting={quickExiting()}>
          <ChipSelect<DivisionKey>
            options={DIVISION_OPTIONS}
            selected={value.lolDivision === null ? [] : [String(value.lolDivision) as DivisionKey]}
            onToggle={(next) => onChange(selectLolDivision(value, Number(next) as LolDivision))}
          />
        </Animated.View>
      )}

      {summary && (
        <Animated.Text layout={layoutTransition()} style={[type.caption, { color: colors.textMuted }]}>
          {summary}
        </Animated.Text>
      )}

      {legacyText !== null && (
        <View style={{ gap: spacing.xs }}>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {`You wrote "${legacyText}". Pick your rank from the list so we can show who you can duo with.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove "${legacyText}"`}
            onPress={() => onChange(removeLegacyRankText(value))}
            hitSlop={8}
            style={{ alignSelf: "flex-start" }}
          >
            <Text style={[type.caption, { color: colors.danger }]}>Remove</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}
