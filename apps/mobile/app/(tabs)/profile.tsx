import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { PROMPT_COUNT, type PhotoRole } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Name } from "@/components/Name";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { VoiceIntroPlayer } from "@/components/VoiceIntroPlayer";
import {
  PLATFORM_LABELS,
  PLAYSTYLE_LABELS,
  REGION_LABELS,
  SKILL_LABELS,
  TILT_HANDLING_LABELS,
  formatPlayWindow,
} from "@/features/onboarding/profile-labels";
import { GalleryPanel } from "@/features/profile/GalleryPanel";
import { ProfileCompleteness } from "@/features/profile/ProfileCompleteness";
import { HowIPlaySection, MetaLine, PromptsSection, ShowsSection } from "@/features/profile/sections";
import { useEditableProfileDetails } from "@/features/profile/useEditableProfileDetails";
import { useOwnProfileDetails } from "@/features/profile/useOwnProfileDetails";
import { useOwnProfilePhotos } from "@/features/profile/useOwnProfilePhotos";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { useUpdatePhoto } from "@/features/profile/usePhotoUpload";
import { useVerifiedStats } from "@/features/profile/useVerifiedStats";
import { useOwnVoiceIntro, useOwnVoiceIntroUrl } from "@/features/profile/useVoiceIntro";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

// The bento grid's half-tiles: two per row with spacing.sm between them, sized to
// fill the row exactly (100% - gap) / 2 for ScreenContainer's spacing.lg side padding
// across the phone widths this ships to. Span-2 tiles just use "100%".
const HALF_TILE_WIDTH = "48.5%";
const AVATAR_SIZE = 64;

function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function EditBadge({ uploading }: { uploading: boolean }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (uploading) {
      opacity.value = withRepeat(withTiming(0.3, { duration: 700, easing: Easing.ease }), -1, true);
    } else {
      opacity.value = withTiming(1, { duration: 150 });
    }
  }, [uploading, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      style={{
        position: "absolute",
        bottom: 4,
        right: 4,
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.55)",
      }}
    >
      <Animated.View style={uploading ? animatedStyle : undefined}>
        <Ionicons name="camera" size={11} color="#fff" />
      </Animated.View>
    </View>
  );
}

/** A slim track-and-fill bar with no side labels — the compact stand-in for
 * VibeSection's three sliders, which carry a "Chill" / "Sweaty ranked grind" caption
 * on either end that doesn't fit a half-width bento tile. Same tokens (surfaceAlt
 * track, accent fill), just narrower. */
function MiniVibeBar({ pct }: { pct: number }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ height: 5, borderRadius: radius.round, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}>
      <View style={{ height: 5, width: `${pct}%`, backgroundColor: colors.accent, borderRadius: radius.round }} />
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, radius, spacing, type } = useTheme();
  const profile = useSessionStore((s) => s.profile);
  const { data: photos, isLoading } = useOwnProfilePhotos(profile?.id);
  const { data: prompts, isLoading: promptsLoading } = useOwnPrompts(profile?.id);
  const { data: details, isLoading: detailsLoading } = useOwnProfileDetails(profile?.id);
  // No dedicated own-profile vibe hook exists — useEditableProfileDetails (used by the
  // edit-details screen) is the only existing query that reaches profile_vibe, so it's
  // reused here for its `vibe` field alone rather than standing up a second fetch for
  // the same table. Its games/shows/platforms/playstyles are ignored in favor of
  // useOwnProfileDetails, which already has the shape these sections expect.
  const { data: editableDetails, isLoading: vibeLoading } = useEditableProfileDetails(profile?.id);
  const updatePhoto = useUpdatePhoto(profile?.id);

  // Voice intro: sign the caller's own clip (whatever its moderation status) for
  // playback, reusing the row useOwnVoiceIntro already fetches rather than
  // re-querying profile_voice_intro. Not part of the pageReady gate — like the
  // stranger-profile view, it resolves lazily and simply appears once signed rather
  // than holding up the rest of the page.
  const { data: ownVoiceIntroRow } = useOwnVoiceIntro(profile?.id);
  const { data: ownVoiceIntro } = useOwnVoiceIntroUrl(ownVoiceIntroRow);

  // Verified rank/playtime, keyed by game name. Resolves to {} until sync-verified-stats
  // has run and found a linked account for this profile — GamesSection already treats a
  // missing entry as "nothing verified," so this never blocks or changes pageReady.
  const { data: verifiedByName } = useVerifiedStats(profile?.id);

  // Start downloading the actual image bytes the moment the signed URLs are known,
  // instead of waiting for prompts/details too — those photo URLs resolving doesn't
  // mean the pixels are in expo-image's cache yet, and if we only mount <Image> once
  // the whole page is ready, the photo area sits blank until the fetch runs its full
  // course *after* everything else is already on screen. Prefetching in parallel with
  // the other two queries means the image is often already cached by the time the
  // page reveals, instead of visibly popping in late.
  useEffect(() => {
    const urls = [photos?.profileUrl, photos?.headerUrl].filter((u): u is string => !!u);
    if (urls.length > 0) void Image.prefetch(urls, "memory-disk");
  }, [photos?.profileUrl, photos?.headerUrl]);

  async function handlePick(role: PhotoRole) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: role === "profile" ? [1, 1] : [3, 4],
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset) updatePhoto.mutate({ uri: asset.uri, role });
  }

  // Gate the whole page behind one combined flag instead of independent
  // skeleton/FadeIn boundaries per query — those resolved at slightly different times
  // and popped in one after another, which read as choppy. Waiting for all of them and
  // revealing once, together, feels like a single load.
  const pageReady = !isLoading && !promptsLoading && !detailsLoading && !vibeLoading;
  const uploadingProfile = updatePhoto.isPending && updatePhoto.variables?.role === "profile";
  const uploadingHeader = updatePhoto.isPending && updatePhoto.variables?.role === "header";

  const age = profile ? calculateAge(profile.dob) : null;
  const regionLabel = profile ? (REGION_LABELS[profile.region] ?? profile.region) : null;
  const playWindowLabel = profile ? formatPlayWindow(profile.usual_play_start_hour, profile.usual_play_end_hour) : null;

  // Derived once so both the identity row's meta caption and the tiles below can gate
  // on (and reuse) the exact same shape each section component already checks
  // internally — wrapping a tile only when the section itself would render.
  const gamesList = (details?.games ?? []).map((game) => ({
    name: game.name,
    skillLevel: SKILL_LABELS[game.skillLevel],
    rank: game.rankText,
  }));
  const platformsList = (details?.platforms ?? []).map((platform) => PLATFORM_LABELS[platform]);
  const playstylesList = (details?.playstyles ?? []).map((tag) => PLAYSTYLE_LABELS[tag]);
  const showsList = details?.shows ?? [];
  const vibe = editableDetails?.vibe ?? null;

  const gameCount = details?.games.length ?? 0;
  const metaLine =
    [age !== null ? String(age) : null, regionLabel, gameCount > 0 ? `${gameCount} game${gameCount === 1 ? "" : "s"}` : null]
      .filter((part): part is string => !!part)
      .join(" · ") || null;

  return (
    <ScreenContainer>
      {!pageReady ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Skeleton width="55%" height={20} />
              <Skeleton width="35%" height={14} />
            </View>
            <Skeleton width={64} height={32} borderRadius={radius.button} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {/* Mirrors the real grid's shape: Photos (span 2), Games + Vibe,
                How I Play + Voice, Shows (span 2) — so loading doesn't jump. */}
            <Skeleton width="100%" height={120} borderRadius={radius.card} />
            <Skeleton width={HALF_TILE_WIDTH} height={110} borderRadius={radius.card} />
            <Skeleton width={HALF_TILE_WIDTH} height={110} borderRadius={radius.card} />
            <Skeleton width={HALF_TILE_WIDTH} height={90} borderRadius={radius.card} />
            <Skeleton width={HALF_TILE_WIDTH} height={70} borderRadius={radius.card} />
            <Skeleton width="100%" height={80} borderRadius={radius.card} />
          </View>
        </>
      ) : (
        profile && (
          <Animated.View entering={FadeIn.duration(220)} style={{ gap: spacing.lg }}>
            {/* Identity row: avatar, name + meta, edit button. Replaces the old
                banner/hero-card header — the header photo now lives in the Photos
                tile below as the "Cover" thumbnail. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change profile picture"
                onPress={() => void handlePick("profile")}
                disabled={updatePhoto.isPending}
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: AVATAR_SIZE / 2,
                  borderWidth: 2,
                  borderColor: colors.accent,
                  backgroundColor: colors.surface,
                  overflow: "hidden",
                }}
              >
                {photos?.profileUrl && (
                  <Image
                    source={{ uri: photos.profileUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                )}
                <EditBadge uploading={uploadingProfile} />
              </Pressable>

              <View style={{ flex: 1, gap: spacing.xs }}>
                <Name variant="cardName" style={{ color: colors.text }}>
                  {profile.display_name}
                </Name>
                {metaLine && <Text style={[type.caption, { color: colors.textMuted }]}>{metaLine}</Text>}
              </View>

              <Button size="sm" label="Edit" onPress={() => router.push("/edit-details")} />
            </View>

            <ProfileCompleteness
              items={[
                { label: "a profile picture", done: !!photos?.profileUrl },
                { label: "a header picture", done: !!photos?.headerUrl },
                { label: "a game", done: (details?.games.length ?? 0) > 0 },
                { label: "a show", done: (details?.shows.length ?? 0) > 0 },
                { label: "a platform", done: (details?.platforms.length ?? 0) > 0 },
                { label: "a playstyle", done: (details?.playstyles.length ?? 0) > 0 },
                { label: "your prompts", done: (prompts?.length ?? 0) >= PROMPT_COUNT },
              ]}
            />

            {/* The bento grid: every tile renders only when its own data is
                non-empty, same gates as the old panel-per-section layout. */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {/* Photos — span 2. The gallery panel now also owns the Cover tile
                  (the header photo), wired to the same handlePick("header") the old
                  banner used. */}
              <GalleryPanel
                profileId={profile.id}
                headerUrl={photos?.headerUrl ?? null}
                onPressCover={() => void handlePick("header")}
                coverUploading={uploadingHeader}
                coverDisabled={updatePhoto.isPending}
              />

              {/* Games — stacked chips, not GamesSection's wrap, so each pill gets
                  its own line in the narrower half-tile. Same data mapping (verified
                  stat wins over self-reported rank/skill) as GamesSection. */}
              {gamesList.length > 0 && (
                <Card style={{ width: HALF_TILE_WIDTH, padding: spacing.tight }}>
                  <SectionLabel>Games</SectionLabel>
                  <View style={{ gap: spacing.sm, alignItems: "flex-start" }}>
                    {gamesList.map((game) => {
                      const verified = verifiedByName?.[game.name];
                      return verified ? (
                        <Chip key={game.name} label={game.name} detail={`✓ ${verified}`} tone="accent" />
                      ) : (
                        <Chip key={game.name} label={game.name} detail={game.rank ?? game.skillLevel ?? undefined} />
                      );
                    })}
                  </View>
                </Card>
              )}

              {/* Vibe — inline mini-bars (no left/right captions; they don't fit a
                  half-tile) plus the tilt sentence, capped at 2 lines. */}
              {vibe && (
                <Card style={{ width: HALF_TILE_WIDTH, padding: spacing.tight }}>
                  <SectionLabel>Vibe</SectionLabel>
                  <View style={{ gap: spacing.sm }}>
                    <MiniVibeBar pct={vibe.intensity} />
                    <MiniVibeBar pct={vibe.commsStyle} />
                    <MiniVibeBar pct={vibe.coachingPref} />
                    <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={2}>
                      After a losing streak: {TILT_HANDLING_LABELS[vibe.tiltHandling]}
                    </Text>
                  </View>
                </Card>
              )}

              {/* Voice intro — only when a clip exists. */}
              {ownVoiceIntro && (
                <Card style={{ width: HALF_TILE_WIDTH, padding: spacing.tight }}>
                  <SectionLabel>Voice Intro</SectionLabel>
                  <VoiceIntroPlayer url={ownVoiceIntro.url} durationSeconds={ownVoiceIntro.durationSeconds} />
                </Card>
              )}

              {/* How I Play — platform + playstyle chips (HowIPlaySection's own wrap
                  layout fits a half-tile fine), with the play-window caption folded
                  in at the bottom instead of a separate Schedule tile. Gated on
                  either having chips or a play window, so a profile with a play
                  window but no platforms/playstyles yet doesn't lose that fact. */}
              {(platformsList.length > 0 || playstylesList.length > 0 || playWindowLabel) && (
                <Card style={{ width: HALF_TILE_WIDTH, padding: spacing.tight, gap: spacing.sm }}>
                  <HowIPlaySection platforms={platformsList} playstyles={playstylesList} />
                  {playWindowLabel && <MetaLine playWindow={playWindowLabel} />}
                </Card>
              )}

              {/* Shows — span 2, wrap. */}
              {showsList.length > 0 && (
                <Card style={{ width: "100%", padding: spacing.tight }}>
                  <ShowsSection shows={showsList} />
                </Card>
              )}

              {/* Prompts — span 2. PromptsSection already renders one glass Card per
                  prompt, so it stays the one block that isn't wrapped in an outer
                  Card here (that would nest glass edges). The Edit link sits beside
                  its SectionLabel rather than threaded into the shared component's
                  props, keeping prompt editing a call-site concern. */}
              <View style={{ width: "100%", position: "relative" }}>
                <PromptsSection prompts={prompts ?? []} />
                <Pressable
                  onPress={() => router.push("/edit-prompts")}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={{ position: "absolute", top: 0, right: 0 }}
                >
                  <Text style={[type.label, { color: colors.brandInk }]}>Edit</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )
      )}
    </ScreenContainer>
  );
}
