import { useCallback, useEffect, useRef } from "react";

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
 */
export function useFirstReplyReviewPrompt(
  timeline: readonly ChatTimelineItem[],
  myId: string | undefined,
  mountedAtMs: number,
): void {
  const fired = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  const newest = timeline[timeline.length - 1];
  const newestId = newest ? (newest.kind === "message" ? newest.message.id : newest.share.id) : null;

  useEffect(() => {
    if (fired.current || newestId === null) return;
    const messages = timeline.flatMap((item) =>
      item.kind === "message" ? [{ senderId: item.message.sender_id, atMs: Date.parse(item.at) }] : [],
    );
    if (!isLiveReplyToMe(messages, myId, mountedAtMs)) return;
    fired.current = true;
    timer.current = setTimeout(() => {
      timer.current = null;
      void maybeAskForReview("first-reply");
    }, REVIEW_DELAY_MS);
    // Keyed on the newest item: `timeline` is a new array on every refetch, and the check only
    // reads its last two messages, so re-running for the same newest item would change nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestId, myId, mountedAtMs]);
}
