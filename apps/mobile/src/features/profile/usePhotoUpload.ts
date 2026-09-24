import * as base64js from "base64-js";
import * as FileSystem from "expo-file-system/legacy";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useToastStore } from "@/store/toast-store";

/** Matches the profile-photos bucket's file_size_limit (0002_storage.sql) and
 * MAX_IMAGE_BYTES in supabase/functions/moderate-photo/sanitize.ts. Checked client-side
 * before upload so a too-large photo fails with one friendly message here, instead of
 * uploading successfully (Storage's own limit rejects it) or uploading and only failing
 * later inside moderate-photo's re-encode step. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export class PhotoTooLargeError extends Error {
  constructor() {
    super("That photo is too large. Please choose one under 5MB.");
    this.name = "PhotoTooLargeError";
  }
}

/** Exported so onboarding can check a picture the moment it is picked, on the step where it
 * was picked, rather than only when the last step uploads it. */
export async function assertPhotoWithinSizeLimit(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  // `exists` narrows FileInfo so `.size` is present; a picker-returned uri that somehow
  // doesn't exist on disk is a different failure the upload call below will surface on
  // its own — this check only guards the size case.
  if (info.exists && info.size > MAX_PHOTO_BYTES) {
    throw new PhotoTooLargeError();
  }
}

/**
 * Build 11 is a manual-release backup that is never released, and it draws the swipe card
 * only from the `header` row. If build 11 is ever released, set this to true so every
 * picture is also written as `header` until build 11 is gone. That is two uploads and two
 * moderate-photo calls per picture; each row keeps its own storage path because moderation
 * runs per row. See the build 12 spec's compatibility rule.
 */
export const ALSO_WRITE_HEADER = false;

/** Uploads a local image URI to Storage and upserts the profile_media row for the given
 * role, then asks moderate-photo to review it. `onReviewed` runs once moderate-photo has
 * answered (approved, rejected or held for a person), so the owner's review tag can refresh
 * then instead of on the next poll. */
export async function uploadProfilePhoto(
  profileId: string,
  uri: string,
  role: "profile" | "header",
  onReviewed?: () => void,
): Promise<void> {
  await assertPhotoWithinSizeLimit(uri);
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
  // "pending" (invisible to other users) rather than failing the upload. moderate-photo
  // writes its verdict before it responds, so onReviewed sees the new status.
  supabase.functions
    .invoke("moderate-photo", { body: { mediaId } })
    .then(() => onReviewed?.())
    .catch((err: unknown) => {
      console.warn("moderate-photo invocation failed:", err);
    });
}

/** The one picture a player has. Onboarding, Edit and the Profile tab all upload through here,
 * so the build 11 rule above is one switch. */
export async function uploadPicture(profileId: string, uri: string, onReviewed?: () => void): Promise<void> {
  await uploadProfilePhoto(profileId, uri, "profile", onReviewed);
  if (ALSO_WRITE_HEADER) await uploadProfilePhoto(profileId, uri, "header");
}

export function useUpdatePhoto(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri }: { uri: string }) => {
      if (!profileId) throw new Error("No profile loaded.");
      await uploadPicture(profileId, uri, () => {
        // moderate-photo has answered: clear or change the review tag now.
        void queryClient.invalidateQueries({ queryKey: ["own-profile-photos", profileId] });
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["own-profile-photos", profileId] });
      useToastStore.getState().showToast("Picture updated");
    },
    onError: (err) => {
      useToastStore.getState().showToast(err instanceof Error ? err.message : "Couldn't update that picture", "error");
    },
  });
}
