import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Animated, {
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { EdgeCard } from "@/components/EdgeCard";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { quickExiting, stackSpringEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { askForPush } from "./askForPush";
import { PUSH_ON_TOAST, pushAskCopy, pushAskKind, type PushPermissionState } from "./pushAsk";
import { usePushAskStore } from "./pushAskStore";
import { PUSH_PERMISSION_QUERY_KEY, usePushPermission } from "./usePushPermission";

/**
 * The notification pre-ask: our own card first, so "Not now" costs nothing and the one iOS
 * prompt this install will ever show is kept for a yes.
 *
 * Why it moved here. Until 1.0.2 iOS asked cold, the moment a profile became ready in the middle
 * of signup: 18 of the 19 tokens on file were granted within 0.3 minutes of that prompt, and 9 of
 * 24 onboarded players have no token at all, because the question came before the app had given
 * them a reason. Now it is asked where a notification pays off:
 * - "deck": over the bottom of the deck, right after a Duo that did not match ("Get notified when
 *   they duo you back?"). It springs up and the deck keeps swiping around it.
 * - "match": under DUO LOCKED's buttons ("Get notified when Kai messages you?").
 * One ask a week across every surface (pushAsk.ts), and on the deck it shares one slot with the
 * Duo Pops card, which wins it while the player is eligible (pushAskStore.ts has the contract).
 * Denied with no prompt left, the same card offers Open Settings instead.
 */
export function PushPreAskCard({ surface, otherName }: { surface: "deck" | "match"; otherName?: string }) {
  return surface === "match" ? <MatchPreAsk otherName={otherName} /> : <DeckPreAsk />;
}

/** Turn on or Open Settings (askForPush handles both), then Not now. */
function usePreAskActions(onDone: () => void) {
  const queryClient = useQueryClient();
  const profileId = useSessionStore((s) => s.session?.user.id);
  const showToast = useToastStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  async function primary() {
    if (busy) return;
    setBusy(true);
    const outcome = await askForPush(profileId, queryClient);
    setBusy(false);
    if (outcome === "register-token") {
      hapticSuccess();
      showToast(PUSH_ON_TOAST);
    }
    onDone();
  }

  function notNow() {
    hapticLight();
    onDone();
  }

  return { busy, primary, notNow };
}

/**
 * DUO LOCKED. Decides ONCE, in its first render, from the warm caches (`usePushAskWarmup` in the
 * tab layout keeps both warm): when either is still cold at that moment it renders nothing for this
 * whole DUO LOCKED, because a card that appears late would shift the centred celebration. Dismissed,
 * it fades out but keeps its box, so nothing under or around it moves.
 */
function MatchPreAsk({ otherName }: { otherName?: string }) {
  const { motion } = useTheme();
  const { data: permission } = usePushPermission();
  const [kind] = useState(() => {
    const store = usePushAskStore.getState();
    if (!permission || !store.loaded) return "none" as const;
    return pushAskKind({ permission, lastOfferedAt: store.lastOfferedAt, now: Date.now() });
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (kind !== "none") usePushAskStore.getState().markOffered(Date.now());
  }, [kind]);

  const opacity = useSharedValue(1);
  useEffect(() => {
    if (dismissed) opacity.value = withTiming(0, { duration: motion.quick, reduceMotion: ReduceMotion.Never });
  }, [dismissed, opacity, motion.quick]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const actions = usePreAskActions(() => setDismissed(true));

  if (kind === "none") return null;
  return (
    <Animated.View pointerEvents={dismissed ? "none" : "auto"} style={[{ alignSelf: "stretch" }, fade]}>
      <EdgeCard
        {...pushAskCopy(kind, "match", otherName)}
        onPrimary={() => void actions.primary()}
        primaryLoading={actions.busy}
        onSecondary={actions.notNow}
      />
    </Animated.View>
  );
}

/**
 * The deck. Waits for the deck's like moment (`offerPushAsk()`, wired as the deck flow's
 * `onLiked`) and decides then: nothing already showing, Duo Pops not wanting the moment, the
 * weekly cap clear, and the shared slot free. Releases the slot when dismissed or unmounted (the
 * deck renders it only while it has cards, so it never covers the empty deck's buttons).
 */
function DeckPreAsk() {
  const { spacing } = useTheme();
  const reduced = useReducedMotion();
  const queryClient = useQueryClient();
  // Mounted so the permission is cached by the time a like lands.
  usePushPermission();
  const [shown, setShown] = useState<"ask" | "open-settings" | null>(null);

  useEffect(() => {
    return usePushAskStore.subscribe((state, prev) => {
      if (state.deckMomentAt === null || state.deckMomentAt === prev.deckMomentAt) return;
      // Already showing this card (it holds the slot), or Duo Pops gets this moment.
      if (state.deckHolder === "push" || state.duoPopsWanted) return;
      const permission = queryClient.getQueryData<PushPermissionState>(PUSH_PERMISSION_QUERY_KEY);
      const kind = pushAskKind({
        permission,
        lastOfferedAt: state.loaded ? state.lastOfferedAt : undefined,
        now: Date.now(),
      });
      if (kind === "none") return;
      if (!state.claimDeck("push")) return;
      state.markOffered(Date.now());
      setShown(kind);
    });
  }, [queryClient]);

  useEffect(() => () => usePushAskStore.getState().releaseDeck("push"), []);

  const actions = usePreAskActions(() => {
    setShown(null);
    usePushAskStore.getState().releaseDeck("push");
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
        {...pushAskCopy(shown, "deck")}
        onPrimary={() => void actions.primary()}
        primaryLoading={actions.busy}
        onSecondary={actions.notNow}
      />
    </Animated.View>
  );
}
