import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollViewOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GraticuleBackground } from "@/components/GraticuleBackground";
import { Chip } from "@/components/Chip";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Name } from "@/components/Name";
import { PlayerMark } from "@/components/PlayerMark";
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
import { stackSpringEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { DUO_DETAIL_CAPTION, cardPicture, detailGames, showsDuoLabel } from "./cardChips";
import type { DeckCard } from "./types";

const PROVIDER_LABELS = { steam: "Steam", riot: "Riot Games", xbox: "Xbox" } as const;
const PHOTO_ASPECT = 0.85;
/** The recessed band that stands in for a missing picture (plus the status bar inset). */
const NO_PICTURE_HERO_HEIGHT = 160;

interface ProfileDetailContentProps {
  card: DeckCard;
  onClose: () => void;
  /** Reserved for Task 18's matched-profile route. Doesn't change rendering today —
   * like/pass buttons were never part of this component, so there's nothing to hide. */
  readOnly?: boolean;
}

/** The full, spacious "everything about this person" view: their one picture, then every
 * game/show/playstyle and every prompt. Used by the Standouts detail modal, the deck's "See full
 * profile" and the /profile/[profileId] route. The full rebuild (the same card on top, a YOU TWO
 * strip) is 1.0.1; build 12 only drops the gallery pager and the duplicate avatar.
 *
 * Owns its own GraticuleBackground + GrainOverlay (rather than leaving that to call
 * sites) so every caller gets the same atmosphere and the same scroll-linked motion. */
export function ProfileDetailContent({ card, onClose, readOnly = false }: ProfileDetailContentProps) {
  const { colors, spacing, radius, type } = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { data: reputation, isLoading: reputationLoading } = usePublicReputation(card.profile_id);
  const { data: linkedAccounts, isLoading: linkedAccountsLoading } = usePublicLinkedAccounts(card.profile_id);
  const { data: verifiedByName } = useVerifiedStats(card.profile_id);

  const regionLabel = REGION_LABELS[card.region] ?? card.region;
  const reputationTags = reputation ?? [];
  const showReputation = reputationLoading || reputationTags.length > 0;

  // One picture: the profile picture, else an old cover (cardChips.ts). No gallery, no pager.
  const picture = cardPicture(card);
  const photoHeight = windowWidth / PHOTO_ASPECT;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);

  // Atmosphere drifts a beat behind the content: same 0.15x rate, 40px cap as the Profile tab.
  const atmosphereDriftStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [0, 267], [0, -40], Extrapolation.CLAMP);
    return { transform: [{ translateY }] };
  });

  // Classic stretchy header: a 0.5x parallax lag on scroll, an elastic stretch on overscroll.
  const heroPhotoStyle = useAnimatedStyle(() => {
    const parallax = interpolate(scrollY.value, [0, 300], [0, 150], Extrapolation.CLAMP);
    const stretch = interpolate(scrollY.value, [-150, 0], [1.25, 1], { extrapolateRight: Extrapolation.CLAMP });
    return { transform: [{ translateY: parallax }, { scale: stretch }] };
  });

  // Cascade-on-open: each labeled section steps in 35ms after the last, once, on the stack spring.
  // Under Reduce Motion a springified fade builder cuts its opacity too, and every section popped
  // in; there they are a plain fade, all at once (stackSpringEntering, theme/entering.ts).
  let staggerSlot = 0;
  function sectionEntering() {
    const delay = Math.min(staggerSlot++ * 35, 350);
    return stackSpringEntering(FadeInDown.delay(delay), reduced);
  }

  const closeButton = (
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
        backgroundColor: picture ? "rgba(0,0,0,0.35)" : colors.surfaceAlt,
      }}
    >
      <Ionicons name="close" size={22} color={picture ? "#fff" : colors.text} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, atmosphereDriftStyle]}>
        <GraticuleBackground />
      </Animated.View>
      <GrainOverlay />

      <Animated.ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {picture ? (
          <View style={{ width: "100%", aspectRatio: PHOTO_ASPECT, backgroundColor: colors.surface, overflow: "hidden" }}>
            <Animated.View style={[{ width: "100%", height: photoHeight }, heroPhotoStyle]}>
              <Image
                source={{ uri: picture }}
                style={{ width: windowWidth, height: photoHeight }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            </Animated.View>
            <LinearGradient
              colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
              pointerEvents="none"
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 44 }}
            />
            {closeButton}
          </View>
        ) : (
          <View
            style={{
              width: "100%",
              height: insets.top + NO_PICTURE_HERO_HEIGHT,
              alignItems: "center",
              justifyContent: "flex-end",
              overflow: "hidden",
              backgroundColor: colors.cardRecessed,
            }}
          >
            <PlayerMark
              name={card.display_name}
              size={NO_PICTURE_HERO_HEIGHT}
              shape="none"
              color={colors.cardMark}
              glyphScale={0.8}
            />
            {closeButton}
          </View>
        )}

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Name variant="cardName" style={{ color: colors.text, flexShrink: 1 }}>
              {`${card.display_name}, ${card.age}`}
            </Name>
            {card.isRecentlyActive && (
              <View
                accessible
                accessibilityLabel="Active recently"
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }}
              />
            )}
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
                {/* League's detail is its canonical rank; every other game keeps its skill level
                    and never shows a rank to a stranger. See cardChips.ts. */}
                <GamesSection games={detailGames(card, SKILL_LABELS)} verifiedByName={verifiedByName} />
                {showsDuoLabel(card) && (
                  <Text style={[type.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{DUO_DETAIL_CAPTION}</Text>
                )}
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
