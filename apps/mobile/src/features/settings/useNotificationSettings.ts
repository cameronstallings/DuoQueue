import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationSettingsRow } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

function queryKey(profileId: string | undefined) {
  return ["notification-settings", profileId] as const;
}

export function useNotificationSettings() {
  const profileId = useSessionStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKey(profileId),
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

  const update = useMutation({
    mutationFn: async (patch: Partial<NotificationSettingsRow>) => {
      const { error } = await supabase
        .from("notification_settings")
        .update(patch)
        .eq("profile_id", profileId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKey(profileId) });
    },
  });

  return { settings: query.data, isLoading: query.isLoading, error: query.error, update, refetch: query.refetch };
}
