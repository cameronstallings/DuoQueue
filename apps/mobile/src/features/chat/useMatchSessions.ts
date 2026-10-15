import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MatchSessionRow } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

import { SESSION_CONFIRMED_LIVE_MS } from "./playTogether";

/** How long after its start time a session still counts as happening (the confirmed window in
 * playTogether.ts; a pending one is narrowed further to 30 minutes by `liveSession`). */
export const SESSION_STALE_AFTER_MS = SESSION_CONFIRMED_LIVE_MS;

/** The one cache key for a match's session card. The chat re-reads it on a message push, on
 * resume and when the thread catches up, because match_sessions is not in the Realtime
 * publication (checked 15 Oct) and 0073 sends a proposal as a "new_message" push. */
export function matchSessionsQueryKey(matchId: string | undefined) {
  return ["match-sessions", matchId] as const;
}

/** The single active proposal for a match, if any — propose_session cancels prior
 * pending rows server-side, so "active" just means the newest non-terminal row whose time has
 * not long passed. Without the time filter a confirmed session stayed "Playing ..." in the chat
 * forever, because the server only ever expires PENDING rows (0077), and since 1.0.2 a live
 * confirmed session also hides the chat's play-together chips, so it would have hidden them for
 * good. */
export function useActiveMatchSession(matchId: string | undefined) {
  return useQuery({
    queryKey: matchSessionsQueryKey(matchId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_sessions")
        .select("*")
        .eq("match_id", matchId)
        .in("status", ["pending", "confirmed"])
        .gt("scheduled_at", new Date(Date.now() - SESSION_STALE_AFTER_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as MatchSessionRow | null) ?? null;
    },
    enabled: !!matchId,
  });
}

export function useProposeSession(matchId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scheduledAt: Date) => {
      if (!matchId) throw new Error("No match loaded.");
      const { error } = await supabase.rpc("propose_session", {
        p_match_id: matchId,
        p_scheduled_at: scheduledAt.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchSessionsQueryKey(matchId) });
    },
  });
}

export function useRespondSession(matchId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, accept }: { sessionId: string; accept: boolean }) => {
      const { error } = await supabase.rpc("respond_session", { p_session_id: sessionId, p_accept: accept });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchSessionsQueryKey(matchId) });
    },
  });
}

export function useCancelSession(matchId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc("cancel_session", { p_session_id: sessionId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchSessionsQueryKey(matchId) });
    },
  });
}
