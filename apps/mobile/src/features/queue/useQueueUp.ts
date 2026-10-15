import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";

import { QUEUE_COPY, queueErrorMessage } from "./queueCopy";
import type { QueueUpRow } from "./types";

/**
 * The sender's side of Queue Up: read the newest queue-up, start one, stop it, and ask whether a
 * Duo Call code has ended. Every RPC here is 0085's, which is written but not applied while 1.0.2
 * is built, so each one fails soft:
 *  - get_my_queue_up answering PGRST202 (no such function) is "no queue-up", never an error;
 *  - start_queue_up's PGRST202 becomes the honest "Queue Up isn't ready yet" toast;
 *  - stop_queue_up's PGRST202 falls back to set_looking_now(false), which is live, so a player
 *    who is free to duo can always stop being;
 *  - call_code_ended answers false on any error, so the invite field keeps its old line.
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
 */
export function useStartQueueUp() {
  const queryClient = useQueryClient();
  const profileId = useSessionStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async ({ gameId, ping }: { gameId: string; ping: boolean }): Promise<QueueUpRow> => {
      const { data, error } = await supabase.rpc("start_queue_up", { p_game_id: gameId, p_ping: ping });
      if (error) throw error;
      const row = ((data ?? []) as QueueUpRow[])[0];
      if (!row) throw new Error("start_queue_up returned no row");
      return row;
    },
    onSuccess: (row) => {
      queryClient.setQueryData(queueUpQueryKey(profileId), row);
      refreshAfterQueueChange(queryClient);
    },
    onError: (err) => {
      useToastStore.getState().showToast(queueErrorMessage(err, QUEUE_COPY.startFailed), "error");
    },
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
    onSuccess: () => {
      queryClient.setQueryData(queueUpQueryKey(profileId), null);
      refreshAfterQueueChange(queryClient);
      useToastStore.getState().showToast(QUEUE_COPY.stopped, "info");
    },
    onError: (err) => {
      useToastStore.getState().showToast(queueErrorMessage(err, QUEUE_COPY.stopFailed), "error");
    },
  });
}

/**
 * Whether a typed or tapped code is a Duo Call whose queue-up is over (call_code_ended, readable
 * signed out). Only asked once the invite field has said the code did not resolve, and false on
 * any error, so the field never says "ended" about a code it cannot vouch for.
 */
export function useCallCodeEnded(code: string | null, enabled: boolean): boolean {
  const query = useQuery({
    queryKey: ["call-code-ended", code],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("call_code_ended", { p_code: code });
      if (error) return false;
      return data === true;
    },
    enabled: enabled && !!code,
    staleTime: 60_000,
    retry: false,
  });
  return query.data === true;
}
