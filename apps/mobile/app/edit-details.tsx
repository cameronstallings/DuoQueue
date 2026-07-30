import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PLATFORMS, PLAYSTYLE_TAGS, SKILL_LEVELS } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ChipSelect } from "@/components/ChipSelect";
import { SectionLabel } from "@/components/SectionLabel";
import { TextField } from "@/components/TextField";
import { CatalogPicker } from "@/features/onboarding/CatalogPicker";
import { PLATFORM_LABELS, PLAYSTYLE_LABELS, SKILL_LABELS } from "@/features/onboarding/profile-labels";
import { type EditableGame, type EditableShow, useEditableProfileDetails } from "@/features/profile/useEditableProfileDetails";
import { useSaveProfileDetails } from "@/features/profile/useSaveProfileDetails";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

const MAX_PLAYSTYLES = 6;

export default function EditDetailsScreen() {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useSessionStore((s) => s.profile);
  const { data: existing, isLoading: loadingExisting } = useEditableProfileDetails(profile?.id);
  const save = useSaveProfileDetails(profile?.id);

  const [games, setGames] = useState<EditableGame[] | null>(null);
  const [shows, setShows] = useState<EditableShow[] | null>(null);
  const [platforms, setPlatforms] = useState<(typeof PLATFORMS)[number][] | null>(null);
  const [playstyles, setPlaystyles] = useState<(typeof PLAYSTYLE_TAGS)[number][] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seed local editable state once the saved details arrive.
  useEffect(() => {
    if (games !== null || loadingExisting || !existing) return;
    setGames(existing.games);
    setShows(existing.shows);
    setPlatforms(existing.platforms);
    setPlaystyles(existing.playstyles);
  }, [games, loadingExisting, existing]);

  const loaded = games !== null && shows !== null && platforms !== null && playstyles !== null;

  function removeGame(gameId: string) {
    setGames((prev) => (prev ?? []).filter((g) => g.gameId !== gameId));
  }
  function updateGameSkill(gameId: string, skillLevel: EditableGame["skillLevel"]) {
    setGames((prev) => (prev ?? []).map((g) => (g.gameId === gameId ? { ...g, skillLevel } : g)));
  }
  function updateGameRank(gameId: string, rankText: string) {
    setGames((prev) => (prev ?? []).map((g) => (g.gameId === gameId ? { ...g, rankText } : g)));
  }
  function removeShow(showId: string) {
    setShows((prev) => (prev ?? []).filter((s) => s.showId !== showId));
  }
  function togglePlatform(value: (typeof PLATFORMS)[number]) {
    setPlatforms((prev) => {
      const p = prev ?? [];
      return p.includes(value) ? p.filter((v) => v !== value) : [...p, value];
    });
  }
  function togglePlaystyle(value: (typeof PLAYSTYLE_TAGS)[number]) {
    setPlaystyles((prev) => {
      const p = prev ?? [];
      if (p.includes(value)) return p.filter((v) => v !== value);
      if (p.length >= MAX_PLAYSTYLES) {
        setError(`Choose up to ${MAX_PLAYSTYLES} playstyle tags.`);
        return p;
      }
      setError(null);
      return [...p, value];
    });
  }

  async function handleSave() {
    if (!games || !shows || !platforms || !playstyles) return;
    if (games.length === 0) {
      setError("Add at least one favorite game.");
      return;
    }
    if (platforms.length === 0) {
      setError("Select at least one platform.");
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({
        games: games.map((g) => ({ gameId: g.gameId, skillLevel: g.skillLevel, rankText: g.rankText })),
        shows: shows.map((s) => ({ showId: s.showId })),
        platforms,
        playstyles,
      });
      useToastStore.getState().showToast("Profile details saved");
      router.back();
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.lg }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>Edit Details</Text>

        {!loaded || !profile ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Games</SectionLabel>
              <CatalogPicker
                table="games"
                placeholder="Search games"
                profileId={profile.id}
                selectedIds={games.map((g) => g.gameId)}
                onSelect={(item) =>
                  setGames((prev) => [...(prev ?? []), { gameId: item.id, name: item.name, skillLevel: "casual", rankText: "" }])
                }
              />
              <View style={{ gap: spacing.md }}>
                {games.map((game) => (
                  <Card key={game.gameId} style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{game.name}</Text>
                      <Pressable onPress={() => removeGame(game.gameId)}>
                        <Text style={{ color: colors.danger }}>Remove</Text>
                      </Pressable>
                    </View>
                    <ChipSelect
                      options={SKILL_LEVELS.map((value) => ({ value, label: SKILL_LABELS[value] }))}
                      selected={[game.skillLevel]}
                      onToggle={(value) => updateGameSkill(game.gameId, value)}
                    />
                    <TextField
                      label="Rank (optional)"
                      value={game.rankText}
                      onChangeText={(text) => updateGameRank(game.gameId, text)}
                      placeholder="e.g. Diamond II"
                    />
                  </Card>
                ))}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Shows & Movies</SectionLabel>
              <CatalogPicker
                table="shows"
                placeholder="Search shows, movies, anime"
                profileId={profile.id}
                selectedIds={shows.map((s) => s.showId)}
                onSelect={(item) => setShows((prev) => [...(prev ?? []), { showId: item.id, name: item.name }])}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {shows.map((show) => (
                  <Pressable
                    key={show.showId}
                    onPress={() => removeShow(show.showId)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.pill,
                      backgroundColor: colors.brand,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>{show.name}</Text>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>×</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Platforms</SectionLabel>
              <ChipSelect
                options={PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }))}
                selected={platforms}
                onToggle={togglePlatform}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Playstyle</SectionLabel>
              <ChipSelect
                options={PLAYSTYLE_TAGS.map((value) => ({ value, label: PLAYSTYLE_LABELS[value] }))}
                selected={playstyles}
                onToggle={togglePlaystyle}
              />
            </View>

            {error && <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>}

            <Button label={save.isPending ? "Saving..." : "Save"} onPress={() => void handleSave()} loading={save.isPending} />
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
          </>
        )}
      </ScrollView>

      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background }}
      />
    </View>
  );
}
