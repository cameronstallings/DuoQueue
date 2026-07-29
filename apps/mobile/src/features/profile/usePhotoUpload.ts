import * as base64js from "base64-js";
import * as FileSystem from "expo-file-system/legacy";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PhotoRole } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useToastStore } from "@/store/toast-store";

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

  const { data: mediaRow, error: mediaError } = await supabase
    .from("profile_media")
    .upsert(
      { profile_id: profileId, storage_path: storagePath, photo_role: role, moderation_status: "pending" },
      { onConflict: "profile_id,photo_role" },
    )
    .select("id")
    .single();
  if (mediaError) throw mediaError;

  // Best-effort, non-blocking: a failed moderation check just leaves the photo
  // "pending" (invisible to other users) rather than failing the upload.
  supabase.functions.invoke("moderate-photo", { body: { mediaId: mediaRow.id } }).catch((err: unknown) => {
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
