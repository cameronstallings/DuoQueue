import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MatchFeedbackTag } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

export interface ReputationCount {
  tag: MatchFeedbackTag;
  tag_count: number;
}

/** Tags shown publicly on someone else's profile — "flaked" is tracked (see the
 * submit RPC) but deliberately never surfaced as a visible negative count, to avoid
 * turning reputation into a dogpiling/harassment vector. */
export const PUBLIC_REPUTATION_TAGS: MatchFeedbackTag[] = ["good_comms", "chill_after_losses", "showed_up_on_time"];
const PUBLIC_DISPLAY_THRESHOLD = 3;

export function usePublicReputation(profileId: string | undefined) {
  return useQuery({
    queryKey: ["reputation", profileId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_reputation", { p_profile_id: profileId });
      if (error) throw error;
      const rows = (data ?? []) as ReputationCount[];
      return rows.filter((r) => PUBLIC_REPUTATION_TAGS.includes(r.tag) && r.tag_count >= PUBLIC_DISPLAY_THRESHOLD);
    },
    enabled: !!profileId,
  });
}

export function useSubmitMatchFeedback(matchId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tags: MatchFeedbackTag[]) => {
      if (!matchId) throw new Error("No match loaded.");
      const { error } = await supabase.rpc("submit_match_feedback", { p_match_id: matchId, p_tags: tags });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reputation"] });
    },
  });
}
