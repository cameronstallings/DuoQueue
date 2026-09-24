import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { SKILL_LEVELS } from "@duoqueue/shared-types";

import { Card } from "@/components/Card";
import { ChipSelect } from "@/components/ChipSelect";
import { TextField } from "@/components/TextField";
import { LeagueRankPicker } from "@/features/league/LeagueRankPicker";
import { useLeagueGameId } from "@/features/league/leagueGame";
import { validateLolRank } from "@/features/league/rankPickerState";
import { CatalogPicker } from "@/features/onboarding/CatalogPicker";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

const SKILL_LABELS: Record<(typeof SKILL_LEVELS)[number], string> = {
  casual: "Casual",
  intermediate: "Intermediate",
  competitive: "Competitive",
  ranked_grinder: "Ranked Grinder",
};

export default function GamesStep() {
  const { colors, spacing, type } = useTheme();
  const session = useSessionStore((s) => s.session);
  const { games, addGame, removeGame, updateGameSkill, updateGameRank, setGameLeagueRank } = useOnboardingStore();
  // League gets the Solo/Duo rank picker instead of the free-text field. Null while loading or if
  // the read fails, and then League keeps the text field like every other game.
  const leagueGameId = useLeagueGameId();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (games.length === 0) {
      setError("Add at least one favorite game.");
      return;
    }
    const league = leagueGameId === null ? undefined : games.find((g) => g.gameId === leagueGameId);
    const rankError = league ? validateLolRank(league) : null;
    if (rankError) {
      setError(rankError);
      return;
    }
    setError(null);
    router.push(nextStepPath("games"));
  }

  if (!session) return null;

  return (
    <WizardStep
      step="games"
      title="What are your favorite games?"
      subtitle="Search and add up to 20. Set a skill level for each."
      onContinue={handleContinue}
      error={error}
    >
      <CatalogPicker
        table="games"
        placeholder="Search games"
        profileId={session.user.id}
        selectedIds={games.map((g) => g.gameId)}
        onSelect={(item) => addGame({ gameId: item.id, name: item.name })}
      />

      <View style={{ gap: spacing.md }}>
        {games.map((game) => (
          <Card key={game.gameId} style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{game.name}</Text>
              <Pressable onPress={() => removeGame(game.gameId)}>
                <Text style={[type.caption, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            </View>
            <ChipSelect
              options={SKILL_LEVELS.map((value) => ({ value, label: SKILL_LABELS[value] }))}
              selected={[game.skillLevel]}
              onToggle={(value) => updateGameSkill(game.gameId, value)}
            />
            {leagueGameId !== null && game.gameId === leagueGameId ? (
              <LeagueRankPicker value={game} onChange={(next) => setGameLeagueRank(game.gameId, next)} />
            ) : (
              <TextField
                label="Rank (optional)"
                value={game.rankText}
                onChangeText={(text) => updateGameRank(game.gameId, text)}
                placeholder="e.g. Diamond II"
              />
            )}
          </Card>
        ))}
      </View>
    </WizardStep>
  );
}
