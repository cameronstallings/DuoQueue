import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { PROMPT_COUNT, type PhotoRole } from "@duoqueue/shared-types";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Name } from "@/components/Name";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import {
  PLATFORM_LABELS,
  PLAYSTYLE_LABELS,
  REGION_LABELS,
  SKILL_LABELS,
  formatPlayWindow,
} from "@/features/onboarding/profile-labels";
import { GalleryPanel } from "@/features/profile/GalleryPanel";
import { ProfileCompleteness } from "@/features/profile/ProfileCompleteness";
import { HowIPlaySection, MetaLine, PromptsSection, ShowsSection, VibeSection } from "@/features/profile/sections";
import { useEditableProfileDetails } from "@/features/profile/useEditableProfileDetails";
import { useOwnProfileDetails } from "@/features/profile/useOwnProfileDetails";
import { useOwnProfilePhotos } from "@/features/profile/useOwnProfilePhotos";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { useUpdatePhoto } from "@/features/profile/usePhotoUpload";
import { useVerifiedStats } from "@/features/profile/useVerifiedStats";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

// The bento grid's half-tiles: two per row with spacing.sm between them, sized to
// fill the row exactly (100% - gap) / 2 for ScreenContainer's spacing.lg side padding
// across the phone widths this ships to. Span-2 tiles just use "100%".
const HALF_TILE_WIDTH = "48.5%";
const AVATAR_SIZE = 88;
// Own-profile-only stagger budget for the first-reveal cascade (identity row + each
// bento tile) — 45ms per slot, capped so a fully-populated grid still settles inside
// ~400ms rather than trailing off forever as more optional tiles render.
const STAGGER_STEP_MS = 45;
const STAGGER_CAP_MS = 400;

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

export default function ProfileScreen() {
  const { colors, radius, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();

  // ScreenContainer's ScrollView is a plain, un-ref'd RN ScrollView — there's no way
  // to read its offset on the UI thread from here, so this screen grows its own
  // Animated.ScrollView (same bespoke-background shape chat/[matchId].tsx uses)
  // instead of the shared container, to drive the aurora drift and avatar-pull
  // effects below purely off worklets.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);

  // First-reveal gate for the stagger cascade below: flips true the first time
  // pageReady goes true and then latches — background refetches (isLoading stays
  // false after the initial load) never see this flip back, so the identity row and
  // tiles never replay their entrance.
  const hasRevealedRef = useRef(false);

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

  // Read (never write) the latch during render so this render's entering decision is
  // correct immediately; the effect below flips it for every render after.
  const isFirstReveal = pageReady && !hasRevealedRef.current;
  useEffect(() => {
    if (pageReady) hasRevealedRef.current = true;
  }, [pageReady]);

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

  const completenessItems = [
    { label: "a profile picture", done: !!photos?.profileUrl },
    { label: "a header picture", done: !!photos?.headerUrl },
    { label: "a game", done: (details?.games.length ?? 0) > 0 },
    { label: "a show", done: (details?.shows.length ?? 0) > 0 },
    { label: "a platform", done: (details?.platforms.length ?? 0) > 0 },
    { label: "a playstyle", done: (details?.playstyles.length ?? 0) > 0 },
    { label: "your prompts", done: (prompts?.length ?? 0) >= PROMPT_COUNT },
  ];
  const isProfileComplete = completenessItems.every((item) => item.done);

  // Assigns each rendered tile the next slot in the cascade, in JSX source order —
  // conditional tiles that don't render simply never consume a slot, so the stagger
  // always reads as evenly paced regardless of which tiles a given profile has.
  let staggerSlot = 0;
  function nextDelay(): number {
    return Math.min(staggerSlot++ * STAGGER_STEP_MS, STAGGER_CAP_MS);
  }
  function revealEntering() {
    return isFirstReveal ? FadeInDown.springify().delay(nextDelay()) : undefined;
  }

  // The atmosphere lags a beat behind the content — 0.15x scroll rate, capped at a
  // 40px drift so it reads as depth, not a second scrolling layer.
  const auroraDriftStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [0, 267], [0, -40], Extrapolation.CLAMP);
    return { transform: [{ translateY }] };
  });

  // A playful, free touch: the avatar grows slightly on an overscroll pull, settling
  // back to rest the moment the list is at its natural top.
  const avatarPullStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [-120, 0], [1.12, 1], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, auroraDriftStyle]}>
        <GraticuleBackground />
      </Animated.View>
      <GrainOverlay />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.md }}>
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
                <Skeleton width="100%" height={120} borderRadius={radius.card} />
                <Skeleton width="100%" height={80} borderRadius={radius.card} />
              </View>
            </>
          ) : (
            profile && (
              <View style={{ gap: spacing.lg }}>
                {/* Identity row: avatar, name + meta, edit button. Replaces the old
                    banner/hero-card header — the header photo now lives in the Photos
                    tile below as the "Cover" thumbnail. */}
                <Animated.View
                  entering={revealEntering()}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
                >
                  <Animated.View style={avatarPullStyle}>
                    {/* The circular clip lives on an inner view so the camera badge —
                        a sibling, not a child of the clipped photo — renders whole
                        instead of getting sliced by the avatar's curve. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Change profile picture"
                      onPress={() => void handlePick("profile")}
                      disabled={updatePhoto.isPending}
                      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                    >
                      <View
                        style={{
                          flex: 1,
                          borderRadius: AVATAR_SIZE / 2,
                          borderWidth: 2,
                          borderColor: colors.volt,
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
                      </View>
                      <EditBadge uploading={uploadingProfile} />
                    </Pressable>
                  </Animated.View>

                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Name variant="cardName" style={{ color: colors.text }}>
                      {profile.display_name}
                    </Name>
                    {metaLine && <Text style={[type.caption, { color: colors.textMuted }]}>{metaLine}</Text>}
                  </View>

                  <Button size="sm" label="Edit" onPress={() => router.push("/edit-details")} />
                </Animated.View>

                {!isProfileComplete && (
                  <Animated.View entering={revealEntering()}>
                    <ProfileCompleteness items={completenessItems} />
                  </Animated.View>
                )}

                {/* The bento grid: every tile renders only when its own data is
                    non-empty, same gates as the old panel-per-section layout. */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  {/* Photos — span 2. The gallery panel now also owns the Cover tile
                      (the header photo), wired to the same handlePick("header") the old
                      banner used. */}
                  <Animated.View entering={revealEntering()} style={{ width: "100%" }}>
                    <GalleryPanel
                      profileId={profile.id}
                      headerUrl={photos?.headerUrl ?? null}
                      onPressCover={() => void handlePick("header")}
                      coverUploading={uploadingHeader}
                      coverDisabled={updatePhoto.isPending}
                    />
                  </Animated.View>

                  {/* Games — span 2 so full titles + ranks are always visible ("League
                      of Legends · Unranked" truncated in a half-tile). Chips wrap. Same
                      data mapping (verified stat wins over self-reported) as GamesSection. */}
                  {gamesList.length > 0 && (
                    <Animated.View entering={revealEntering()} style={{ width: "100%" }}>
                      <Card style={{ padding: spacing.tight }}>
                        <SectionLabel>Games</SectionLabel>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                          {gamesList.map((game) => {
                            const verified = verifiedByName?.[game.name];
                            return verified ? (
                              <Chip key={game.name} label={game.name} detail={`✓ ${verified}`} tone="volt" />
                            ) : (
                              <Chip key={game.name} label={game.name} detail={game.rank ?? game.skillLevel ?? undefined} />
                            );
                          })}
                        </View>
                      </Card>
                    </Animated.View>
                  )}

                  {/* How I Play + Schedule — the grid's half-tile pair: both reliably
                      short (platform/playstyle chips; a play-window phrase). When no play
                      window is set, How I Play stretches to full width instead of
                      leaving an orphaned half-row. */}
                  {(platformsList.length > 0 || playstylesList.length > 0) && (
                    <Animated.View
                      entering={revealEntering()}
                      style={{ width: playWindowLabel ? HALF_TILE_WIDTH : "100%" }}
                    >
                      <Card style={{ padding: spacing.tight }}>
                        <HowIPlaySection platforms={platformsList} playstyles={playstylesList} />
                      </Card>
                    </Animated.View>
                  )}
                  {playWindowLabel && (
                    <Animated.View
                      entering={revealEntering()}
                      style={{ width: platformsList.length > 0 || playstylesList.length > 0 ? HALF_TILE_WIDTH : "100%" }}
                    >
                      <Card style={{ padding: spacing.tight }}>
                        <SectionLabel>Schedule</SectionLabel>
                        <MetaLine playWindow={playWindowLabel} />
                      </Card>
                    </Animated.View>
                  )}

                  {/* Vibe — promoted to span 2 in the repack, which buys back the full
                      VibeSection: labeled end-captions on each bar and the tilt footer,
                      none of which fit the old half-tile mini-bars. */}
                  {vibe && (
                    <Animated.View entering={revealEntering()} style={{ width: "100%" }}>
                      <Card style={{ padding: spacing.tight }}>
                        <VibeSection vibe={vibe} footerDivider />
                      </Card>
                    </Animated.View>
                  )}

                  {/* Shows — span 2, wrap. */}
                  {showsList.length > 0 && (
                    <Animated.View entering={revealEntering()} style={{ width: "100%" }}>
                      <Card style={{ padding: spacing.tight }}>
                        <ShowsSection shows={showsList} />
                      </Card>
                    </Animated.View>
                  )}

                  {/* Prompts — span 2. PromptsSection already renders one glass Card per
                      prompt, so it stays the one block that isn't wrapped in an outer
                      Card here (that would nest glass edges). The Edit link sits beside
                      its SectionLabel rather than threaded into the shared component's
                      props, keeping prompt editing a call-site concern. */}
                  <Animated.View entering={revealEntering()} style={{ width: "100%", position: "relative" }}>
                    <PromptsSection prompts={prompts ?? []} />
                    <Pressable
                      onPress={() => router.push("/edit-prompts")}
                      accessibilityRole="button"
                      hitSlop={8}
                      style={{ position: "absolute", top: 0, right: 0 }}
                    >
                      <Text style={[type.label, { color: colors.voltDim }]}>Edit</Text>
                    </Pressable>
                  </Animated.View>
                </View>
              </View>
            )
          )}
        </View>
      </Animated.ScrollView>

      {/* Fixed, non-scrolling backdrop so content never passes directly behind the status
          bar icons with nothing behind it once the user scrolls past the initial padding —
          same treatment ScreenContainer gives titleless, nav-button-less pages. */}
      {insets.top > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: colors.background,
          }}
        />
      )}
    </View>
  );
}
