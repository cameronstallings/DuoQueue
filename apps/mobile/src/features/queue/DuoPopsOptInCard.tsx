import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import Animated, {
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";

import { EdgeCard } from "@/components/EdgeCard";
import { askForPush } from "@/features/push/askForPush";
import { LAUNCH_STARTED_AT, usePushAskStore } from "@/features/push/pushAskStore";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { quickExiting, revealEntering, stackSpringEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import {
  duoPopsWanted,
  hasSeenDuoPopsOffer,
  isNaRegion,
  markDuoPopsOfferSeen,
  offeredWithinWeek,
  shouldOfferDuoPops,
  type DuoPopsTrigger,
} from "./duoPopsOptIn";
import { DUO_POPS_OPT_IN_COPY } from "./queueCopy";
import { useQueueUpSheetStore } from "./queueUpSheetStore";
import { useDuoPopsSetting } from "./useDuoPopsSetting";

/**
 * "Get Duo Pops?": the one-time opt-in for Duo Pops, which also asks iOS for notifications (a
 * pop is a push, and an opted-in phone that cannot be pushed gets nothing). An EdgeCard, like
 * every ask.
 *
 * Two surfaces, sharing the deck's one ask slot and one weekly cap with the notification
 * pre-ask (the contract is in pushAskStore.ts):
 *   "deck"   over the bottom of the deck, springing up right after a like (the moment someone is
 *            thinking "I want a duo"), or when the deck comes back into focus after a like in an
 *            earlier launch. Mounted for the deck screen's whole life, so it also keeps
 *            `duoPopsWanted` current, which makes the pre-ask let the like moment go to this card.
 *   "empty"  at the top of the empty deck's column, in flow, decided once when the empty deck
 *            mounts, from caches the deck has already warmed. Anything not loaded at that moment
 *            means nothing this time: a card that arrived late would shove the empty deck's
 *            buttons down under the player's thumb. For the same reason an answered card fades
 *            out and keeps its box, rather than pulling them up.
 *
 * Never outside NA (pops only go between NA players), never before the `queue_pop` column
 * exists (0085), never twice per account on a phone, never within a week of another ask, and
 * never over the open Queue Up sheet. It counts as seen on this phone the moment it shows, so
 * neither an answer nor a deck that took it away unanswered ever brings it back.
 *
 * A third surface, outside the deck:
 *   "tour"   on the new-player tour's Queue up page (build 22), in the page's picture, under the
 *            example Duo Pop. The tour decides whether to mount it (tourOffersDuoPops, the same
 *            rule, decided once while the page is still off screen), so nothing here decides.
 *            It is not the deck: it takes no deck slot and is not an interruption, so showing it
 *            costs nothing. An ANSWER marks it seen (a Not now here is final, as on the deck), and
 *            Turn on, which raises the iOS prompt, also counts toward the weekly cap, so the
 *            deck's notification pre-ask does not ask again minutes later. A player who swipes past
 *            without answering keeps the deck's own chance after their first like.
 */
export function DuoPopsOptInCard({ surface, active = true }: { surface: "deck" | "empty" | "tour"; active?: boolean }) {
  if (surface === "tour") return <TourDuoPopsCard />;
  return surface === "deck" ? <DeckDuoPopsCard active={active} /> : <EmptyDuoPopsCard />;
}

// ---------------------------------------------------------------------------------------------
// The seen flag, read once per account per launch and kept here, so the empty deck can decide
// synchronously from it.
// ---------------------------------------------------------------------------------------------

const seenByUser = new Map<string, boolean>();
const seenLoads = new Map<string, Promise<boolean>>();

function loadSeen(userId: string): Promise<boolean> {
  let load = seenLoads.get(userId);
  if (!load) {
    load = hasSeenDuoPopsOffer(AsyncStorage, userId).then((seen) => {
      // A close during the read already said "seen"; never let the read undo it.
      if (seenByUser.get(userId) !== true) seenByUser.set(userId, seen);
      return seenByUser.get(userId) === true;
    });
    seenLoads.set(userId, load);
  }
  return load;
}

/**
 * Whether this account was offered the card on this phone (undefined while the flag loads), and
 * the way to mark it. Exported for the tour, which decides its own offer from it (welcome.tsx), so
 * the tour and the deck read and write the one flag through the one cache.
 */
export function useDuoPopsOfferSeen(userId: string | undefined): [boolean | undefined, () => void] {
  const [seen, setSeen] = useState<boolean | undefined>(() => (userId ? seenByUser.get(userId) : undefined));

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setSeen(seenByUser.get(userId));
    void loadSeen(userId).then((value) => {
      if (live) setSeen(value);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  const markSeen = useCallback(() => {
    if (!userId) return;
    seenByUser.set(userId, true);
    setSeen(true);
    void markDuoPopsOfferSeen(AsyncStorage, userId);
  }, [userId]);

  return [seen, markSeen];
}

/** The inputs both surfaces decide on. */
function useEligibility() {
  const userId = useSessionStore((s) => s.session?.user.id);
  const onboarded = useSessionStore((s) => s.profile?.onboarding_completed === true);
  const inNa = useSessionStore((s) => isNaRegion(s.profile?.region));
  const { queuePop, enable } = useDuoPopsSetting();
  const [seen, markSeen] = useDuoPopsOfferSeen(userId);
  const wanted = duoPopsWanted({ onboarded, inNa, queuePop, seen });
  return { userId, wanted, enable, markSeen };
}

/** Turn on Duo Pops (write the setting, then ask iOS through askForPush), or Not now. */
function useOptInActions({
  userId,
  enable,
  onClose,
}: {
  userId: string | undefined;
  enable: () => Promise<void>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  async function turnOn() {
    if (busy) return;
    hapticMedium();
    setBusy(true);
    try {
      await enable();
    } catch {
      setBusy(false);
      showToast(DUO_POPS_OPT_IN_COPY.failed, "error");
      onClose();
      return;
    }
    const outcome = await askForPush(userId, queryClient);
    setBusy(false);
    // On, either way: the setting is saved. Without permission nothing can reach the phone, so
    // that is said plainly rather than celebrated.
    if (outcome === "register-token") showToast(DUO_POPS_OPT_IN_COPY.on);
    else showToast(DUO_POPS_OPT_IN_COPY.needsSettings, "info");
    onClose();
  }

  function notNow() {
    hapticLight();
    onClose();
  }

  return { busy, turnOn, notNow };
}

function DeckDuoPopsCard({ active }: { active: boolean }) {
  const { spacing } = useTheme();
  const reduced = useReducedMotion();
  const { userId, wanted, enable, markSeen } = useEligibility();
  const [shown, setShown] = useState(false);

  // Published for the pre-ask, which lets a like moment go by while this is true.
  useEffect(() => {
    usePushAskStore.getState().setDuoPopsWanted(wanted);
  }, [wanted]);
  useEffect(() => () => usePushAskStore.getState().setDuoPopsWanted(false), []);

  // Read inside the store listener, which outlives renders.
  const latest = useRef({ wanted, active, shown });
  latest.current = { wanted, active, shown };

  const decide = useCallback((trigger: DuoPopsTrigger): boolean => {
    const { wanted: isWanted, active: isActive, shown: isShown } = latest.current;
    if (!isActive || isShown) return false;
    const store = usePushAskStore.getState();
    const now = Date.now();
    const asked = offeredWithinWeek(store.loaded ? store.lastOfferedAt : undefined, now);
    if (asked === undefined) return false;
    const offer = shouldOfferDuoPops({
      wanted: isWanted,
      trigger,
      firstLikeAt: store.firstLikeAt,
      launchStartedAt: LAUNCH_STARTED_AT,
      askedWithinWeek: asked,
      queueSheetOpen: useQueueUpSheetStore.getState().visible,
    });
    if (!offer || !store.claimDeck("duo-pops")) return false;
    store.markOffered(now);
    // Seen the moment it shows, not when it is answered: a card the deck drained from under, or
    // that a refill or a killed app took away, would otherwise come back after the weekly cap,
    // and until then keep the push pre-ask yielding its like moments to a card that cannot show.
    markSeen();
    latest.current = { ...latest.current, shown: true };
    setShown(true);
    return true;
  }, [markSeen]);

  // A like without a match (offerPushAsk, the deck flow's onLiked).
  useEffect(
    () =>
      usePushAskStore.subscribe((state, prev) => {
        if (state.deckMomentAt !== null && state.deckMomentAt !== prev.deckMomentAt) decide("like");
      }),
    [decide],
  );

  // The deck coming into focus. On a cold launch the inputs (and the cards) are often still
  // loading at that moment, so the focus is held until they are, and then decided once.
  const focusPending = useRef(false);
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      focusPending.current = true;
      setFocusTick((n) => n + 1);
      return () => {
        focusPending.current = false;
      };
    }, []),
  );
  const storeLoaded = usePushAskStore((s) => s.loaded);
  useEffect(() => {
    if (!focusPending.current || !storeLoaded || !wanted || !active) return;
    focusPending.current = false;
    decide("focus");
  }, [focusTick, storeLoaded, wanted, active, decide]);

  const hide = useCallback(() => {
    latest.current = { ...latest.current, shown: false };
    setShown(false);
    usePushAskStore.getState().releaseDeck("duo-pops");
  }, []);

  // The deck drained under it: fade out with the cards rather than cover the empty deck's buttons.
  useEffect(() => {
    if (!active && latest.current.shown) hide();
  }, [active, hide]);
  useEffect(() => () => usePushAskStore.getState().releaseDeck("duo-pops"), []);

  const actions = useOptInActions({
    userId,
    enable,
    onClose: () => {
      markSeen();
      hide();
    },
  });

  if (!shown) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: spacing.sm }}
      entering={stackSpringEntering(FadeInDown, reduced)}
      exiting={quickExiting()}
    >
      <EdgeCard
        title={DUO_POPS_OPT_IN_COPY.title}
        body={DUO_POPS_OPT_IN_COPY.body}
        primaryLabel={DUO_POPS_OPT_IN_COPY.primary}
        onPrimary={() => void actions.turnOn()}
        primaryLoading={actions.busy}
        secondaryLabel={DUO_POPS_OPT_IN_COPY.secondary}
        onSecondary={actions.notNow}
      />
    </Animated.View>
  );
}

function EmptyDuoPopsCard() {
  const { motion, spacing } = useTheme();
  const { userId, wanted, enable, markSeen } = useEligibility();

  // Decided once, in the first render, from what is already in memory.
  const [offer] = useState(() => {
    const store = usePushAskStore.getState();
    const asked = offeredWithinWeek(store.loaded ? store.lastOfferedAt : undefined, Date.now());
    if (asked === undefined) return false;
    return shouldOfferDuoPops({
      wanted,
      trigger: "empty",
      firstLikeAt: store.firstLikeAt,
      launchStartedAt: LAUNCH_STARTED_AT,
      askedWithinWeek: asked,
      queueSheetOpen: useQueueUpSheetStore.getState().visible,
    });
  });
  const [shown, setShown] = useState(offer);

  // Claimed before the first paint; if the slot is somehow taken, the card never appears. Seen the
  // moment it shows (as on the deck), so a refresh or a refill that unmounts it unanswered never
  // brings it back on this phone.
  const claimed = useRef(false);
  useLayoutEffect(() => {
    if (!offer || claimed.current) return;
    claimed.current = true;
    const store = usePushAskStore.getState();
    if (store.claimDeck("duo-pops")) {
      store.markOffered(Date.now());
      markSeen();
    } else {
      setShown(false);
    }
  }, [offer, markSeen]);
  useEffect(() => () => usePushAskStore.getState().releaseDeck("duo-pops"), []);

  // Answered, it fades out but KEEPS ITS BOX, as DUO LOCKED's pre-ask does. It sits in flow above
  // an EmptyState that is centred in the rest of the column, so a card that left the layout moved
  // the icon, the title and Queue up by half its height in one frame, right under the thumb that
  // had just tapped. The empty box goes when the empty deck does.
  const [dismissed, setDismissed] = useState(false);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (dismissed) opacity.value = withTiming(0, { duration: motion.quick, reduceMotion: ReduceMotion.Never });
  }, [dismissed, opacity, motion.quick]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const actions = useOptInActions({
    userId,
    enable,
    onClose: () => {
      markSeen();
      setDismissed(true);
      usePushAskStore.getState().releaseDeck("duo-pops");
    },
  });

  if (!shown) return null;
  return (
    <Animated.View
      entering={revealEntering()}
      pointerEvents={dismissed ? "none" : "auto"}
      accessibilityElementsHidden={dismissed}
      importantForAccessibility={dismissed ? "no-hide-descendants" : "auto"}
      style={{ alignSelf: "stretch", marginBottom: spacing.sm }}
    >
      <Animated.View style={fade}>
        <EdgeCard
          title={DUO_POPS_OPT_IN_COPY.title}
          body={DUO_POPS_OPT_IN_COPY.body}
          primaryLabel={DUO_POPS_OPT_IN_COPY.primary}
          onPrimary={() => void actions.turnOn()}
          primaryLoading={actions.busy}
          secondaryLabel={DUO_POPS_OPT_IN_COPY.secondary}
          onSecondary={actions.notNow}
        />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The card on the tour's Queue up page: the same words, the same Turn on (the setting, then iOS
 * through askForPush, the same toasts and the same failure line), the same Not now. Mounted only
 * when the tour offers it, already decided, so it renders at once (a reveal, decided while the page
 * is still off screen). Answered, it fades out and KEEPS ITS BOX, as the empty deck's does: the
 * example notice above is centred in the room this card leaves, and must not jump under the
 * thumb that just tapped.
 */
function TourDuoPopsCard() {
  const { motion } = useTheme();
  const userId = useSessionStore((s) => s.session?.user.id);
  const { enable } = useDuoPopsSetting();
  const [, markSeen] = useDuoPopsOfferSeen(userId);

  const [dismissed, setDismissed] = useState(false);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (dismissed) opacity.value = withTiming(0, { duration: motion.quick, reduceMotion: ReduceMotion.Never });
  }, [dismissed, opacity, motion.quick]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const actions = useOptInActions({
    userId,
    enable,
    onClose: () => {
      markSeen();
      setDismissed(true);
    },
  });

  function turnOn() {
    // Turn on raises the iOS prompt, which is a notification ask like any other: it starts the
    // shared weekly cap, so the deck's pre-ask does not ask again after the first like. Not now
    // raises nothing, so it leaves the cap alone.
    if (!actions.busy) usePushAskStore.getState().markOffered(Date.now());
    void actions.turnOn();
  }

  return (
    <Animated.View
      entering={revealEntering()}
      pointerEvents={dismissed ? "none" : "auto"}
      accessibilityElementsHidden={dismissed}
      importantForAccessibility={dismissed ? "no-hide-descendants" : "auto"}
      style={{ alignSelf: "stretch" }}
    >
      <Animated.View style={fade}>
        <EdgeCard
          title={DUO_POPS_OPT_IN_COPY.title}
          body={DUO_POPS_OPT_IN_COPY.body}
          primaryLabel={DUO_POPS_OPT_IN_COPY.primary}
          onPrimary={turnOn}
          primaryLoading={actions.busy}
          secondaryLabel={DUO_POPS_OPT_IN_COPY.secondary}
          onSecondary={actions.notNow}
        />
      </Animated.View>
    </Animated.View>
  );
}
