import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatLolRank } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { GrainOverlay } from "@/components/GrainOverlay";
import { GraticuleBackground } from "@/components/GraticuleBackground";
import { Skeleton } from "@/components/Skeleton";
import { Pager, PagerPage } from "@/features/pager/Pager";
import { PagerDots } from "@/features/pager/PagerDots";
import { footFade } from "@/features/pager/pagerMath";
import { type PagerController, usePager } from "@/features/pager/usePager";
import { ownPictureState } from "@/features/profile/pictureStatus";
import { useEditableProfileDetails } from "@/features/profile/useEditableProfileDetails";
import { useOwnProfilePhotos } from "@/features/profile/useOwnProfilePhotos";
import { useProfileCard } from "@/features/profile/useProfileCard";
import { CanDuoTourPage, CardTourPage, LockedTourPage, TourHeading, YourCardTourPage } from "@/features/tour/TourPictures";
import {
  TOUR_COPY,
  TOUR_FOOT,
  tourPages,
  tourPictureHeight,
  tourRank,
  tourRankLine,
  yourCardBody,
  type TourPage,
} from "@/features/tour/tourPages";
import { hasSeenTour, markTourSeen } from "@/features/tour/tourSeen";
import { hapticSuccess } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

/** The last slot: Skip on pages 1 to 3, the 57pt Start swiping button on the last. */
const FOOT_SLOT = 57;

function SkipButton({ onPress }: { onPress: () => void }) {
  const { colors, spacing, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={12}
      style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}
    >
      <Text style={[type.bodyStrong, { color: colors.textMuted }]}>{TOUR_FOOT.skip}</Text>
    </Pressable>
  );
}

function TourFoot({ pager, onFinish, bottomInset }: { pager: PagerController; onFinish: () => void; bottomInset: number }) {
  const { spacing } = useTheme();
  const { scrollX, width, count } = pager;
  const lastIndex = count - 1;
  const skipStyle = useAnimatedStyle(() => ({ opacity: footFade(scrollX.value, lastIndex, width).skip }));
  const startStyle = useAnimatedStyle(() => ({ opacity: footFade(scrollX.value, lastIndex, width).start }));
  // Taps and VoiceOver follow the page the pager has settled on, never the half-faded one.
  const onLast = pager.page === lastIndex;

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: bottomInset + spacing.md, gap: spacing.sm }}>
      <PagerDots pager={pager} label={TOUR_FOOT.dotsLabel} />
      <View style={{ height: FOOT_SLOT }}>
        <Animated.View
          pointerEvents={onLast ? "none" : "auto"}
          accessibilityElementsHidden={onLast}
          importantForAccessibility={onLast ? "no-hide-descendants" : "auto"}
          style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }, skipStyle]}
        >
          <SkipButton onPress={onFinish} />
        </Animated.View>
        <Animated.View
          pointerEvents={onLast ? "auto" : "none"}
          accessibilityElementsHidden={!onLast}
          importantForAccessibility={onLast ? "auto" : "no-hide-descendants"}
          style={[StyleSheet.absoluteFill, { justifyContent: "center" }, startStyle]}
        >
          <Button label={TOUR_FOOT.start} onPress={onFinish} />
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * The tour: four pages (three without a League rank in NA), once per account, right after profile
 * setup (discord.tsx replaces to here) and one tap before the first Deck. Swipe only, Skip on every
 * page, "Start swiping" on the last. The App Review demo account is already onboarded and never
 * comes here.
 */
export default function WelcomeScreen() {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const userId = useSessionStore((s) => s.session?.user.id);
  const isActive = useSessionStore((s) => s.profile?.is_active ?? true);
  const refreshProfile = useSessionStore((s) => s.refreshProfile);
  const [seen, setSeen] = useState<boolean | null>(null);

  // The facts that decide the pages, from the reads the Profile tab makes. The wizard's submit
  // already set onboarding_completed on the server, so get_profile_card returns this card.
  const details = useEditableProfileDetails(userId);
  const card = useProfileCard(userId ?? "", { enabled: isActive });
  const { data: photos } = useOwnProfilePhotos(userId);
  const factsReady = !details.isPending && (!isActive || !card.isPending);

  const games = details.data?.games ?? [];
  const pages = tourPages({ region: card.data?.region ?? null, games });
  const rank = tourRank(games);
  const rankLabel = pages.includes("canDuo") && rank ? formatLolRank(rank) : null;
  const pictureHeight = tourPictureHeight(height, insets);

  const skipTour = !userId || seen === true;
  const ready = !skipTour && seen === false && factsReady;
  const pager = usePager(pages.length, { peekReady: ready });

  useEffect(() => {
    hapticSuccess();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void hasSeenTour(AsyncStorage, userId).then((value) => {
      if (alive) setSeen(value);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const finishing = useRef(false);
  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    if (userId) await markTourSeen(AsyncStorage, userId);
    // Before the Deck, as the old welcome screen did: (tabs)/_layout sends a stale profile
    // (onboarding_completed still false in the store) back into onboarding.
    await refreshProfile();
    router.replace("/(tabs)");
  }, [userId, refreshProfile]);

  // Once per account: a second arrival (a deep link, a replayed route) goes straight on.
  useEffect(() => {
    if (skipTour) void finish();
  }, [skipTour, finish]);

  function picture(page: TourPage) {
    switch (page) {
      case "card":
        return <CardTourPage height={pictureHeight} rankLabel={rankLabel} />;
      case "canDuo":
        return rank && rankLabel ? <CanDuoTourPage height={pictureHeight} rankLabel={rankLabel} line={tourRankLine(rank)} /> : null;
      case "locked":
        return <LockedTourPage height={pictureHeight} />;
      case "yours":
        return <YourCardTourPage height={pictureHeight} profile={{ id: userId ?? "", is_active: isActive }} />;
    }
  }

  function copy(page: TourPage) {
    if (page !== "yours") return TOUR_COPY[page];
    return { ...TOUR_COPY.yours, body: yourCardBody(photos ? ownPictureState(photos).tag : null) };
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GraticuleBackground />
      <GrainOverlay />
      {ready ? (
        <>
          <Pager pager={pager}>
            {pages.map((page, index) => (
              <PagerPage key={page} pager={pager} index={index}>
                <View
                  style={{
                    flex: 1,
                    paddingTop: insets.top + spacing.tight,
                    paddingHorizontal: spacing.lg,
                    gap: spacing.lg - spacing.xs,
                  }}
                >
                  {picture(page)}
                  <TourHeading copy={copy(page)} />
                </View>
              </PagerPage>
            ))}
          </Pager>
          <TourFoot pager={pager} onFinish={() => void finish()} bottomInset={insets.bottom} />
        </>
      ) : (
        <View style={{ flex: 1, paddingTop: insets.top + spacing.tight, paddingHorizontal: spacing.lg }}>
          <Skeleton height={pictureHeight} borderRadius={radius.card} />
          {/* Offline, TanStack parks the reads that decide the pages, so this could wait for
              ever: Skip is here too, and the Deck is never more than one tap away. */}
          <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: insets.bottom + spacing.md }}>
            {skipTour ? null : <SkipButton onPress={() => void finish()} />}
          </View>
        </View>
      )}
    </View>
  );
}
