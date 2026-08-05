import { supabase } from "@/lib/supabase";

const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Batch-signs profile-photo storage paths. The bucket is private (see
 * supabase/migrations/0002_storage.sql), so every read goes through a signed URL rather
 * than a public one — signing itself is still gated by the caller's storage.objects RLS. */
export async function signPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from("profile-photos")
    .createSignedUrls(paths, PHOTO_SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const entry of data) {
    if (entry.signedUrl && entry.path) map.set(entry.path, entry.signedUrl);
  }
  return map;
}
