import { useQuery } from "@tanstack/react-query";
import type { PhotoRole } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { signPhotoUrls } from "@/lib/storage";

export interface OwnProfilePhotos {
  profileUrl: string | null;
  headerUrl: string | null;
}

interface ProfileMediaRow {
  storage_path: string;
  photo_role: PhotoRole;
}

async function fetchOwnProfilePhotos(profileId: string): Promise<OwnProfilePhotos> {
  const { data, error } = await supabase
    .from("profile_media")
    .select("storage_path, photo_role")
    .eq("profile_id", profileId);
  if (error) throw error;

  const rows = (data ?? []) as ProfileMediaRow[];
  const signedUrls = await signPhotoUrls(rows.map((r) => r.storage_path));

  const byRole = new Map(rows.map((r) => [r.photo_role, signedUrls.get(r.storage_path) ?? null]));
  return { profileUrl: byRole.get("profile") ?? null, headerUrl: byRole.get("header") ?? null };
}

export function useOwnProfilePhotos(profileId: string | undefined) {
  return useQuery({
    queryKey: ["own-profile-photos", profileId],
    queryFn: () => fetchOwnProfilePhotos(profileId!),
    enabled: !!profileId,
  });
}
