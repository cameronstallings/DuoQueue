import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { PROMPT_COUNT, type PhotoRole } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Name } from "@/components/Name";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { VoiceIntroPlayer } from "@/components/VoiceIntroPlayer";
import {
  PLATFORM_LABELS,
  PLAYSTYLE_LABELS,
  REGION_LABELS,
  SKILL_LABELS,
  formatPlayWindow,
} from "@/features/onboarding/profile-labels";
import { GalleryPanel } from "@/features/profile/GalleryPanel";
import { ProfileCompleteness } from "@/features/profile/ProfileCompleteness";
import {
  GamesSection,
  HowIPlaySection,
  MetaLine,
  PromptsSection,
  ShowsSection,
  VibeSection,
} from "@/features/profile/sections";
import { useEditableProfileDetails } from "@/features/profile/useEditableProfileDetails";
import { useOwnProfileDetails } from "@/features/profile/useOwnProfileDetails";
import { useOwnProfilePhotos } from "@/features/profile/useOwnProfilePhotos";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { useUpdatePhoto } from "@/features/profile/usePhotoUpload";
import { useVerifiedStats } from "@/features/profile/useVerifiedStats";
import { useOwnVoiceIntro, useOwnVoiceIntroUrl } from "@/features/profile/useVoiceIntro";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

// 2.2 (was 3): the banner reaches well down the page — device-pass feedback said the
// header felt shallow, twice. Avatar tuned by feel across three rounds: 88 → 104 →
// 116 → 128, sitting 90% under the banner edge so just its chin clears the photo.
const BANNER_ASPECT = 2.2;
const AVATAR_SIZE = 128;
const AVATAR_OVERLAP = AVATAR_SIZE * 0.9;

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
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.55)",
      }}
    >
      <Animated.View style={uploading ? animatedStyle : undefined}>
        <Ionicons name="camera" size={13} color="#fff" />
      </Animated.View>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, radius, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
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

  // Derived once so both the hero card's stat strip and the panels below can gate on
  // (and reuse) the exact same shape each section component already checks internally —
  // wrapping a section in a visible Card only when the section itself would render.
  const gamesList = (details?.games ?? []).map((game) => ({
    name: game.name,
    skillLevel: SKILL_LABELS[game.skillLevel],
    rank: game.rankText,
  }));
  const platformsList = (details?.platforms ?? []).map((platform) => PLATFORM_LABELS[platform]);
  const playstylesList = (details?.playstyles ?? []).map((tag) => PLAYSTYLE_LABELS[tag]);
  const showsList = details?.shows ?? [];
  const vibe = editableDetails?.vibe ?? null;

  // 2-3 facts already on the page, condensed into the hero card's stat strip —
  // no new fetches, just a reading of `details` that's already loaded.
  const gameCount = details?.games.length ?? 0;
  const primaryPlatform = details?.platforms[0];
  const primaryPlaystyle = details?.playstyles[0];
  const primaryPlatformLabel = primaryPlatform ? PLATFORM_LABELS[primaryPlatform] : null;
  const primaryPlaystyleLabel = primaryPlaystyle ? PLAYSTYLE_LABELS[primaryPlaystyle] : null;
  const statLine =
    [
      gameCount > 0 ? `${gameCount} game${gameCount === 1 ? "" : "s"}` : null,
      primaryPlatformLabel,
      primaryPlaystyleLabel,
    ]
      .filter((part): part is string => !!part)
      .join(" · ") || null;

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(scrollY.value / 80, 0), 1),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        {/* Overscroll cover: anchored above the banner inside the scroll content so a
            bounce (or any sub-pixel seam at the very top) shows banner-colored surface
            instead of a flash of page background above the photo. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -300,
            left: 0,
            right: 0,
            height: 300,
            backgroundColor: colors.surface,
          }}
        />
        {!pageReady ? (
          <View>
            <Skeleton width="100%" height={170 + insets.top} borderRadius={0} />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Skeleton
                width={AVATAR_SIZE}
                height={AVATAR_SIZE}
                borderRadius={AVATAR_SIZE / 2}
                style={{ marginTop: -AVATAR_OVERLAP, borderWidth: 4, borderColor: colors.background }}
              />
              <View style={{ marginTop: spacing.md }}>
                {/* Hero card: name + meta, stat strip, completeness bar, edit button. */}
                <Skeleton height={166} borderRadius={radius.card} />
              </View>
              <View style={{ marginTop: spacing.lg, gap: spacing.lg }}>
                {/* Panel rhythm: one glass-card-shaped block per labeled section, spaced
                    the same as the real Cards, so loading doesn't jump when data lands. */}
                {[104, 84, 128, 96].map((height, index) => (
                  <Skeleton key={index} height={height} borderRadius={radius.card} />
                ))}
              </View>
            </View>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(220)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change header picture"
              onPress={() => void handlePick("header")}
              disabled={updatePhoto.isPending}
              style={{
                width: "100%",
                aspectRatio: BANNER_ASPECT,
                backgroundColor: colors.surface,
                paddingTop: insets.top,
                overflow: "hidden",
              }}
            >
              {photos?.headerUrl && (
                <>
                  <Image
                    source={{ uri: photos.headerUrl }}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                  <LinearGradient
                    colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
                    pointerEvents="none"
                    style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 44 }}
                  />
                </>
              )}
              <EditBadge uploading={uploadingHeader} />
            </Pressable>

            <View style={{ paddingHorizontal: spacing.lg }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change profile picture"
                onPress={() => void handlePick("profile")}
                disabled={updatePhoto.isPending}
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: AVATAR_SIZE / 2,
                  marginTop: -AVATAR_OVERLAP,
                  borderWidth: 4,
                  borderColor: colors.background,
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

              {profile && (
                <Card luminous style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <View style={{ gap: spacing.xs }}>
                    <Name variant="cardName" style={{ color: colors.text }}>
                      {profile.display_name}
                    </Name>
                    {age !== null && regionLabel && (
                      <Text style={[type.caption, { color: colors.textMuted }]}>
                        {age} · {regionLabel}
                      </Text>
                    )}
                  </View>

                  {statLine && (
                    <Text style={[type.caption, { color: colors.textMuted }]}>{statLine}</Text>
                  )}

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

                  {/* Compact and hugging its label — a full-width gradient bar here
                      overpowered the card (Cameron's device-pass note). */}
                  <View style={{ flexDirection: "row" }}>
                    <Button size="sm" label="Edit profile" onPress={() => router.push("/edit-details")} />
                  </View>
                </Card>
              )}

              <View style={{ marginTop: spacing.lg, gap: spacing.lg }}>
                {/* Gallery management — rendered whenever we have a profile (unlike the
                    sections below, which additionally gate on having data), since the
                    add tile itself is the empty state; there's nothing to hide when a
                    profile has zero gallery photos yet. */}
                {profile && <GalleryPanel profileId={profile.id} />}

                {/* PromptsSection already renders one glass Card per prompt — an outer
                    Card here would nest glass edges, so this stays the one section that
                    isn't wrapped. The Edit link is laid on top rather than threaded into
                    the shared component's props, so prompt editing (a separate screen
                    from the rest of edit-details) stays a call-site concern instead of a
                    section-component one. */}
                <View style={{ position: "relative" }}>
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

                {/* Every other section is gated on the exact data its section component
                    checks internally, so a Card never wraps a section that would
                    otherwise render null. */}
                {gamesList.length > 0 && (
                  <Card>
                    <GamesSection games={gamesList} verifiedByName={verifiedByName} />
                  </Card>
                )}

                {(platformsList.length > 0 || playstylesList.length > 0) && (
                  <Card>
                    <HowIPlaySection platforms={platformsList} playstyles={playstylesList} />
                  </Card>
                )}

                {vibe && (
                  <Card>
                    <VibeSection vibe={vibe} footerDivider />
                  </Card>
                )}

                {playWindowLabel && (
                  // SectionLabel carries its own bottom margin (same idiom the other
                  // section components use internally) — no extra gap needed here.
                  <Card>
                    <SectionLabel>Schedule</SectionLabel>
                    <MetaLine playWindow={playWindowLabel} />
                  </Card>
                )}

                {ownVoiceIntro && (
                  <Card>
                    <SectionLabel>Voice Intro</SectionLabel>
                    <VoiceIntroPlayer url={ownVoiceIntro.url} durationSeconds={ownVoiceIntro.durationSeconds} />
                  </Card>
                )}

                {showsList.length > 0 && (
                  <Card>
                    <ShowsSection shows={showsList} />
                  </Card>
                )}
              </View>
            </View>
          </Animated.View>
        )}
      </Animated.ScrollView>

      {/* Fixed, non-scrolling backdrop that fades in as the banner scrolls out of view, so
          the status bar sits on the photo at the top but on a solid backing everywhere else. */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background },
          backdropStyle,
        ]}
      />
    </View>
  );
}
