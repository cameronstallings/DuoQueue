import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PLATFORMS,
  PLAYSTYLE_TAGS,
  RANK_TEXT_MAX_LENGTH,
  SKILL_LEVELS,
  TILT_HANDLING_OPTIONS,
  type TiltHandling,
} from "@duoqueue/shared-types";

import { Button, ButtonRow } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { ChipSelect } from "@/components/ChipSelect";
import { ModalHeader } from "@/components/ModalHeader";
import { SectionLabel } from "@/components/SectionLabel";
import { KeyboardAwareScrollView } from "@/components/KeyboardAwareScrollView";
import { Skeleton } from "@/components/Skeleton";
import { Slider } from "@/components/Slider";
import { TextField } from "@/components/TextField";
import { CatalogPicker } from "@/features/onboarding/CatalogPicker";
import {
  PLATFORM_LABELS,
  PLAY_WINDOW_PRESETS,
  PLAYSTYLE_LABELS,
  SKILL_LABELS,
  TILT_HANDLING_LABELS,
} from "@/features/onboarding/profile-labels";
import {
  type EditableGame,
  type EditablePlayWindow,
  type EditableShow,
  type EditableVibe,
  useEditableProfileDetails,
} from "@/features/profile/useEditableProfileDetails";
import { useSaveProfileDetails } from "@/features/profile/useSaveProfileDetails";
import { useRequireSession } from "@/hooks/useRequireSession";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

const MAX_PLAYSTYLES = 6;

export default function EditDetailsScreen() {
  useRequireSession();
  const { colors, radius, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useSessionStore((s) => s.profile);
  const { data: existing, isLoading: loadingExisting } = useEditableProfileDetails(profile?.id);
  const save = useSaveProfileDetails(profile?.id);

  const [games, setGames] = useState<EditableGame[] | null>(null);
  const [shows, setShows] = useState<EditableShow[] | null>(null);
  const [platforms, setPlatforms] = useState<(typeof PLATFORMS)[number][] | null>(null);
  const [playstyles, setPlaystyles] = useState<(typeof PLAYSTYLE_TAGS)[number][] | null>(null);
  const [vibe, setVibe] = useState<EditableVibe | null>(null);
  const [playWindow, setPlayWindow] = useState<EditablePlayWindow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seed local editable state once the saved details arrive.
  useEffect(() => {
    if (games !== null || loadingExisting || !existing) return;
    setGames(existing.games);
    setShows(existing.shows);
    setPlatforms(existing.platforms);
    setPlaystyles(existing.playstyles);
    setVibe(existing.vibe);
    setPlayWindow(existing.playWindow);
  }, [games, loadingExisting, existing]);

  const loaded =
    games !== null && shows !== null && platforms !== null && playstyles !== null && vibe !== null && playWindow !== null;

  const selectedPreset = PLAY_WINDOW_PRESETS.find(
    (p) => p.startHour === playWindow?.startHour && p.endHour === playWindow?.endHour,
  );

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
    if (!games || !shows || !platforms || !playstyles || !vibe || !playWindow) return;
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
        vibe,
        playWindow,
      });
      useToastStore.getState().showToast("Profile details saved");
      router.back();
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* No insets.top: this is presented as a modal, which is already inset below the
          status bar. Adding it again opened the sheet with a second status bar of
          empty space. */}
      {/* Own ScrollView rather than ScreenContainer's, so keyboard handling is explicit
          here too — this screen has the rank fields and the game/show search boxes. */}
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <ModalHeader title="Edit Details" />

        {!loaded || !profile ? (
          <>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Games</SectionLabel>
              <Skeleton height={44} borderRadius={radius.md} />
              <Card flat style={{ gap: spacing.sm }}>
                <Skeleton width="50%" height={16} />
                <Skeleton width="100%" height={36} />
              </Card>
            </View>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Shows & Movies</SectionLabel>
              <Skeleton height={44} borderRadius={radius.md} />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Skeleton width={90} height={32} borderRadius={radius.chip} />
                <Skeleton width={110} height={32} borderRadius={radius.chip} />
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Platforms</SectionLabel>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Skeleton width={70} height={32} borderRadius={radius.chip} />
                <Skeleton width={90} height={32} borderRadius={radius.chip} />
                <Skeleton width={80} height={32} borderRadius={radius.chip} />
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Playstyle</SectionLabel>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Skeleton width={100} height={32} borderRadius={radius.chip} />
                <Skeleton width={80} height={32} borderRadius={radius.chip} />
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Vibe</SectionLabel>
              <Skeleton height={20} />
              <Skeleton height={20} />
              <Skeleton height={20} />
            </View>
          </>
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
                  <Card key={game.gameId} flat style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[type.bodyStrong, { color: colors.text }]}>{game.name}</Text>
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
                      maxLength={RANK_TEXT_MAX_LENGTH}
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
                  <Chip
                    key={show.showId}
                    label={show.name}
                    selected
                    onPress={() => removeShow(show.showId)}
                    accessibilityLabel={`Remove ${show.name}`}
                    icon={<Ionicons name="close" size={13} color={colors.voltDim} />}
                  />
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

            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Vibe</SectionLabel>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                Two people who play the same game can still be a terrible pair — this helps us screen for fit.
              </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Intensity</Text>
              <Slider
                value={vibe.intensity}
                onChange={(intensity) => setVibe((prev) => (prev ? { ...prev, intensity } : prev))}
                leftLabel="Chill / norms & ARAM"
                rightLabel="Sweaty ranked grind"
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Comms</Text>
              <Slider
                value={vibe.commsStyle}
                onChange={(commsStyle) => setVibe((prev) => (prev ? { ...prev, commsStyle } : prev))}
                leftLabel="Mostly quiet"
                rightLabel="Mic on constantly"
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Coaching</Text>
              <Slider
                value={vibe.coachingPref}
                onChange={(coachingPref) => setVibe((prev) => (prev ? { ...prev, coachingPref } : prev))}
                leftLabel="Don't review my deaths"
                rightLabel="Coach me, I want to improve"
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>After a losing streak, I...</Text>
              <ChipSelect
                options={TILT_HANDLING_OPTIONS.map((value) => ({ value, label: TILT_HANDLING_LABELS[value] }))}
                selected={[vibe.tiltHandling]}
                onToggle={(value: TiltHandling) => setVibe((prev) => (prev ? { ...prev, tiltHandling: value } : prev))}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Schedule</SectionLabel>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                When do you usually play? We&apos;ll favor people whose window overlaps with yours.
              </Text>
              <ChipSelect
                options={[
                  ...PLAY_WINDOW_PRESETS.map((p) => ({ value: p.label, label: p.label })),
                  { value: "none", label: "No preference" },
                ]}
                selected={[selectedPreset ? selectedPreset.label : "none"]}
                onToggle={(value: string) => {
                  const preset = PLAY_WINDOW_PRESETS.find((p) => p.label === value);
                  setPlayWindow(preset ? { startHour: preset.startHour, endHour: preset.endHour } : { startHour: null, endHour: null });
                }}
              />
            </View>

            {error && <Text style={[type.caption, { color: colors.danger }]}>{error}</Text>}

            <ButtonRow>
              <Button label={save.isPending ? "Saving..." : "Save"} onPress={() => void handleSave()} loading={save.isPending} />
              <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
            </ButtonRow>
          </>
        )}
      </KeyboardAwareScrollView>

      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background }}
      />
    </View>
  );
}
