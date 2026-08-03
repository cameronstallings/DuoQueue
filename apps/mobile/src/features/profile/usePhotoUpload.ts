import * as base64js from "base64-js";
import * as FileSystem from "expo-file-system/legacy";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MAX_GALLERY_PHOTOS, type PhotoRole } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useToastStore } from "@/store/toast-store";

const OWN_GALLERY_QUERY_KEY = "own-gallery-photos";

/** Uploads a local image URI to Storage and upserts the profile_media row for the given
 * role (profile/header) — shared by onboarding and the Profile tab's tap-to-replace
 * tiles, since both need the exact same upload-then-record-then-moderate sequence. */
export async function uploadProfilePhoto(profileId: string, uri: string, role: PhotoRole): Promise<void> {
  const extension = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${profileId}/${role}-${Date.now()}.${extension}`;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";

  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(storagePath, base64js.toByteArray(base64), { contentType, upsert: true });
  if (uploadError) throw uploadError;

  // Update-then-insert rather than upsert: clients hold column-level grants here
  // (insert: profile_id/storage_path/photo_role, update: storage_path only), so an
  // upsert's conflict path would try to write columns it isn't allowed to touch.
  // moderation_status is deliberately never sent — it defaults to 'pending' on insert,
  // and a trigger resets it to 'pending' whenever storage_path changes, so only the
  // moderate-photo function can ever approve a photo.
  const { data: updatedRow, error: updateError } = await supabase
    .from("profile_media")
    .update({ storage_path: storagePath })
    .eq("profile_id", profileId)
    .eq("photo_role", role)
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;

  let mediaId = updatedRow?.id;

  if (!mediaId) {
    const { data: insertedRow, error: insertError } = await supabase
      .from("profile_media")
      .insert({ profile_id: profileId, storage_path: storagePath, photo_role: role })
      .select("id")
      .single();
    if (insertError) throw insertError;
    mediaId = insertedRow.id;
  }

  // Best-effort, non-blocking: a failed moderation check just leaves the photo
  // "pending" (invisible to other users) rather than failing the upload.
  supabase.functions.invoke("moderate-photo", { body: { mediaId } }).catch((err: unknown) => {
    console.warn("moderate-photo invocation failed:", err);
  });
}

export function useUpdatePhoto(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri, role }: { uri: string; role: PhotoRole }) => {
      if (!profileId) throw new Error("No profile loaded.");
      await uploadProfilePhoto(profileId, uri, role);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["own-profile-photos", profileId] });
      useToastStore.getState().showToast("Photo updated");
    },
  });
}

/** The first free slot in 0..MAX_GALLERY_PHOTOS-1 not already held by one of the
 * caller's gallery rows — removals can leave gaps (e.g. [0, 2, 4]), so this fills
 * those before ever extending past the highest position in use. Returns null when the
 * gallery is already full. */
function nextFreeGalleryPosition(usedPositions: number[]): number | null {
  for (let position = 0; position < MAX_GALLERY_PHOTOS; position++) {
    if (!usedPositions.includes(position)) return position;
  }
  return null;
}

/** Uploads a local image URI as a new gallery photo at the given position. Unlike
 * uploadProfilePhoto, this always INSERTs — profile_media allows many 'gallery' rows
 * per profile (unlike the single-row profile/header roles), so there's no existing row
 * to update-in-place. Goes through the same upload-then-record-then-moderate sequence. */
export async function uploadGalleryPhoto(profileId: string, uri: string, position: number): Promise<void> {
  const extension = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${profileId}/gallery-${Date.now()}.${extension}`;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";

  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(storagePath, base64js.toByteArray(base64), { contentType, upsert: true });
  if (uploadError) throw uploadError;

  const { data: insertedRow, error: insertError } = await supabase
    .from("profile_media")
    .insert({ profile_id: profileId, storage_path: storagePath, photo_role: "gallery", position })
    .select("id")
    .single();
  if (insertError) throw insertError;

  // Best-effort, non-blocking: a failed moderation check just leaves the photo
  // "pending" (invisible to other users, shown as "In review" to the owner) rather
  // than failing the upload.
  supabase.functions.invoke("moderate-photo", { body: { mediaId: insertedRow.id } }).catch((err: unknown) => {
    console.warn("moderate-photo invocation failed:", err);
  });
}

export function useAddGalleryPhoto(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri, usedPositions }: { uri: string; usedPositions: number[] }) => {
      if (!profileId) throw new Error("No profile loaded.");
      const position = nextFreeGalleryPosition(usedPositions);
      if (position === null) throw new Error("Your gallery is full.");
      await uploadGalleryPhoto(profileId, uri, position);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [OWN_GALLERY_QUERY_KEY, profileId] });
      useToastStore.getState().showToast("Photo added");
    },
    onError: (err) => {
      useToastStore.getState().showToast(err instanceof Error ? err.message : "Couldn't add that photo");
    },
  });
}

/** Reorders via the make_gallery_photo_first RPC rather than a client-side UPDATE:
 * moving a photo to the front means shifting every row ahead of it back by one, and
 * that multi-row position swap needs a deferred uniqueness check to avoid a false
 * conflict — only reachable from inside a single transaction, which a
 * SECURITY DEFINER function gets for free and a sequence of PostgREST calls does not.
 * See supabase/migrations/0036_photo_gallery.sql. */
export function useMakeGalleryPhotoFirst(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mediaId: string) => {
      const { error } = await supabase.rpc("make_gallery_photo_first", { p_media_id: mediaId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [OWN_GALLERY_QUERY_KEY, profileId] });
    },
  });
}

export function useRemoveGalleryPhoto(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mediaId, storagePath }: { mediaId: string; storagePath: string }) => {
      const { error: deleteError } = await supabase.from("profile_media").delete().eq("id", mediaId);
      if (deleteError) throw deleteError;

      // Best-effort: the row is already gone either way, so a storage cleanup failure
      // shouldn't block the removal or surface as an error the user can't act on.
      const { error: storageError } = await supabase.storage.from("profile-photos").remove([storagePath]);
      if (storageError) console.warn("failed to remove gallery photo from storage:", storageError);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [OWN_GALLERY_QUERY_KEY, profileId] });
      useToastStore.getState().showToast("Photo removed");
    },
  });
}
