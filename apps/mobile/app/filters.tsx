import { useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  GENDERS,
  LANGUAGE_CODES,
  MIN_AGE,
  PLATFORMS,
  PLAYSTYLE_TAGS,
  REGIONS,
  SKILL_LEVELS,
  type Gender,
  type LanguageCode,
  type Platform,
  type PlaystyleTag,
  type Region,
  type SkillLevel,
} from "@duoqueue/shared-types";
import { LANGUAGE_LABELS } from "@/features/onboarding/language-labels";
import {
  GENDER_LABELS,
  PLATFORM_LABELS,
  PLAYSTYLE_LABELS,
  REGION_LABELS,
  SKILL_LABELS,
} from "@/features/onboarding/profile-labels";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ChipSelect } from "@/components/ChipSelect";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { TextField } from "@/components/TextField";
import { CatalogPicker } from "@/features/onboarding/CatalogPicker";
import { usePremiumStatus } from "@/features/matching/usePremiumStatus";
import { usePreferences } from "@/features/matching/usePreferences";
import { useRequireSession } from "@/hooks/useRequireSession";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

function toggleSingle<T>(current: T | null, value: T, setter: (value: T | null) => void) {
  setter(current === value ? null : value);
}

/** One labeled group on the Filters screen: uppercase section label + a short hint
 * explaining what the filter does, with the controls grouped inside a Card. */
function FilterSection({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View>
      <SectionLabel>{label}</SectionLabel>
      <Card style={{ gap: spacing.sm }}>
        {hint ? <Text style={[type.caption, { color: colors.textMuted }]}>{hint}</Text> : null}
        {children}
      </Card>
    </View>
  );
}

export default function FiltersScreen() {
  useRequireSession();
  const { colors, radius, spacing, type } = useTheme();
  const session = useSessionStore((s) => s.session);
  const { preferences, isLoading, save } = usePreferences();
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus();

  const [minAge, setMinAge] = useState(String(MIN_AGE));
  const [maxAge, setMaxAge] = useState("99");
  const [genders, setGenders] = useState<Gender[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [language, setLanguage] = useState<LanguageCode | null>(null);
  const [filterGame, setFilterGame] = useState<{ id: string; name: string } | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [playstyle, setPlaystyle] = useState<PlaystyleTag | null>(null);
  const [filterShow, setFilterShow] = useState<{ id: string; name: string } | null>(null);
  const [recentlyActive, setRecentlyActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the editable local state once preferences load — a render-time sync (not an
  // effect) per https://react.dev/reference/react/useState#storing-information-from-previous-renders,
  // guarded so it only fires the first time this profile's preferences arrive.
  const [loadedForProfile, setLoadedForProfile] = useState<string | null>(null);
  if (preferences && loadedForProfile !== preferences.profile_id) {
    setLoadedForProfile(preferences.profile_id);
    setMinAge(String(preferences.min_age));
    setMaxAge(String(preferences.max_age));
    setGenders(preferences.preferred_genders ?? []);
    setRegions(preferences.preferred_regions ?? []);
    setLanguage((preferences.required_language as LanguageCode | null) ?? null);
    setPlatform(preferences.filter_platform);
    setSkillLevel(preferences.filter_skill_level);
    setPlaystyle(preferences.filter_playstyle as PlaystyleTag | null);
    setRecentlyActive(preferences.filter_recently_active);
  }

  const filterGameId = preferences?.filter_game_id ?? null;
  useQuery({
    queryKey: ["game-name", filterGameId],
    queryFn: async () => {
      if (!filterGameId) return null;
      const { data } = await supabase.from("games").select("id, name").eq("id", filterGameId).maybeSingle();
      if (data) setFilterGame(data);
      return data;
    },
    enabled: !!filterGameId && !filterGame,
  });

  const filterShowId = preferences?.filter_show_id ?? null;
  useQuery({
    queryKey: ["show-name", filterShowId],
    queryFn: async () => {
      if (!filterShowId) return null;
      const { data } = await supabase.from("shows").select("id, name").eq("id", filterShowId).maybeSingle();
      if (data) setFilterShow(data);
      return data;
    },
    enabled: !!filterShowId && !filterShow,
  });

  async function handleSave() {
    const min = Number.parseInt(minAge, 10);
    const max = Number.parseInt(maxAge, 10);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < MIN_AGE || max < min) {
      setError(`Enter a valid age range (min ${MIN_AGE}, max ≥ min).`);
      return;
    }
    setError(null);

    try {
      await save.mutateAsync({
        min_age: min,
        max_age: max,
        preferred_genders: genders.length > 0 ? genders : null,
        preferred_regions: regions.length > 0 ? regions : null,
        required_language: language,
        filter_game_id: isPremium ? filterGame?.id ?? null : preferences?.filter_game_id ?? null,
        filter_platform: isPremium ? platform : (preferences?.filter_platform ?? null),
        filter_skill_level: isPremium ? skillLevel : (preferences?.filter_skill_level ?? null),
        filter_playstyle: isPremium ? playstyle : (preferences?.filter_playstyle ?? null),
        filter_show_id: isPremium ? (filterShow?.id ?? null) : (preferences?.filter_show_id ?? null),
        filter_recently_active: isPremium ? recentlyActive : (preferences?.filter_recently_active ?? false),
      });
      router.back();
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  if (isLoading || premiumLoading || !session) {
    return (
      <ScreenContainer title="Filters" showClose>
        <Skeleton width="90%" height={13} />
        {["Age range", "Gender", "Region", "Language"].map((label) => (
          <View key={label}>
            <SectionLabel>{label}</SectionLabel>
            <Card style={{ gap: spacing.sm }}>
              <Skeleton width="60%" height={13} />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Skeleton width={70} height={32} borderRadius={radius.chip} />
                <Skeleton width={90} height={32} borderRadius={radius.chip} />
                <Skeleton width={80} height={32} borderRadius={radius.chip} />
              </View>
            </Card>
          </View>
        ))}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Filters" showClose>
      <Text style={[type.caption, { color: colors.textMuted }]}>
        Choose who shows up in your deck. Leave a section empty to see everyone.
      </Text>

      <FilterSection label="Age range" hint="Only show people between these ages.">
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField label="Min" value={minAge} onChangeText={setMinAge} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Max" value={maxAge} onChangeText={setMaxAge} keyboardType="number-pad" />
          </View>
        </View>
      </FilterSection>

      <FilterSection label="Gender" hint="Pick any that apply — empty means all genders.">
        <ChipSelect
          options={GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }))}
          selected={genders}
          onToggle={(value) => setGenders((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))}
        />
      </FilterSection>

      <FilterSection label="Region" hint="Pick any that apply — empty means all regions.">
        <ChipSelect
          options={REGIONS.map((value) => ({ value, label: REGION_LABELS[value] }))}
          selected={regions}
          onToggle={(value) => setRegions((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))}
        />
      </FilterSection>

      <FilterSection label="Language" hint="Only show people who also speak this language.">
        <ChipSelect
          options={LANGUAGE_CODES.map((code) => ({ value: code, label: LANGUAGE_LABELS[code] }))}
          selected={language ? [language] : []}
          onToggle={(value) => toggleSingle(language, value, setLanguage)}
        />
      </FilterSection>

      <View>
        <SectionLabel>DuoQueue+ filters</SectionLabel>
        {!isPremium ? (
          <Card style={{ gap: spacing.sm }}>
            <Text style={[type.caption, { color: colors.textMuted }]}>
              Filter by a specific game or show, platform, skill level, playstyle, and recent activity with
              DuoQueue+.
            </Text>
            <Button variant="premium" label="Unlock DuoQueue+" onPress={() => router.push("/paywall")} />
          </Card>
        ) : (
          <Card style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Plays a specific game</Text>
              <CatalogPicker
                table="games"
                placeholder="Search games"
                profileId={session.user.id}
                selectedIds={filterGame ? [filterGame.id] : []}
                onSelect={(item) => setFilterGame(item)}
              />
              {filterGame && (
                <Button label={`Clear "${filterGame.name}"`} variant="ghost" onPress={() => setFilterGame(null)} />
              )}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Platform</Text>
              <ChipSelect
                options={PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }))}
                selected={platform ? [platform] : []}
                onToggle={(value) => toggleSingle(platform, value, setPlatform)}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Skill level</Text>
              <ChipSelect
                options={SKILL_LEVELS.map((value) => ({ value, label: SKILL_LABELS[value] }))}
                selected={skillLevel ? [skillLevel] : []}
                onToggle={(value) => toggleSingle(skillLevel, value, setSkillLevel)}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Playstyle</Text>
              <ChipSelect
                options={PLAYSTYLE_TAGS.map((value) => ({ value, label: PLAYSTYLE_LABELS[value] }))}
                selected={playstyle ? [playstyle] : []}
                onToggle={(value) => toggleSingle(playstyle, value, setPlaystyle)}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>
                Watches a specific show, anime, or movie
              </Text>
              <CatalogPicker
                table="shows"
                placeholder="Search shows"
                profileId={session.user.id}
                selectedIds={filterShow ? [filterShow.id] : []}
                onSelect={(item) => setFilterShow(item)}
              />
              {filterShow && (
                <Button label={`Clear "${filterShow.name}"`} variant="ghost" onPress={() => setFilterShow(null)} />
              )}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Recently active only</Text>
              <Switch value={recentlyActive} onValueChange={setRecentlyActive} trackColor={{ true: colors.volt }} />
            </View>
          </Card>
        )}
      </View>

      {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}

      <Button label="Save filters" onPress={() => void handleSave()} loading={save.isPending} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScreenContainer>
  );
}
