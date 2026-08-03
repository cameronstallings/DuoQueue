import { useQuery } from "@tanstack/react-query";
import type { ModerationStatus } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { signPhotoUrls } from "@/lib/storage";

export interface OwnGalleryPhoto {
  id: string;
  url: string;
  storagePath: string;
  position: number;
  moderationStatus: ModerationStatus;
}

interface GalleryMediaRow {
  id: string;
  storage_path: string;
  position: number | null;
  moderation_status: ModerationStatus;
}

/** Fetches the caller's own gallery photos — every moderation status, not just
 * approved, so the Photos panel can show pending/rejected tiles with an "In review"
 * chip the same way the rest of the app never hides a user's own pending uploads from
 * them. Ordered by position (0..5); a null position would mean a profile/header row
 * leaked in under photo_role = 'gallery', which shouldn't happen, so it's filtered
 * defensively rather than trusted. */
async function fetchOwnGalleryPhotos(profileId: string): Promise<OwnGalleryPhoto[]> {
  const { data, error } = await supabase
    .from("profile_media")
    .select("id, storage_path, position, moderation_status")
    .eq("profile_id", profileId)
    .eq("photo_role", "gallery")
    .order("position");
  if (error) throw error;

  const rows = (data ?? []) as GalleryMediaRow[];
  const signedUrls = await signPhotoUrls(rows.map((r) => r.storage_path));

  const photos: OwnGalleryPhoto[] = [];
  for (const row of rows) {
    if (row.position === null) continue;
    const url = signedUrls.get(row.storage_path);
    if (!url) continue;
    photos.push({
      id: row.id,
      url,
      storagePath: row.storage_path,
      position: row.position,
      moderationStatus: row.moderation_status,
    });
  }
  return photos;
}

export function useOwnGalleryPhotos(profileId: string | undefined) {
  return useQuery({
    queryKey: ["own-gallery-photos", profileId],
    queryFn: () => fetchOwnGalleryPhotos(profileId!),
    enabled: !!profileId,
  });
}
