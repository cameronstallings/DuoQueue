import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import { SKILL_LEVELS } from "@duoqueue/shared-types";

import { Card } from "@/components/Card";
import { ChipSelect } from "@/components/ChipSelect";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { TextField } from "@/components/TextField";
import { GAMES_COPY } from "@/features/auth/frontDoorCopy";
import { LeagueRankPicker } from "@/features/league/LeagueRankPicker";
import { useLeagueGameId } from "@/features/league/leagueGame";
import { validateLolRank } from "@/features/league/rankPickerState";
import { CatalogPicker } from "@/features/onboarding/CatalogPicker";
import { isPendingCustomGame } from "@/features/onboarding/catalogSearch";
import { nextStepPath } from "@/features/onboarding/steps";
import { useQuickPickGames } from "@/features/onboarding/useQuickPickGames";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { hapticLight } from "@/lib/haptics";
import { useOnboardingStore } from "@/store/onboarding-store";
import { layoutTransition, quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

const SKILL_LABELS: Record<(typeof SKILL_LEVELS)[number], string> = {
  casual: "Casual",
  intermediate: "Intermediate",
  competitive: "Competitive",
  ranked_grinder: "Ranked Grinder",
};

/** Roughly the six quick-pick chips' widths, so the row does not reflow when they arrive. */
const QUICK_PICK_SKELETON_WIDTHS = [132, 78, 76, 136, 106, 156] as const;
const CHIP_HEIGHT = 26;

/**
 * Step 5: the games. Works signed out (1.0.2): the catalog is readable before the account exists,
 * a custom game is held as pending until Save (CatalogPicker, catalogSearch.ts), and search goes
 * through `search_games` so "lol" finds League.
 *
 * QUICK PICKS FIRST. Most players play one of a handful of games, and League of Legends is the
 * launch game, so the six most common are one tap each above the search. Picking League opens its
 * Solo/Duo rank picker in the card below, exactly as searching for it does.
 */
export default function GamesStep() {
  const { colors, radius, spacing, type } = useTheme();
  const games = useOnboardingStore((s) => s.games);
  const addGame = useOnboardingStore((s) => s.addGame);
  const addCustomGame = useOnboardingStore((s) => s.addCustomGame);
  const removeGame = useOnboardingStore((s) => s.removeGame);
  const updateGameSkill = useOnboardingStore((s) => s.updateGameSkill);
  const updateGameRank = useOnboardingStore((s) => s.updateGameRank);
  const setGameLeagueRank = useOnboardingStore((s) => s.setGameLeagueRank);
  const quickPicks = useQuickPickGames();
  // League gets the Solo/Duo rank picker instead of the free-text field. Null while loading or if
  // the read fails, and then League keeps the text field like every other game.
  const leagueGameId = useLeagueGameId();
  const [error, setError] = useState<string | null>(null);

  const selectedIds = games.map((g) => g.gameId);

  function toggleQuickPick(id: string) {
    const pick = quickPicks.data?.find((g) => g.id === id);
    if (!pick) return;
    if (selectedIds.includes(id)) removeGame(id);
    else addGame({ gameId: pick.id, name: pick.name });
  }

  function handleContinue() {
    if (games.length === 0) {
      setError(GAMES_COPY.needOne);
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

  return (
    <WizardStep
      step="games"
      title={GAMES_COPY.title}
      subtitle={GAMES_COPY.subtitle}
      onContinue={handleContinue}
      error={error}
    >
      {/* Nothing at all on an error or an empty answer: search still works. */}
      {(quickPicks.isLoading || (quickPicks.data?.length ?? 0) > 0) && (
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>{GAMES_COPY.quickPicks}</SectionLabel>
          {quickPicks.isLoading ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {QUICK_PICK_SKELETON_WIDTHS.map((width, i) => (
                <Skeleton key={i} width={width} height={CHIP_HEIGHT} borderRadius={radius.chip} />
              ))}
            </View>
          ) : (
            <Animated.View entering={revealEntering()}>
              <ChipSelect
                options={(quickPicks.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
                selected={selectedIds}
                onToggle={toggleQuickPick}
              />
            </Animated.View>
          )}
        </View>
      )}

      {/* No profileId, signed in or not: a custom game is always held as pending and created at
          Save (or at Finish), so both paths write games the same way. */}
      <CatalogPicker
        table="games"
        placeholder={GAMES_COPY.searchLabel}
        selectedIds={selectedIds}
        onSelect={(item) =>
          isPendingCustomGame(item.id) ? addCustomGame(item.name) : addGame({ gameId: item.id, name: item.name })
        }
      />

      <Animated.View layout={layoutTransition()} style={{ gap: spacing.md }}>
        {games.map((game) => (
          <Animated.View
            key={game.gameId}
            entering={revealEntering()}
            exiting={quickExiting()}
            layout={layoutTransition()}
          >
            <Card style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md }}>
                <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{game.name}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${game.name}`}
                  hitSlop={8}
                  onPress={() => {
                    hapticLight();
                    removeGame(game.gameId);
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
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
          </Animated.View>
        ))}
      </Animated.View>
    </WizardStep>
  );
}
