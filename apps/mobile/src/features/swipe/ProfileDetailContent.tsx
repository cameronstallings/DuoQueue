import { useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { Chip } from "@/components/Chip";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Name } from "@/components/Name";
import { PageDots } from "@/components/PageDots";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import {
  MATCH_FEEDBACK_LABELS,
  PLATFORM_LABELS,
  PLAYSTYLE_LABELS,
  REGION_LABELS,
  SKILL_LABELS,
} from "@/features/onboarding/profile-labels";
import { usePublicLinkedAccounts } from "@/features/profile/useLinkedAccounts";
import { GamesSection, HowIPlaySection, MetaLine, PromptsSection, ShowsSection, VibeSection } from "@/features/profile/sections";
import { useVerifiedStats } from "@/features/profile/useVerifiedStats";
import { usePublicReputation } from "@/features/reputation/useReputation";
import { useTheme } from "@/theme/useTheme";

import type { DeckCard } from "./types";

const PROVIDER_LABELS = { steam: "Steam", riot: "Riot Games", xbox: "Xbox" } as const;
const PHOTO_ASPECT = 0.85;

interface ProfileDetailContentProps {
  card: DeckCard;
  onClose: () => void;
  /** Reserved for Task 18's matched-profile route. Doesn't change rendering today —
   * like/pass buttons were never part of this component, so there's nothing to hide. */
  readOnly?: boolean;
}

/** The full, spacious "everything about this person" view — header photo, avatar,
 * every game/show/playstyle, and every prompt. Used both by the Standouts detail modal
 * and the main deck's "See full profile" flow, since a swipe card only has room to show
 * the highlights at a glance. Built from the same section components as the own-profile
 * screen so a game/vibe/prompt reads identically whether it's yours or someone else's.
 *
 * Owns its own GraticuleBackground + GrainOverlay (rather than leaving that to call
 * sites) so every caller — the deck's swipe-to-detail modal, the Standouts modal, and
 * the /profile/[profileId] route — gets the same atmosphere and the same scroll-linked
 * motion for free, off one Animated.ScrollView. */
export function ProfileDetailContent({ card, onClose, readOnly = false }: ProfileDetailContentProps) {
  const { colors, spacing, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { data: reputation, isLoading: reputationLoading } = usePublicReputation(card.profile_id);
  const { data: linkedAccounts, isLoading: linkedAccountsLoading } = usePublicLinkedAccounts(card.profile_id);
  const { data: verifiedByName } = useVerifiedStats(card.profile_id);

  const regionLabel = REGION_LABELS[card.region] ?? card.region;
  const reputationTags = reputation ?? [];
  const showReputation = reputationLoading || reputationTags.length > 0;

  // Header photo first, then approved gallery photos by position — falls back to the
  // plain blank photo box below when both are empty. Unlike the deck card, this pager
  // uses a real horizontal FlatList: it sits in its own Modal with no competing pan
  // gesture, so there's nothing for the scroll to fight.
  const photos = [card.headerPhotoUrl, ...card.galleryUrls].filter((url): url is string => !!url);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photoHeight = windowWidth / PHOTO_ASPECT;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);

  // Atmosphere drifts a beat behind the content — same 0.15x rate, 40px cap as the
  // own-profile screen, so both places share one "depth" language.
  const auroraDriftStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [0, 267], [0, -40], Extrapolation.CLAMP);
    return { transform: [{ translateY }] };
  });

  // Classic stretchy header, split into two non-overlapping regimes so the transforms
  // never fight: translateY (the 0.5x parallax lag) is neutral at 0 for any overscroll
  // pull, and scale (the elastic stretch) is neutral at 1 for any downward scroll — so
  // a single transform array covers both without special-casing the sign of scrollY.
  // The outer frame clips (`overflow: hidden`) so the parallax lag never bleeds past
  // the photo's own box into the content below it.
  const heroPhotoStyle = useAnimatedStyle(() => {
    const parallax = interpolate(scrollY.value, [0, 300], [0, 150], Extrapolation.CLAMP);
    const stretch = interpolate(scrollY.value, [-150, 0], [1.25, 1], { extrapolateRight: Extrapolation.CLAMP });
    return { transform: [{ translateY: parallax }, { scale: stretch }] };
  });

  // The bottom scrim deepens as the photo scrolls away — without this, the moment the
  // parallax has pulled the photo furthest from rest is exactly when the dots/seam
  // into content would otherwise be reading against the least contrast.
  const scrimBoostStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, photoHeight * 0.6], [0, 1], Extrapolation.CLAMP);
    return { opacity };
  });

  function handlePageScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
    setPhotoIndex(Math.min(Math.max(index, 0), photos.length - 1));
  }

  // Cascade-on-open: each labeled section below steps in 35ms after the last, once, as
  // this content mounts. Never replayed by a section's own loading→loaded swap (e.g.
  // Reputation's skeleton-to-chips swap) — those happen *inside* an already-mounted
  // wrapper, not by remounting it. Conditional sections that don't render simply never
  // consume a delay slot, same compacting trick as the own-profile screen.
  let staggerSlot = 0;
  function sectionEntering() {
    return FadeInDown.springify().delay(Math.min(staggerSlot++ * 35, 350));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, auroraDriftStyle]}>
        <GraticuleBackground />
      </Animated.View>
      <GrainOverlay />

      <Animated.ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View
          style={{
            width: "100%",
            aspectRatio: PHOTO_ASPECT,
            backgroundColor: colors.surface,
            overflow: "hidden",
          }}
        >
          {photos.length > 0 && (
            <Animated.View style={[{ width: "100%", height: photoHeight }, heroPhotoStyle]}>
              <FlatList
                data={photos}
                style={{ width: "100%", height: photoHeight }}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(url, index) => `${index}-${url}`}
                onMomentumScrollEnd={handlePageScrollEnd}
                onScrollEndDrag={handlePageScrollEnd}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={{ width: windowWidth, height: photoHeight }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                )}
              />
            </Animated.View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
            pointerEvents="none"
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 44 }}
          />
          {photos.length > 1 && (
            <>
              <LinearGradient
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]}
                pointerEvents="none"
                style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 56 }}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  { position: "absolute", left: 0, right: 0, bottom: 0, height: 56, backgroundColor: "rgba(0,0,0,0.35)" },
                  scrimBoostStyle,
                ]}
              />
              <View style={{ position: "absolute", left: 0, right: 0, bottom: spacing.sm }}>
                <PageDots count={photos.length} activeIndex={photoIndex} />
              </View>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={{
              position: "absolute",
              top: insets.top + spacing.sm,
              right: spacing.md,
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <PresenceAvatar
              uri={card.profilePhotoUrl}
              size={48}
              isActive={card.isRecentlyActive}
              backdropColor={colors.background}
              borderColor={colors.background}
              borderWidth={2}
            />
            <Name variant="cardName" style={{ color: colors.text }}>
              {`${card.display_name}, ${card.age}`}
            </Name>
            {!linkedAccountsLoading && linkedAccounts && linkedAccounts.length > 0 && (
              <Ionicons name="shield-checkmark" size={20} color={colors.volt} />
            )}
          </View>

          <MetaLine region={regionLabel} languages={card.languages} playWindow={card.playWindowLabel} />

          {linkedAccountsLoading ? (
            <Skeleton width={150} height={14} />
          ) : (
            linkedAccounts &&
            linkedAccounts.length > 0 && (
              <Text style={[type.caption, { color: colors.textMuted }]}>
                Verified: {linkedAccounts.map((a) => PROVIDER_LABELS[a.provider]).join(", ")}
              </Text>
            )
          )}

          <View style={{ gap: spacing.lg, marginTop: spacing.xs }}>
            {card.topGames.length > 0 && (
              <Animated.View entering={sectionEntering()}>
                <GamesSection
                  games={card.topGames.map((g) => ({ name: g.name, skillLevel: SKILL_LABELS[g.skillLevel], rank: undefined }))}
                  verifiedByName={verifiedByName}
                />
              </Animated.View>
            )}

            {(card.platforms.length > 0 || card.playstyles.length > 0) && (
              <Animated.View entering={sectionEntering()}>
                <HowIPlaySection
                  platforms={card.platforms.map((p) => PLATFORM_LABELS[p])}
                  playstyles={card.playstyles.map((tag) => PLAYSTYLE_LABELS[tag as keyof typeof PLAYSTYLE_LABELS] ?? tag)}
                />
              </Animated.View>
            )}

            {card.vibe && (
              <Animated.View entering={sectionEntering()}>
                <VibeSection vibe={card.vibe} />
              </Animated.View>
            )}

            {showReputation && (
              <Animated.View entering={sectionEntering()}>
                <View>
                  <SectionLabel>Reputation</SectionLabel>
                  {reputationLoading ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                      <Skeleton width={110} height={28} borderRadius={radius.chip} />
                      <Skeleton width={90} height={28} borderRadius={radius.chip} />
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                      {reputationTags.map((r) => (
                        <Chip key={r.tag} tone="success" label={MATCH_FEEDBACK_LABELS[r.tag]} detail={`×${r.tag_count}`} />
                      ))}
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            {card.topShows.length > 0 && (
              <Animated.View entering={sectionEntering()}>
                <ShowsSection shows={card.topShows} />
              </Animated.View>
            )}

            {card.prompts.length > 0 && (
              <Animated.View entering={sectionEntering()}>
                <PromptsSection prompts={card.prompts} />
              </Animated.View>
            )}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
