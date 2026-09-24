import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { GrainOverlay } from "@/components/GrainOverlay";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { PLATFORM_LABELS, PLAYSTYLE_LABELS, SKILL_LABELS, formatPlayWindow } from "@/features/onboarding/profile-labels";
import { OwnCardSection } from "@/features/profile/OwnCardSection";
import { ownPictureState } from "@/features/profile/pictureStatus";
import { OWN_CARD_HEIGHT } from "@/features/profile/profileTab";
import { HowIPlaySection, MetaLine, PromptsSection, ShowsSection, VibeSection } from "@/features/profile/sections";
import { useEditableProfileDetails } from "@/features/profile/useEditableProfileDetails";
import { useOwnProfileDetails } from "@/features/profile/useOwnProfileDetails";
import { useOwnProfilePhotos } from "@/features/profile/useOwnProfilePhotos";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { useVerifiedStats } from "@/features/profile/useVerifiedStats";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

// The bento grid's half-tiles: two per row with spacing.sm between them.
const HALF_TILE_WIDTH = "48.5%";
// First-reveal cascade: 45ms per block, capped so a full page settles inside ~400ms.
const STAGGER_STEP_MS = 45;
const STAGGER_CAP_MS = 400;

export default function ProfileScreen() {
  const { colors, radius, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);

  // First-reveal gate for the stagger cascade: flips true the first time pageReady goes true and
  // then latches, so background refetches never replay the entrance.
  const hasRevealedRef = useRef(false);

  const profile = useSessionStore((s) => s.profile);
  const { data: photos, isLoading: photosLoading } = useOwnProfilePhotos(profile?.id);
  const { data: prompts, isLoading: promptsLoading } = useOwnPrompts(profile?.id);
  const { data: details, isLoading: detailsLoading } = useOwnProfileDetails(profile?.id);
  const { data: editableDetails, isLoading: editableLoading } = useEditableProfileDetails(profile?.id);
  const { data: verifiedByName } = useVerifiedStats(profile?.id);

  // Warm the picture your card will draw while the other queries finish, so it doesn't pop in
  // late. ownPictureState's url, not the raw row: a rejected picture is never drawn, and an
  // approved old cover stands in for a missing one.
  const pictureUrl = photos ? ownPictureState(photos).url : null;
  useEffect(() => {
    if (pictureUrl) void Image.prefetch([pictureUrl], "memory-disk");
  }, [pictureUrl]);

  const pageReady = !photosLoading && !promptsLoading && !detailsLoading && !editableLoading;

  const isFirstReveal = pageReady && !hasRevealedRef.current;
  useEffect(() => {
    if (pageReady) hasRevealedRef.current = true;
  }, [pageReady]);

  // From the details query, which Edit invalidates on save. The session profile's
  // usual_play_* columns stayed stale after an edit because nothing refreshes the session.
  const playWindowLabel = editableDetails
    ? formatPlayWindow(editableDetails.playWindow.startHour, editableDetails.playWindow.endHour)
    : null;

  const gamesList = (details?.games ?? []).map((game) => ({
    name: game.name,
    skillLevel: SKILL_LABELS[game.skillLevel],
    rank: game.rankText,
  }));
  const platformsList = (details?.platforms ?? []).map((platform) => PLATFORM_LABELS[platform]);
  const playstylesList = (details?.playstyles ?? []).map((tag) => PLAYSTYLE_LABELS[tag]);
  const showsList = details?.shows ?? [];
  const vibe = editableDetails?.vibe ?? null;

  let staggerSlot = 0;
  function nextDelay(): number {
    return Math.min(staggerSlot++ * STAGGER_STEP_MS, STAGGER_CAP_MS);
  }
  function revealEntering() {
    return isFirstReveal ? FadeInDown.springify().delay(nextDelay()) : undefined;
  }

  // The atmosphere lags a beat behind the content: 0.15x scroll rate, capped at 40px.
  const atmosphereDriftStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [0, 267], [0, -40], Extrapolation.CLAMP);
    return { transform: [{ translateY }] };
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, atmosphereDriftStyle]}>
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
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Skeleton width={110} height={24} />
                <Skeleton width={64} height={32} borderRadius={radius.button} />
              </View>
              <Skeleton height={OWN_CARD_HEIGHT} borderRadius={radius.card} />
              <Skeleton width="100%" height={120} borderRadius={radius.card} />
            </>
          ) : (
            profile && (
              <View style={{ gap: spacing.lg }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={[type.screenTitle, { color: colors.text }]}>Profile</Text>
                  <Button size="sm" label="Edit" onPress={() => router.push("/edit-details")} />
                </View>

                <Animated.View entering={revealEntering()}>
                  <OwnCardSection profile={profile} />
                </Animated.View>

                {/* Today's tiles, each rendered only when its data is non-empty. */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
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
                              <Chip key={game.name} label={game.name} detail={game.rank || game.skillLevel || undefined} />
                            );
                          })}
                        </View>
                      </Card>
                    </Animated.View>
                  )}

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

                  {vibe && (
                    <Animated.View entering={revealEntering()} style={{ width: "100%" }}>
                      <Card style={{ padding: spacing.tight }}>
                        <VibeSection vibe={vibe} footerDivider />
                      </Card>
                    </Animated.View>
                  )}

                  {showsList.length > 0 && (
                    <Animated.View entering={revealEntering()} style={{ width: "100%" }}>
                      <Card style={{ padding: spacing.tight }}>
                        <ShowsSection shows={showsList} />
                      </Card>
                    </Animated.View>
                  )}

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

      {/* Fixed backdrop so content never passes behind the status bar icons with nothing behind it. */}
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
