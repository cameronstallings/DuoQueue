import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { signPhotoUrls } from "@/lib/storage";

interface ProfileMediaRow {
  storage_path: string;
  position: number;
}

async function fetchOwnPhotos(profileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("profile_media")
    .select("storage_path, position")
    .eq("profile_id", profileId)
    .order("position");
  if (error) throw error;

  const rows = (data ?? []) as ProfileMediaRow[];
  const signedUrls = await signPhotoUrls(rows.map((r) => r.storage_path));
  return rows.map((r) => signedUrls.get(r.storage_path)).filter((url): url is string => !!url);
}

export function useOwnPhotos(profileId: string | undefined) {
  return useQuery({
    queryKey: ["own-photos", profileId],
    queryFn: () => fetchOwnPhotos(profileId!),
    enabled: !!profileId,
  });
}
