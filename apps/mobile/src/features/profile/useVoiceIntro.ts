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
