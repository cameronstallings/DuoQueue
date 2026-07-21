import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReportReason } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

import { MATCHES_QUERY_KEY } from "./useMatches";

export function useUnmatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc("unmatch", { p_match_id: matchId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
    },
  });
}

export function useBlockUser() {
  const myId = useSessionStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockedId: string) => {
      if (!myId) throw new Error("Not authenticated");
      const { error } = await supabase.from("blocks").insert({ blocker_id: myId, blocked_id: blockedId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["deck"] });
    },
  });
}

interface ReportInput {
  reportedId: string;
  matchId?: string;
  reason: ReportReason;
  details?: string;
}

export function useReportUser() {
  const myId = useSessionStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async ({ reportedId, matchId, reason, details }: ReportInput) => {
      if (!myId) throw new Error("Not authenticated");
      const { error } = await supabase.from("reports").insert({
        reporter_id: myId,
        reported_id: reportedId,
        match_id: matchId ?? null,
        reason,
        details: details ?? null,
      });
      if (error) throw error;
    },
  });
}
