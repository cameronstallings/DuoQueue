import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

import type { ChatTimelineItem } from "@/features/chat/types";

import { maybeAskForReview, noteDuoLockedForReview } from "./requestReview";
import { isLiveReplyToMe, REVIEW_DELAY_MS } from "./reviewPrompt";

/**
 * The two moments that may ask for an App Store rating, as hooks for the screens that own them.
 * Neither is ever called from a button handler (5.6.1); both wait REVIEW_DELAY_MS so the moment
 * itself lands first, and both drop the ask if the screen goes away before then.
 */

/**
 * For DuoLockedScreen's `onLocked` (fired once, right after the success haptic at the lock).
 * Counts this match's DUO LOCKED and, on the 2nd distinct one or later, asks about 2 s later.
 * Leaving within those 2 s skips the ask but keeps the lock counted, so the next one can ask.
 */
export function useDuoLockedReviewPrompt(matchId: string | undefined): () => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);

  return useCallback(() => {
    if (!matchId) return;
    void noteDuoLockedForReview(matchId).then((isTrigger) => {
      if (!isTrigger || !mounted.current || timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        void maybeAskForReview("second-duo-locked");
      }, REVIEW_DELAY_MS);
    });
  }, [matchId]);
}

/**
 * For the chat: when the newest message is the other player's, arrived while this chat was open,
 * and answers the player's own message, asks about 2 s later. At most once per chat visit.
 *
 * Only while the player is actually looking at the chat. The chat stays mounted, and keeps taking
 * realtime messages, under its own sheets (menu, Report, Rate, Schedule, Discord) and under the
 * screens pushed over it (the other player's profile, the paywall, a party), so a reply that lands
 * then must not put Apple's sheet over them, least of all over "Report this user", whose safety
 * flag is only set when the report is sent. `enabled` is the caller's "none of my sheets is open";
 * the hook adds its own focus check for the pushed screens. While either is false nothing is
 * armed and a pending ask is dropped without counting as asked, so a reply that came in meanwhile
 * asks about 2 s after the player is back on the open chat (it is still the newest message, still
 * theirs and still after the chat opened).
 */
export function useFirstReplyReviewPrompt(
  timeline: readonly ChatTimelineItem[],
  myId: string | undefined,
  mountedAtMs: number,
  enabled: boolean,
): void {
  const asked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read again when the timer fires, in case the gate closed between a render and its effect.
  const open = useRef(false);

  // Starts closed: the first focus event opens it, so nothing arms before the screen is in front.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  const newest = timeline[timeline.length - 1];
  const newestId = newest ? (newest.kind === "message" ? newest.message.id : newest.share.id) : null;
  const gateOpen = enabled && focused;

  useEffect(() => {
    open.current = gateOpen;
    if (!gateOpen) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      return;
    }
    if (asked.current || timer.current || newestId === null) return;
    const messages = timeline.flatMap((item) =>
      item.kind === "message" ? [{ senderId: item.message.sender_id, atMs: Date.parse(item.at) }] : [],
    );
    if (!isLiveReplyToMe(messages, myId, mountedAtMs)) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!open.current) return;
      asked.current = true;
      void maybeAskForReview("first-reply");
    }, REVIEW_DELAY_MS);
    // Keyed on the newest item and the gate: `timeline` is a new array on every refetch, and the
    // check only reads its last two messages, so re-running for the same newest item would change
    // nothing; the gate re-runs it so a reply that landed under a sheet asks once the chat is back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestId, myId, mountedAtMs, gateOpen]);
}
