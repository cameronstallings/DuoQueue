import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationSettingsRow } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";

import { NOTIFICATION_SAVE_FAILED } from "./notificationCategories";

/** Exported so other readers (the Duo Pops card's setting) share the one cache entry. */
export function notificationSettingsQueryKey(profileId: string | undefined) {
  return ["notification-settings", profileId] as const;
}

const UPDATE_MUTATION_KEY = ["notification-settings-update"] as const;

export function useNotificationSettings() {
  const profileId = useSessionStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();
  const queryKey = notificationSettingsQueryKey(profileId);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<NotificationSettingsRow> => {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("profile_id", profileId as string)
        .single();
      if (error) throw error;
      return data as NotificationSettingsRow;
    },
    enabled: !!profileId,
  });

  /**
   * Optimistic, so a switch moves the moment it is flipped and stays there. Before 1.0.2 the
   * switch was bound to the server row, so it snapped back to its old position while the update
   * was in flight and flicked over again when the refetch landed. Now the patch is written into
   * the cache first; a failure puts the old row back and says so in an error toast (which buzzes
   * by itself). The re-read waits until the last of several quick flips has settled, so an early
   * refetch cannot flick a later switch back.
   */
  const update = useMutation({
    mutationKey: UPDATE_MUTATION_KEY,
    mutationFn: async (patch: Partial<NotificationSettingsRow>) => {
      const { error } = await supabase
        .from("notification_settings")
        .update(patch)
        .eq("profile_id", profileId as string);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationSettingsRow>(queryKey);
      if (previous) queryClient.setQueryData<NotificationSettingsRow>(queryKey, { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      useToastStore.getState().showToast(NOTIFICATION_SAVE_FAILED, "error");
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: UPDATE_MUTATION_KEY }) === 1) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  return { settings: query.data, isLoading: query.isLoading, error: query.error, update, refetch: query.refetch };
}
