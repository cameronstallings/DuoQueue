import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

const PREMIUM_STATUSES = new Set(["active", "trialing", "grace_period"]);

export function usePremiumStatus() {
  const profileId = useSessionStore((s) => s.session?.user.id);

  const query = useQuery({
    queryKey: ["subscription", profileId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("profile_id", profileId as string)
        .maybeSingle();
      if (error) throw error;
      return data ? PREMIUM_STATUSES.has(data.status) : false;
    },
    enabled: !!profileId,
  });

  return { isPremium: query.data ?? false, isLoading: query.isLoading };
}
