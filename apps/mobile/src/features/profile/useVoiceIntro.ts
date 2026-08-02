import * as base64js from "base64-js";
import * as FileSystem from "expo-file-system/legacy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProfileVoiceIntroRow } from "@duoqueue/shared-types";

import { signVoiceIntroUrl } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { useToastStore } from "@/store/toast-store";

/** The caller's own clip, whatever its moderation status — used on the edit screen so
 * they can see "pending review" vs. "live" for what they've recorded. */
export function useOwnVoiceIntro(profileId: string | undefined) {
  return useQuery({
    queryKey: ["own-voice-intro", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_voice_intro")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return (data as ProfileVoiceIntroRow | null) ?? null;
    },
    enabled: !!profileId,
  });
}

/** Signs the caller's own clip for playback, given the row `useOwnVoiceIntro` already
 * fetched — reuses that query instead of re-selecting `profile_voice_intro`, and signs
 * with the same `signVoiceIntroUrl` helper `usePublicVoiceIntro` uses below. Own-path
 * signing is covered by the `voice_intros_select_own_folder` storage policy (see
 * 0024_voice_intros.sql / 0032_scope_voice_intro_policies.sql): object paths are
 * `${profile_id}/${filename}`, and `profiles.id` is the same uuid as `auth.uid()` for
 * one's own account, so the folder-vs-auth.uid() check that policy makes passes for a
 * caller signing their own clip regardless of moderation_status. */
export function useOwnVoiceIntroUrl(row: ProfileVoiceIntroRow | null | undefined) {
  return useQuery({
    queryKey: ["own-voice-intro-url", row?.storage_path],
    queryFn: async () => {
      const url = await signVoiceIntroUrl(row!.storage_path);
      return url ? { url, durationSeconds: row!.duration_seconds } : null;
    },
    enabled: !!row?.storage_path,
  });
}

/** Another profile's clip — only ever resolves for approved clips (RLS via the public
 * view), fetched lazily when a profile's detail view is actually opened. */
export function usePublicVoiceIntro(profileId: string | undefined) {
  return useQuery({
    queryKey: ["public-voice-intro", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_profile_voice_intro")
        .select("storage_path, duration_seconds")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const url = await signVoiceIntroUrl(data.storage_path);
      return url ? { url, durationSeconds: data.duration_seconds as number } : null;
    },
    enabled: !!profileId,
  });
}

export function useUploadVoiceIntro(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uri, durationSeconds }: { uri: string; durationSeconds: number }) => {
      if (!profileId) throw new Error("No profile loaded.");
      const extension = uri.split(".").pop()?.toLowerCase() ?? "m4a";
      const storagePath = `${profileId}/intro-${Date.now()}.${extension}`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });

      const { error: uploadError } = await supabase.storage
        .from("voice-intros")
        .upload(storagePath, base64js.toByteArray(base64), { contentType: "audio/m4a", upsert: true });
      if (uploadError) throw uploadError;

      const { error: upsertError } = await supabase
        .from("profile_voice_intro")
        .upsert({ profile_id: profileId, storage_path: storagePath, duration_seconds: durationSeconds }, { onConflict: "profile_id" });
      if (upsertError) throw upsertError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["own-voice-intro", profileId] });
      useToastStore.getState().showToast("Voice intro submitted for review");
    },
  });
}

export function useDeleteVoiceIntro(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("No profile loaded.");
      const { error } = await supabase.from("profile_voice_intro").delete().eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["own-voice-intro", profileId] });
    },
  });
}
