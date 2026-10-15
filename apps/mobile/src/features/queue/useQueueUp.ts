import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { hapticError } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";

import { QUEUE_COPY } from "./queueCopy";
import type { QueueUpRow } from "./types";

/**
 * The sender's side of Queue Up: read the newest queue-up, start one, stop it, and ask whether a
 * Duo Call code has ended. Every RPC here is 0085's, which is written but not applied while 1.0.2
 * is built, so each one fails soft:
 *  - get_my_queue_up answering PGRST202 (no such function) is "no queue-up", never an error;
 *  - start_queue_up's PGRST202 falls back to set_looking_now(true), which is live: exactly what
 *    1.0.1's "I'm free to duo right now" switch did, the switch this button replaced. Without it,
 *    a 1.0.2 phone on a server without 0085 could not go online at all, and every Queue up (App
 *    Review's included) would end in "Queue Up isn't ready yet". The sheet then shows the
 *    "profile" phase: queued by the flag, "Your matches can see you're free.", and Stop. No Duo
 *    Pops and no code are claimed, because none were sent;
 *  - stop_queue_up's PGRST202 falls back to set_looking_now(false), which is live, so a player
 *    who is free to duo can always stop being;
 *  - call_code_ended answers false on any error, so the invite field keeps its old line.
 *
 * FAILURES ARE SAID WHERE THE TAP WAS, NOT IN A TOAST. Start and Stop are only ever tapped inside
 * the Queue Up sheet (a React Native Modal) or on Online Now (a modal screen), and the one Toast
 * is mounted under both at the root, so a toast from here was drawn behind the panel and gone in
 * 2 s: one buzz and nothing to read. So these hooks only buzz (the haptic map's "inline form
 * errors"), and each caller puts `queueErrorMessage(...)` under the button that failed.
 */

/** Prefix of every queue-up read. Invalidate this to refresh the sheet and the resume check. */
export const QUEUE_UP_QUERY_KEY = ["queue-up"] as const;

export function queueUpQueryKey(profileId: string | undefined) {
  return [...QUEUE_UP_QUERY_KEY, profileId] as const;
}

/** PostgREST's "Could not find the function": 0085 is not live yet. */
export function isMissingFunction(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "PGRST202";
}

/** The newest queue-up of the last 70 minutes, or null (none, or 0085 not live). */
export async function fetchMyQueueUp(): Promise<QueueUpRow | null> {
  const { data, error } = await supabase.rpc("get_my_queue_up");
  if (error) {
    if (isMissingFunction(error)) return null;
    throw error;
  }
  return ((data ?? []) as QueueUpRow[])[0] ?? null;
}

/**
 * The sheet's read and the resume check's. Signed in and onboarded only, never stale (staleTime
 * 0, refetched whenever a reader mounts), and only while `enabled`: the sheet passes its own
 * visibility, so a closed sheet asks nothing.
 */
export function useMyQueueUp({ enabled }: { enabled: boolean }) {
  const profileId = useSessionStore((s) => s.session?.user.id);
  const ready = useSessionStore((s) => s.status === "signed_in" && s.profile?.onboarding_completed === true);
  return useQuery({
    queryKey: queueUpQueryKey(profileId),
    queryFn: fetchMyQueueUp,
    enabled: enabled && ready && !!profileId,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

/** Free to duo is the profile's flag; Online Now lists who has it. Both change with a queue-up. */
function refreshAfterQueueChange(queryClient: ReturnType<typeof useQueryClient>) {
  void useSessionStore.getState().refreshProfile();
  void queryClient.invalidateQueries({ queryKey: ["online-now"] });
}

/**
 * Queue up: start_queue_up(game, ping). The answer is the row itself (start is idempotent: a
 * second tap while queued returns the live row and pings nobody), written straight into the
 * sheet's cache, so the sheet shows the server's own result without a second read.
 *
 * Null when 0085 is not live and the player was set free to duo instead (the header). The profile
 * is refreshed BEFORE that resolves, so the button keeps its busy label until the flag is really
 * on and the sheet goes straight from the form to "You're queued", never back to the form first.
 */
export function useStartQueueUp() {
  const queryClient = useQueryClient();
  const profileId = useSessionStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async ({ gameId, ping }: { gameId: string; ping: boolean }): Promise<QueueUpRow | null> => {
      const { data, error } = await supabase.rpc("start_queue_up", { p_game_id: gameId, p_ping: ping });
      if (error) {
        if (!isMissingFunction(error)) throw error;
        // 0085 is not live: free to duo, as the 1.0.1 switch was (matches still get 0074's push).
        const { error: fallbackError } = await supabase.rpc("set_looking_now", { p_looking: true });
        if (fallbackError) throw fallbackError;
        try {
          await useSessionStore.getState().refreshProfile();
        } catch {
          // The flag is on either way; the profile catches up on its next read.
        }
        return null;
      }
      const row = ((data ?? []) as QueueUpRow[])[0];
      if (!row) throw new Error("start_queue_up returned no row");
      return row;
    },
    onSuccess: (row) => {
      queryClient.setQueryData(queueUpQueryKey(profileId), row);
      if (row) refreshAfterQueueChange(queryClient);
      else void queryClient.invalidateQueries({ queryKey: ["online-now"] });
    },
    // The caller says why, under the button (the header): queueErrorMessage(err, startFailed).
    onError: () => hapticError(),
  });
}

/** Stop queueing. Ends the queue-up (its open pops answer "ended", its code stops resolving 15
 * minutes later) and clears free to duo. */
export function useStopQueueUp() {
  const queryClient = useQueryClient();
  const profileId = useSessionStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("stop_queue_up");
      if (!error) return;
      if (!isMissingFunction(error)) throw error;
      // 0085 is not live: the only thing a player can be is free to duo, which this clears.
      const { error: fallbackError } = await supabase.rpc("set_looking_now", { p_looking: false });
      if (fallbackError) throw fallbackError;
    },
    onSuccess: async () => {
      // The profile first, then the row. The sheet reads "queued" from the profile whenever no
      // live row is there (a player queued only by the flag), so clearing the row first would
      // swap in that body for a moment before the idle form. Awaited, so Stop keeps its busy label
      // until the flag is really off; a failed read only leaves the flag as it was (it retries).
      try {
        await useSessionStore.getState().refreshProfile();
      } catch {
        // Stopping worked either way.
      }
      queryClient.setQueryData(queueUpQueryKey(profileId), null);
      void queryClient.invalidateQueries({ queryKey: ["online-now"] });
      useToastStore.getState().showToast(QUEUE_COPY.stopped, "info");
    },
    // The caller says why, under Stop (the header): queueErrorMessage(err, stopFailed).
    onError: () => hapticError(),
  });
}

/**
 * Whether a typed or tapped code is a Duo Call whose queue-up is over (call_code_ended, readable
 * signed out). Only asked once the invite field has said the code did not resolve, and false on
 * any error, so the field never says "ended" about a code it cannot vouch for.
 *
 * Undefined while that one question is still being asked, so the field can keep saying it is
 * checking instead of flashing "That code did not work" (and buzzing) before "That Duo Call has
 * ended" replaces it. False when not asked at all.
 */
export function useCallCodeEnded(code: string | null, enabled: boolean): boolean | undefined {
  const asked = enabled && !!code;
  const query = useQuery({
    queryKey: ["call-code-ended", code],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("call_code_ended", { p_code: code });
      if (error) return false;
      return data === true;
    },
    enabled: asked,
    staleTime: 60_000,
    retry: false,
  });
  if (!asked) return false;
  if (query.data !== undefined) return query.data;
  return query.isError ? false : undefined;
}
