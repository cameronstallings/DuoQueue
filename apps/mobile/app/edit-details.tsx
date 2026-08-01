import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PLATFORMS, PLAYSTYLE_TAGS, SKILL_LEVELS, TILT_HANDLING_OPTIONS, type TiltHandling } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ChipSelect } from "@/components/ChipSelect";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { Slider } from "@/components/Slider";
import { TextField } from "@/components/TextField";
import { CatalogPicker } from "@/features/onboarding/CatalogPicker";
import { VoiceIntroRecorderCard } from "@/features/profile/VoiceIntroRecorderCard";
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
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

const MAX_PLAYSTYLES = 6;

export default function EditDetailsScreen() {
  const { colors, radius, spacing, type, hairline } = useTheme();
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
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ ...type.screenTitle, color: colors.text }}>Edit Details</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
              borderWidth: hairline,
              borderColor: colors.ink,
            }}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        {!loaded || !profile ? (
          <>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Games</SectionLabel>
              <Skeleton height={44} borderRadius={radius.md} />
              <Card style={{ gap: spacing.sm }}>
                <Skeleton width="50%" height={16} />
                <Skeleton width="100%" height={36} />
              </Card>
            </View>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Shows & Movies</SectionLabel>
              <Skeleton height={44} borderRadius={radius.md} />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Skeleton width={90} height={32} borderRadius={radius.pill} />
                <Skeleton width={110} height={32} borderRadius={radius.pill} />
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Platforms</SectionLabel>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Skeleton width={70} height={32} borderRadius={radius.pill} />
                <Skeleton width={90} height={32} borderRadius={radius.pill} />
                <Skeleton width={80} height={32} borderRadius={radius.pill} />
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Playstyle</SectionLabel>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Skeleton width={100} height={32} borderRadius={radius.pill} />
                <Skeleton width={80} height={32} borderRadius={radius.pill} />
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Vibe</SectionLabel>
              <Card style={{ gap: spacing.md }}>
                <Skeleton height={20} />
                <Skeleton height={20} />
                <Skeleton height={20} />
              </Card>
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

            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Vibe</SectionLabel>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                Two people who play the same game can still be a terrible pair — this helps us screen for fit.
              </Text>
              <Card style={{ gap: spacing.lg }}>
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>Intensity</Text>
                  <Slider
                    value={vibe.intensity}
                    onChange={(intensity) => setVibe((prev) => (prev ? { ...prev, intensity } : prev))}
                    leftLabel="Chill / norms & ARAM"
                    rightLabel="Sweaty ranked grind"
                  />
                </View>
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>Comms</Text>
                  <Slider
                    value={vibe.commsStyle}
                    onChange={(commsStyle) => setVibe((prev) => (prev ? { ...prev, commsStyle } : prev))}
                    leftLabel="Mostly quiet"
                    rightLabel="Mic on constantly"
                  />
                </View>
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>Coaching</Text>
                  <Slider
                    value={vibe.coachingPref}
                    onChange={(coachingPref) => setVibe((prev) => (prev ? { ...prev, coachingPref } : prev))}
                    leftLabel="Don't review my deaths"
                    rightLabel="Coach me, I want to improve"
                  />
                </View>
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>After a losing streak, I...</Text>
                  <ChipSelect
                    options={TILT_HANDLING_OPTIONS.map((value) => ({ value, label: TILT_HANDLING_LABELS[value] }))}
                    selected={[vibe.tiltHandling]}
                    onToggle={(value: TiltHandling) => setVibe((prev) => (prev ? { ...prev, tiltHandling: value } : prev))}
                  />
                </View>
              </Card>
            </View>

            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Voice Intro</SectionLabel>
              <VoiceIntroRecorderCard profileId={profile.id} />
            </View>

            <View style={{ gap: spacing.sm }}>
              <SectionLabel>Schedule</SectionLabel>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
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
