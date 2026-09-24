import { useQuery } from "@tanstack/react-query";
import type { ModerationStatus, PhotoRole } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { signPhotoUrls } from "@/lib/storage";

import type { OwnPhotoRows } from "./pictureStatus";

/** Your own picture and old cover, signed, with their moderation status (owners can read it
 * and can sign their own pending paths). Feed it to ownPictureState. */
export type OwnProfilePhotos = OwnPhotoRows;

interface ProfileMediaRow {
  storage_path: string;
  photo_role: PhotoRole;
  moderation_status: ModerationStatus;
}

/** moderate-photo runs after the upload returns, so a new picture sits in "pending" for a few
 * seconds (longer when it is held for a person to look at). useUpdatePhoto refetches this query
 * the moment moderate-photo answers; this poll is the backup for when that answer is lost. It
 * stops after REVIEW_POLL_LIMIT fetches of this query in the app session (dataUpdateCount never
 * resets), so a picture held for manual review cannot poll forever. */
const REVIEW_POLL_MS = 5_000;
const REVIEW_POLL_LIMIT = 60;

async function fetchOwnProfilePhotos(profileId: string): Promise<OwnProfilePhotos> {
  const { data, error } = await supabase
    .from("profile_media")
    .select("storage_path, photo_role, moderation_status")
    .eq("profile_id", profileId)
    .in("photo_role", ["profile", "header"]);
  if (error) throw error;

  const rows = (data ?? []) as ProfileMediaRow[];
  const signedUrls = await signPhotoUrls(rows.map((r) => r.storage_path));
  const profileRow = rows.find((r) => r.photo_role === "profile");
  const headerRow = rows.find((r) => r.photo_role === "header");

  return {
    profileUrl: profileRow ? (signedUrls.get(profileRow.storage_path) ?? null) : null,
    profileStatus: profileRow?.moderation_status ?? null,
    headerUrl: headerRow ? (signedUrls.get(headerRow.storage_path) ?? null) : null,
    headerStatus: headerRow?.moderation_status ?? null,
  };
}

export function useOwnProfilePhotos(profileId: string | undefined) {
  return useQuery({
    queryKey: ["own-profile-photos", profileId],
    queryFn: () => fetchOwnProfilePhotos(profileId!),
    enabled: !!profileId,
    refetchInterval: (query) =>
      query.state.data?.profileStatus === "pending" && query.state.dataUpdateCount < REVIEW_POLL_LIMIT
        ? REVIEW_POLL_MS
        : false,
  });
}
