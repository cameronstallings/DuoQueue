import { useQuery } from "@tanstack/react-query";
import type { Admirer } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { signPhotoUrls } from "@/lib/storage";

export interface AdmirerListItem extends Admirer {
  photoUrl: string | null;
}

export function useAdmirersCount() {
  return useQuery({
    queryKey: ["admirers-count"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_admirers_count");
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}

export function useAdmirers(enabled: boolean) {
  return useQuery({
    queryKey: ["admirers"],
    queryFn: async (): Promise<AdmirerListItem[]> => {
      const { data, error } = await supabase.rpc("get_admirers");
      if (error) throw error;
      const rows = (data ?? []) as Admirer[];
      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.profile_id);
      const { data: media, error: mediaError } = await supabase
        .from("public_profile_media")
        .select("profile_id, storage_path, photo_role")
        .in("profile_id", ids)
        .eq("photo_role", "profile");
      if (mediaError) throw mediaError;

      const profilePhotoByProfile = new Map((media ?? []).map((m) => [m.profile_id as string, m.storage_path as string]));
      const signedUrls = await signPhotoUrls([...profilePhotoByProfile.values()]);

      return rows.map((row) => {
        const path = profilePhotoByProfile.get(row.profile_id);
        return { ...row, photoUrl: path ? (signedUrls.get(path) ?? null) : null };
      });
    },
    enabled,
  });
}
