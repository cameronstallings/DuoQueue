import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";

import { MATCHES_QUERY_KEY } from "@/features/chat/useMatches";
import { useOnAppResume } from "@/hooks/useOnAppResume";
import { hapticHeavy } from "@/lib/haptics";
import { duoCallLockedNotificationOf, duoLockedNotificationOf, duoPopNotificationOf } from "@/lib/notificationRouting";
import { useSessionStore } from "@/store/session-store";

import { celebrateOnResume } from "./duoLockedOnce";
import { celebratedPops, isDuoLockedCelebrated, loadCelebrated, openDuoLocked } from "./openDuoLocked";
import { useQueueUpSheetStore } from "./queueUpSheetStore";
import type { QueueUpRow } from "./types";
import { duoPopQueryKey } from "./useDuoPop";
import { fetchMyQueueUp, QUEUE_UP_QUERY_KEY, queueUpQueryKey } from "./useQueueUp";

/** A queue-up older than this cannot lock any more (the hour plus the last pop's ten minutes,
 * get_my_queue_up's own window), so resuming does not read it. */
const RESUME_READ_WINDOW_MS = 70 * 60_000;

/**
 * Duo Pop pushes while the app is OPEN, and the sender's DUO LOCKED on return to it. Mounted
 * once, from the tab layout (the usePartyFreshness pattern), and active only signed in and
 * onboarded. Taps are not here: useNotificationTapRouting routes those, reading the payload
 * with the same two functions (`duoPopNotificationOf`, `duoLockedNotificationOf`), so a push
 * means the same thing whether it is tapped or lands on screen.
 *
 *  - A Duo Pop lands: one heavy tap (the haptic map: a Duo Pop arrives; the sound is Group P's
 *    foreground rule, the only push that plays one in the app) and that pop's card is marked
 *    stale, so a tap opens it on fresh numbers.
 *  - "Duo locked" lands for the sender: the queue status and Matches refresh, and, unless this
 *    phone already played that lock, the deck's Queue Up sheet closes and DUO LOCKED opens with
 *    "Popped in 0:41".
 *  - "Duo locked" lands for a post the sender shared (0088, `via: "post"`, no popped-in time):
 *    the queue status, Matches and the profile refresh, and nothing opens.
 *  - The app comes back to the front: if the sender has a queue-up from the last 70 minutes in
 *    memory, one read of it (and of the profile when it is locked), and a Duo Pop lock from the
 *    last 15 minutes not yet played opens DUO LOCKED (Q11). This is for a sender without notification permission, who would otherwise find out
 *    only by opening Matches. One read per resume, never a poll.
 */
export function usePopPushes(): void {
  const queryClient = useQueryClient();
  const enabled = useSessionStore((s) => s.status === "signed_in" && s.profile?.onboarding_completed === true);
  const profileId = useSessionStore((s) => s.session?.user.id);

  useEffect(() => {
    void loadCelebrated();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      const pop = duoPopNotificationOf(data?.category, data?.popId);
      if (pop) {
        hapticHeavy();
        void queryClient.invalidateQueries({ queryKey: duoPopQueryKey(pop.popId) });
        return;
      }
      const lock = duoLockedNotificationOf(data?.category, data?.matchId, data?.popId, data?.poppedIn, data?.duo);
      if (!lock) {
        // The LFG post was answered (0088's call lock). Nothing opens: the banner already named
        // the player, a tap opens the chat, and the sheet says "{name} answered your LFG post."
        // The call is over and the server took the sender out of Online Now, so the queue
        // status, Matches and the profile (the header pill) are re-read.
        if (duoCallLockedNotificationOf(data?.category, data?.matchId, data?.popId, data?.via)) {
          void queryClient.invalidateQueries({ queryKey: QUEUE_UP_QUERY_KEY });
          void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
          void useSessionStore.getState().refreshProfile();
        }
        return;
      }
      void queryClient.invalidateQueries({ queryKey: QUEUE_UP_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
      // 0088 also ends free to duo at a Duo Pop lock, so the pill re-reads the profile.
      void useSessionStore.getState().refreshProfile();
      void loadCelebrated().then(() => {
        if (isDuoLockedCelebrated(lock.popId)) return;
        useQueueUpSheetStore.getState().close();
        void openDuoLocked({ ...lock, mode: "push" });
      });
    });
    return () => subscription.remove();
  }, [enabled, queryClient]);

  useOnAppResume(
    useCallback(() => {
      if (!enabled || !profileId) return;
      const key = queueUpQueryKey(profileId);
      const cached = queryClient.getQueryData<QueueUpRow | null>(key);
      if (!cached) return;
      const createdMs = Date.parse(cached.created_at);
      if (!Number.isFinite(createdMs) || Date.now() - createdMs > RESUME_READ_WINDOW_MS) return;
      void (async () => {
        try {
          const row = await queryClient.fetchQuery({ queryKey: key, queryFn: fetchMyQueueUp, staleTime: 0 });
          // A locked call is over (0088 also clears free to duo), so the pill re-reads the profile
          // whichever way the duo formed.
          if (row?.locked_at) void useSessionStore.getState().refreshProfile();
          await loadCelebrated();
          // celebrateOnResume skips a lock from the LFG post (no popped-in time): DUO LOCKED
          // would say "You and {name} both queued up" about it.
          if (!row || !row.match_id || !celebrateOnResume(row, Date.now(), celebratedPops())) return;
          useQueueUpSheetStore.getState().close();
          await openDuoLocked({
            matchId: row.match_id,
            popId: row.queue_id,
            poppedInSeconds: row.popped_in_seconds,
            // The resume read cannot see Riot's duo table for the pair (lol_solo_duo_eligible is
            // not readable by clients); the push carries it, this path does not.
            canDuo: false,
            nameHint: row.partner_name,
            mode: "push",
          });
        } catch {
          // Offline or a failed read: the lock is still in Matches, and the next resume asks again.
        }
      })();
    }, [enabled, profileId, queryClient]),
  );
}
