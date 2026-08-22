import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PreferencesRow } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

export function preferencesQueryKey(profileId: string | undefined) {
  return ["preferences", profileId] as const;
}

export function usePreferences() {
  const profileId = useSessionStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: preferencesQueryKey(profileId),
    queryFn: async (): Promise<PreferencesRow> => {
      const { data, error } = await supabase
        .from("preferences")
        .select("*")
        .eq("profile_id", profileId as string)
        .single();
      if (error) throw error;
      return data as PreferencesRow;
    },
    enabled: !!profileId,
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<PreferencesRow>) => {
      const { error } = await supabase.from("preferences").update(patch).eq("profile_id", profileId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: preferencesQueryKey(profileId) });
      void queryClient.invalidateQueries({ queryKey: ["deck"] });
      // The pool count itself never moves when filters change — that is the whole point of
      // it — but the empty-deck screen reads the two together, and a stale pool alongside a
      // fresh deck is how a screen ends up saying "your filters are hiding everyone" one beat
      // after the user cleared them.
      void queryClient.invalidateQueries({ queryKey: ["deck-pool-size"] });
    },
  });

  return { preferences: query.data, isLoading: query.isLoading, save };
}
