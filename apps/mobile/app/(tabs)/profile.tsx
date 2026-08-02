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
import { Skeleton } from "@/components/Skeleton";
import { VoiceIntroPlayer } from "@/components/VoiceIntroPlayer";
import {
  PLATFORM_LABELS,
  PLAYSTYLE_LABELS,
  REGION_LABELS,
  SKILL_LABELS,
  formatPlayWindow,
} from "@/features/onboarding/profile-labels";
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
import { useOwnVoiceIntro, useOwnVoiceIntroUrl } from "@/features/profile/useVoiceIntro";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

const BANNER_ASPECT = 3;
const AVATAR_SIZE = 88;

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
  const { colors, radius, spacing, shadow, type } = useTheme();
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
        {!pageReady ? (
          <View>
            <Skeleton width="100%" height={150 + insets.top} borderRadius={0} />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Skeleton
                width={AVATAR_SIZE}
                height={AVATAR_SIZE}
                borderRadius={AVATAR_SIZE / 2}
                style={{ marginTop: -AVATAR_SIZE / 2, borderWidth: 4, borderColor: colors.background }}
              />
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                <Skeleton width="55%" height={22} />
                <Skeleton width="35%" height={14} />
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Skeleton height={80} borderRadius={radius.lg} />
              </View>
              {["Games", "Shows & Movies", "Platforms", "Playstyle"].map((label) => (
                <View key={label} style={{ marginTop: spacing.md }}>
                  <Skeleton height={36} borderRadius={radius.pill} />
                </View>
              ))}
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
                  marginTop: -AVATAR_SIZE / 2,
                  borderWidth: 4,
                  borderColor: colors.background,
                  backgroundColor: colors.surface,
                  overflow: "hidden",
                  ...shadow,
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
                <Card luminous style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <Name variant="cardName" style={{ color: colors.text }}>
                    {profile.display_name}
                  </Name>
                  {age !== null && regionLabel && (
                    <Text style={[type.caption, { color: colors.textMuted }]}>
                      {age} · {regionLabel}
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", marginTop: spacing.xs }}>
                    <Button label="Edit profile" onPress={() => router.push("/edit-details")} />
                  </View>
                </Card>
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

              <View style={{ marginTop: spacing.lg, gap: spacing.lg }}>
                {/* PromptsSection owns its own "Prompts" heading; the Edit link is laid
                    on top rather than threaded into the shared component's props, so
                    prompt editing (a separate screen from the rest of edit-details) stays
                    a call-site concern instead of a section-component one. */}
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

                <GamesSection
                  games={(details?.games ?? []).map((game) => ({
                    name: game.name,
                    skillLevel: SKILL_LABELS[game.skillLevel],
                    rank: game.rankText,
                  }))}
                />

                <HowIPlaySection
                  platforms={(details?.platforms ?? []).map((platform) => PLATFORM_LABELS[platform])}
                  playstyles={(details?.playstyles ?? []).map((tag) => PLAYSTYLE_LABELS[tag])}
                />

                <VibeSection vibe={editableDetails?.vibe ?? null} />

                <MetaLine playWindow={playWindowLabel} />

                {ownVoiceIntro && (
                  <VoiceIntroPlayer url={ownVoiceIntro.url} durationSeconds={ownVoiceIntro.durationSeconds} />
                )}

                <ShowsSection shows={details?.shows ?? []} />
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
