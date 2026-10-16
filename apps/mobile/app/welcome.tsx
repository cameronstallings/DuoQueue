import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatLolRank, type LolRank, type Region } from "@duoqueue/shared-types";

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
import { usePushAskStore } from "@/features/push/pushAskStore";
import { useDuoPopsOfferSeen } from "@/features/queue/DuoPopsOptInCard";
import { offeredWithinWeek } from "@/features/queue/duoPopsOptIn";
import { useDuoPopsSetting } from "@/features/queue/useDuoPopsSetting";
import {
  CanDuoTourPage,
  CardTourPage,
  LockedTourPage,
  QueueTourPage,
  TourHeading,
  YourCardTourPage,
} from "@/features/tour/TourPictures";
import {
  TOUR_COPY,
  TOUR_FOOT,
  TOUR_OFFLINE,
  queueTourBody,
  queueTourKind,
  tourDecidesDuoPops,
  tourOffersDuoPops,
  tourPages,
  tourPictureHeight,
  tourShowsDuoPops,
  tourRank,
  tourRankLine,
  yourCardBody,
  type TourPage,
} from "@/features/tour/tourPages";
import { hasSeenTour, markTourSeen } from "@/features/tour/tourSeen";
import { hapticSuccess } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

/** The last slot's least height: the 57pt Start swiping button at the default text size. It is a
 * floor, not a height, so a larger text size grows the slot with the button instead of pushing
 * the button into the dots. */
const FOOT_SLOT = 57;

/** Which view a finish started from, so the screen holds it until the replace lands. */
type TourView = "pager" | "skeleton";

/** What decides the pages, frozen the first time the tour shows (a late read never re-pages it). */
interface TourFacts {
  pages: TourPage[];
  rank: LolRank | null;
  rankLabel: string | null;
  /** Picks the Queue up page's sentence (Duo Pops reach North America only) and its offer. */
  region: Region | null;
}

/** The session profile says setup is finished, so (tabs)/_layout will let the Deck open. */
function onboardedNow(): boolean {
  return useSessionStore.getState().profile?.onboarding_completed === true;
}

function SkipButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  const { colors, spacing, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => ({
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        // Pressed and busy both answer the tap: a slow network never makes it look dead.
        opacity: pressed || busy ? 0.5 : 1,
      })}
    >
      <Text style={[type.bodyStrong, { color: colors.textMuted }]}>{TOUR_FOOT.skip}</Text>
    </Pressable>
  );
}

function TourFoot({
  pager,
  onFinish,
  busy,
  bottomInset,
}: {
  pager: PagerController;
  onFinish: () => void;
  busy: boolean;
  bottomInset: number;
}) {
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
      {/* Start swiping is in the flow, so the slot is as tall as the button; Skip is laid over
          it, centred. Start is drawn last, so it is on top where both could take a touch. */}
      <View style={{ minHeight: FOOT_SLOT, justifyContent: "center" }}>
        <Animated.View
          pointerEvents={onLast ? "none" : "auto"}
          accessibilityElementsHidden={onLast}
          importantForAccessibility={onLast ? "no-hide-descendants" : "auto"}
          style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }, skipStyle]}
        >
          <SkipButton onPress={onFinish} busy={busy} />
        </Animated.View>
        <Animated.View
          pointerEvents={onLast ? "auto" : "none"}
          accessibilityElementsHidden={!onLast}
          importantForAccessibility={onLast ? "auto" : "no-hide-descendants"}
          style={startStyle}
        >
          <Button label={TOUR_FOOT.start} onPress={onFinish} loading={busy} />
        </Animated.View>
      </View>
    </View>
  );
}

/** One tour page: the picture and its heading, scrolling when a larger text size makes them
 * taller than the page (as the paywall's pages do). At the default size nothing scrolls. Its 12
 * above, 20 between and 8 below are TOUR_PAGE_CHROME in tourPages.ts. */
function TourPageScroll({ topInset, children }: { topInset: number; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1 }}
      bounces={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: topInset + spacing.tight,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
        gap: spacing.lg - spacing.xs,
      }}
    >
      {children}
    </ScrollView>
  );
}

/**
 * The tour: five pages (four without a League rank in NA; Queue up is on every tour since build
 * 22), once per account, right after profile setup (discord.tsx replaces to here) and one tap
 * before the first Deck. Swipe only, Skip on every page, "Start swiping" on the last. The App
 * Review demo account is already onboarded and never comes here.
 */
export default function WelcomeScreen() {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const userId = useSessionStore((s) => s.session?.user.id);
  const isActive = useSessionStore((s) => s.profile?.is_active ?? true);
  const refreshProfile = useSessionStore((s) => s.refreshProfile);
  const [seen, setSeen] = useState<boolean | null>(null);
  const [leaving, setLeaving] = useState<TourView | null>(null);
  const [frozen, setFrozen] = useState<TourFacts | null>(null);

  // The facts that decide the pages, from the reads the Profile tab makes. The wizard's submit
  // already set onboarding_completed on the server, so get_profile_card returns this card.
  const details = useEditableProfileDetails(userId);
  const card = useProfileCard(userId ?? "", { enabled: isActive });
  const { data: photos } = useOwnProfilePhotos(userId);
  const factsReady = !details.isPending && (!isActive || !card.isPending);

  const skipTour = !userId || seen === true;
  const ready = !skipTour && seen === false && factsReady;

  // Frozen the first time the tour can show: a read that fails and then succeeds while the tour is
  // on screen (the card's retry on the last page's mount) must never add Can duo under the
  // player's thumb, move the dots from 4 to 5, or take the last page's Start swiping away.
  const games = details.data?.games ?? [];
  const liveRegion = card.data?.region ?? null;
  const livePages = tourPages({ region: liveRegion, games });
  const liveRank = tourRank(games);
  if (ready && frozen === null) {
    setFrozen({
      pages: livePages,
      rank: liveRank,
      rankLabel: livePages.includes("canDuo") && liveRank ? formatLolRank(liveRank) : null,
      region: liveRegion,
    });
  }
  const pages = frozen?.pages ?? livePages;
  const rank = frozen?.rank ?? null;
  const rankLabel = frozen?.rankLabel ?? null;
  const region = frozen?.region ?? null;

  // The Queue up page's "Get Duo Pops?" card: the deck's own opt-in, read from the one settings
  // cache, the one seen flag and the one weekly ask record the deck uses (useDuoPopsSetting,
  // useDuoPopsOfferSeen, the push-ask store; undefined until that record has loaded).
  const { queuePop } = useDuoPopsSetting();
  const [duoPopsSeen] = useDuoPopsOfferSeen(userId);
  const lastOfferedAt = usePushAskStore((s) => (s.loaded ? s.lastOfferedAt : undefined));
  const [offerDuoPops, setOfferDuoPops] = useState<boolean | null>(null);

  // The pager's height and each page's heading, measured: a larger text size wraps a body onto
  // more lines than the budget counts, and the picture then gives the tallest heading its room.
  const [pageHeight, setPageHeight] = useState(0);
  const [headingHeights, setHeadingHeights] = useState<Partial<Record<TourPage, number>>>({});
  const tallestHeading = Math.max(0, ...Object.values(headingHeights).filter((h) => h !== undefined));
  const pictureHeight = tourPictureHeight(height, insets, fontScale, { pageHeight, tallestHeading });
  const onHeadingHeight = useCallback((page: TourPage, measured: number) => {
    setHeadingHeights((prev) => (prev[page] === measured ? prev : { ...prev, [page]: measured }));
  }, []);

  // Once a finish starts, the view it started from stays until the replace lands: a Skip tapped
  // on the skeleton never flashes the pager because the facts arrived meanwhile.
  const showPager = leaving !== null ? leaving === "pager" && frozen !== null : ready && frozen !== null;
  const pager = usePager(pages.length, { peekReady: showPager });

  // Decided once, when the pager settles on the page before Queue up, while that page is still off
  // screen (tourDecidesDuoPops): whatever is not loaded by then means no card this time, never a
  // card that turns up under the player's eyes. The deck's card still has its own chance.
  const queueIndex = pages.indexOf("queue");
  if (showPager && offerDuoPops === null && tourDecidesDuoPops(pager.page, queueIndex)) {
    setOfferDuoPops(
      tourOffersDuoPops({ region, queuePop, seen: duoPopsSeen, askedWithinWeek: offeredWithinWeek(lastOfferedAt, Date.now()) }),
    );
  }
  // Once the pager settles on Queue up with the card on it, the card has shown: it counts as an
  // ask from then (seen, and the weekly cap), answered or not (tourShowsDuoPops).
  const duoPopsShown = offerDuoPops === true && tourShowsDuoPops(pager.page, queueIndex);

  useEffect(() => {
    hapticSuccess();
  }, []);

  // The ask record the offer is decided on. The tab layout warms it too (usePushAskWarmup), but the
  // tour comes before the tabs; load() reads it once per launch, wherever it is called first.
  useEffect(() => {
    void usePushAskStore.getState().load();
  }, []);

  // The wizard's submit set onboarding_completed on the server, but the session store still holds
  // the row from before it (discord.tsx cannot refresh inside the wizard, whose layout would
  // redirect the instant it flips). This screen is outside that group, so it refreshes at once:
  // an invite link opened during the tour then routes on the finished profile, and Skip or Start
  // swiping has nothing left to wait for. Offline, the store retries it by itself.
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

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
  const finish = useCallback(
    async (from: TourView) => {
      if (finishing.current) return;
      finishing.current = true;
      setLeaving(from);
      // Signed out: (tabs) sends a session-less player to sign in.
      if (!userId) {
        router.replace("/(tabs)");
        return;
      }
      // (tabs)/_layout sends a stale profile (onboarding_completed false) back into a blank
      // wizard, so the Deck opens only on the finished one. Usually the mount's refresh has it.
      if (!onboardedNow()) await refreshProfile();
      if (!onboardedNow()) {
        // Still stale (offline): stay on the tour and say so. The next tap tries again.
        finishing.current = false;
        setLeaving(null);
        useToastStore.getState().showToast(TOUR_OFFLINE, "error");
        return;
      }
      await markTourSeen(AsyncStorage, userId);
      router.replace("/(tabs)");
    },
    [userId, refreshProfile],
  );

  // Once per account: a second arrival (a deep link, a replayed route) goes straight on.
  useEffect(() => {
    if (skipTour) void finish("skeleton");
  }, [skipTour, finish]);

  function picture(page: TourPage) {
    switch (page) {
      case "card":
        return <CardTourPage height={pictureHeight} rankLabel={rankLabel} />;
      case "canDuo":
        return rank && rankLabel ? <CanDuoTourPage height={pictureHeight} rankLabel={rankLabel} line={tourRankLine(rank)} /> : null;
      case "locked":
        return <LockedTourPage height={pictureHeight} />;
      case "queue":
        return (
          <QueueTourPage
            height={pictureHeight}
            kind={queueTourKind(region)}
            rankLabel={rankLabel}
            offerDuoPops={offerDuoPops === true}
            duoPopsShown={duoPopsShown}
          />
        );
      case "yours":
        return <YourCardTourPage height={pictureHeight} profile={{ id: userId ?? "", is_active: isActive }} />;
    }
  }

  function copy(page: TourPage) {
    if (page === "queue") return { ...TOUR_COPY.queue, body: queueTourBody(region) };
    if (page !== "yours") return TOUR_COPY[page];
    return { ...TOUR_COPY.yours, body: yourCardBody(photos ? ownPictureState(photos).tag : null) };
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GraticuleBackground />
      <GrainOverlay />
      {showPager ? (
        <>
          <View style={{ flex: 1 }} onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}>
            <Pager pager={pager}>
              {pages.map((page, index) => (
                <PagerPage key={page} pager={pager} index={index}>
                  <TourPageScroll topInset={insets.top}>
                    {picture(page)}
                    <TourHeading copy={copy(page)} onHeight={(measured) => onHeadingHeight(page, measured)} />
                  </TourPageScroll>
                </PagerPage>
              ))}
            </Pager>
          </View>
          <TourFoot
            pager={pager}
            onFinish={() => void finish("pager")}
            busy={leaving !== null}
            bottomInset={insets.bottom}
          />
        </>
      ) : (
        <View style={{ flex: 1, paddingTop: insets.top + spacing.tight, paddingHorizontal: spacing.lg }}>
          <Skeleton height={pictureHeight} borderRadius={radius.card} />
          {/* Offline, TanStack parks the reads that decide the pages, so this could wait for
              ever: Skip is here too. It opens the Deck once the finished profile has loaded;
              until then it stays here and says it cannot reach DuoQueue. */}
          <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: insets.bottom + spacing.md }}>
            {skipTour && leaving !== null ? null : <SkipButton onPress={() => void finish("skeleton")} busy={leaving !== null} />}
          </View>
        </View>
      )}
    </View>
  );
}
