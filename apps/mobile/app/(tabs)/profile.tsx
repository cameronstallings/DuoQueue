import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  ReduceMotion,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollViewOffset,
} from "react-native-reanimated";

import { Button } from "@/components/Button";
import { GrainOverlay } from "@/components/GrainOverlay";
import { GraticuleBackground } from "@/components/GraticuleBackground";
import { Skeleton } from "@/components/Skeleton";
import { PLAYSTYLE_LABELS, TILT_HANDLING_LABELS } from "@/features/onboarding/profile-labels";
import { GamesPanel } from "@/features/profile/GamesPanel";
import { howIPlayTiles } from "@/features/profile/howIPlay";
import { HowIPlayGrid } from "@/features/profile/HowIPlayGrid";
import { OwnCardSection } from "@/features/profile/OwnCardSection";
import { ownPictureState } from "@/features/profile/pictureStatus";
import { OWN_CARD_HEIGHT } from "@/features/profile/profileTab";
import { PromptQuotes } from "@/features/profile/PromptQuotes";
import { ShowsSection } from "@/features/profile/sections";
import { useEditableProfileDetails } from "@/features/profile/useEditableProfileDetails";
import { useOwnProfilePhotos } from "@/features/profile/useOwnProfilePhotos";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { useVerifiedStats } from "@/features/profile/useVerifiedStats";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

// First-reveal cascade: 45ms per block, capped so a full page settles inside ~400ms.
const STAGGER_STEP_MS = 45;
const STAGGER_CAP_MS = 400;

function ProfileSkeleton() {
  const { radius, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Skeleton width={140} height={12} />
      <Skeleton height={OWN_CARD_HEIGHT} borderRadius={radius.card} />
      <Skeleton width="90%" height={14} />
      <Skeleton width="70%" height={14} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="48.5%" height={76} borderRadius={radius.card} />
        ))}
      </View>
      <Skeleton height={104} borderRadius={radius.card} />
    </View>
  );
}

/**
 * The Profile tab: a fixed header, then your card (HOW OTHERS SEE YOU), then blocks that each
 * change rhythm: a 2x2 tile grid, your prompts as open quotes, 44pt rows, loose chips.
 * Photos and the completeness meter live in Edit.
 */
export default function ProfileScreen() {
  const { colors, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);
  // First-reveal gate for the stagger cascade: flips true the first time pageReady goes true and
  // then latches, so background refetches never replay the entrance.
  const hasRevealedRef = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(insets.top + 64);

  const profile = useSessionStore((s) => s.profile);
  const { data: photos, isLoading: photosLoading } = useOwnProfilePhotos(profile?.id);
  const { data: prompts, isLoading: promptsLoading } = useOwnPrompts(profile?.id);
  const { data: editable, isLoading: editableLoading } = useEditableProfileDetails(profile?.id);
  const { data: verifiedByName } = useVerifiedStats(profile?.id);

  // Warm the picture your card will draw while the other queries finish, so it doesn't pop in
  // late. ownPictureState's url, not the raw row: a rejected picture is never drawn, and an
  // approved old cover stands in for a missing one.
  const pictureUrl = photos ? ownPictureState(photos).url : null;
  useEffect(() => {
    if (pictureUrl) void Image.prefetch([pictureUrl], "memory-disk");
  }, [pictureUrl]);

  // Your card shows its own skeleton while get_profile_card loads (and nothing to wait for when
  // the profile is paused), so the page gate leaves it out.
  const pageReady = !photosLoading && !promptsLoading && !editableLoading;
  const isFirstReveal = pageReady && !hasRevealedRef.current;
  useEffect(() => {
    if (pageReady) hasRevealedRef.current = true;
  }, [pageReady]);

  let staggerSlot = 0;
  function revealEntering() {
    if (!isFirstReveal) return undefined;
    const delay = Math.min(staggerSlot++ * STAGGER_STEP_MS, STAGGER_CAP_MS);
    return reduced
      ? FadeIn.duration(200).delay(delay).reduceMotion(ReduceMotion.Never)
      : FadeInDown.springify().delay(delay);
  }

  // The atmosphere lags a beat behind the content: 0.15x scroll rate, capped at 40px.
  const atmosphereDriftStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [0, 267], [0, -40], Extrapolation.CLAMP);
    return { transform: [{ translateY }] };
  });
  // The header gets its bottom rule once content scrolls under it.
  const headerRuleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 12], [0, 1], Extrapolation.CLAMP),
  }));

  const tiles = editable
    ? howIPlayTiles({
        vibe: editable.vibe,
        playstyles: editable.playstyles,
        playWindow: editable.playWindow,
        playstyleLabels: PLAYSTYLE_LABELS,
        tiltLabels: TILT_HANDLING_LABELS,
      })
    : [];
  const shows = (editable?.shows ?? []).map((show) => show.name);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, atmosphereDriftStyle]}>
        <GraticuleBackground />
      </Animated.View>
      <GrainOverlay />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: headerHeight + spacing.sm,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
        }}
      >
        {!pageReady || !profile ? (
          <ProfileSkeleton />
        ) : (
          <View style={{ gap: spacing.xl }}>
            <Animated.View entering={revealEntering()}>
              <OwnCardSection profile={profile} />
            </Animated.View>

            {tiles.length > 0 && (
              <Animated.View entering={revealEntering()}>
                <HowIPlayGrid tiles={tiles} />
              </Animated.View>
            )}

            {prompts && prompts.length > 0 && (
              <Animated.View entering={revealEntering()}>
                <PromptQuotes prompts={prompts} />
              </Animated.View>
            )}

            {editable && editable.games.length > 0 && (
              <Animated.View entering={revealEntering()}>
                <GamesPanel games={editable.games} verifiedByName={verifiedByName ?? {}} />
              </Animated.View>
            )}

            {shows.length > 0 && (
              <Animated.View entering={revealEntering()}>
                <ShowsSection shows={shows} />
              </Animated.View>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {/* Fixed header: it also covers the status bar, so nothing scrolls under the clock. */}
      <View
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.background,
        }}
      >
        <Text style={[type.screenTitle, { color: colors.text }]}>Profile</Text>
        <Button size="sm" label="Edit" onPress={() => router.push("/edit-details")} />
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.border }, headerRuleStyle]}
        />
      </View>
    </View>
  );
}
