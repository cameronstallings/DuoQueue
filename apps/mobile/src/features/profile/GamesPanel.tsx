import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { SectionLabel } from "@/components/SectionLabel";
import { SKILL_LABELS } from "@/features/onboarding/profile-labels";
import { useTheme } from "@/theme/useTheme";

import { GAMES_PREVIEW_COUNT, gameRowValue, showAllLabel } from "./profileTab";
import type { EditableGame } from "./useEditableProfileDetails";

const ROW_INSET = 14;

/** One panel of 44pt rows with inset seams: name left, rank or skill right. */
export function GamesPanel({ games, verifiedByName }: { games: EditableGame[]; verifiedByName: Record<string, string> }) {
  const { colors, radius, spacing, type } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? games : games.slice(0, GAMES_PREVIEW_COUNT);
  const hidden = games.length - shown.length;

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <SectionLabel>Games</SectionLabel>
        <Text style={[type.tick, { color: colors.textMuted }]}>{games.length}</Text>
      </View>
      <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: colors.cardEdge, backgroundColor: colors.cardPanel }}>
        {shown.map((game, i) => {
          const value = gameRowValue(game, verifiedByName[game.name] ?? null, SKILL_LABELS);
          return (
            <View
              key={game.gameId}
              accessible
              accessibilityLabel={`${game.name}, ${value}`}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginHorizontal: ROW_INSET,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.cardEdge,
              }}
            >
              <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                {game.name}
              </Text>
              <Text style={[type.chipText, { color: colors.textMuted, maxWidth: "45%" }]} numberOfLines={1}>
                {value}
              </Text>
            </View>
          );
        })}
        {hidden > 0 && (
          <Pressable
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
            accessibilityLabel={`Show all ${games.length} games`}
            style={{
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              marginHorizontal: ROW_INSET,
              borderTopWidth: 1,
              borderTopColor: colors.cardEdge,
            }}
          >
            <Text style={[type.label, { color: colors.voltDim }]}>{showAllLabel(games.length)}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
