import { useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/Chip";
import { Name } from "@/components/Name";
import { PageDots } from "@/components/PageDots";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { VoiceIntroPlayer } from "@/components/VoiceIntroPlayer";
import {
  MATCH_FEEDBACK_LABELS,
  PLATFORM_LABELS,
  PLAYSTYLE_LABELS,
  REGION_LABELS,
  SKILL_LABELS,
} from "@/features/onboarding/profile-labels";
import { usePublicLinkedAccounts } from "@/features/profile/useLinkedAccounts";
import { GamesSection, HowIPlaySection, MetaLine, PromptsSection, ShowsSection, VibeSection } from "@/features/profile/sections";
import { usePublicVoiceIntro } from "@/features/profile/useVoiceIntro";
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
 * screen so a game/vibe/prompt reads identically whether it's yours or someone else's. */
export function ProfileDetailContent({ card, onClose, readOnly = false }: ProfileDetailContentProps) {
  const { colors, spacing, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { data: reputation, isLoading: reputationLoading } = usePublicReputation(card.profile_id);
  const { data: voiceIntro, isLoading: voiceIntroLoading } = usePublicVoiceIntro(card.profile_id);
  const { data: linkedAccounts, isLoading: linkedAccountsLoading } = usePublicLinkedAccounts(card.profile_id);

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

  function handlePageScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
    setPhotoIndex(Math.min(Math.max(index, 0), photos.length - 1));
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <View style={{ width: "100%", aspectRatio: PHOTO_ASPECT, backgroundColor: colors.surface }}>
        {photos.length > 0 && (
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
            <Ionicons name="shield-checkmark" size={20} color={colors.brand} />
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

        {voiceIntroLoading ? (
          <Skeleton width={160} height={40} borderRadius={radius.chip} />
        ) : (
          voiceIntro && <VoiceIntroPlayer url={voiceIntro.url} durationSeconds={voiceIntro.durationSeconds} />
        )}

        <View style={{ gap: spacing.lg, marginTop: spacing.xs }}>
          <GamesSection
            games={card.topGames.map((g) => ({ name: g.name, skillLevel: SKILL_LABELS[g.skillLevel], rank: undefined }))}
          />

          <HowIPlaySection
            platforms={card.platforms.map((p) => PLATFORM_LABELS[p])}
            playstyles={card.playstyles.map((tag) => PLAYSTYLE_LABELS[tag as keyof typeof PLAYSTYLE_LABELS] ?? tag)}
          />

          <VibeSection vibe={card.vibe} />

          {showReputation && (
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
          )}

          <ShowsSection shows={card.topShows} />

          <PromptsSection prompts={card.prompts} />
        </View>
      </View>
    </ScrollView>
  );
}
