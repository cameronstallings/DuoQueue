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

/** Signed URLs are reused while the path and status are unchanged. Every signing mints a new
 * token, and expo-image caches by URL, so re-signing on each poll would reload and cross-fade the
 * picture every 5s on the card, the Edit slot and the DUO LOCKED chip. The status is part of the
 * key because moderate-photo overwrites the file in place when it rules, so the URL changes once
 * then. Reused for 50 minutes of the 60-minute signature (lib/storage.ts). */
const SIGNED_URL_REUSE_MS = 50 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; signedAt: number }>();

function signedUrlKey(row: ProfileMediaRow): string {
  return `${row.storage_path}|${row.moderation_status}`;
}

async function stableSignedUrls(rows: ProfileMediaRow[]): Promise<Map<string, string>> {
  const now = Date.now();
  const urls = new Map<string, string>();
  const toSign: ProfileMediaRow[] = [];
  for (const row of rows) {
    const cached = signedUrlCache.get(signedUrlKey(row));
    if (cached && now - cached.signedAt < SIGNED_URL_REUSE_MS) urls.set(row.storage_path, cached.url);
    else toSign.push(row);
  }
  if (toSign.length === 0) return urls;

  const fresh = await signPhotoUrls(toSign.map((r) => r.storage_path));
  for (const row of toSign) {
    const url = fresh.get(row.storage_path);
    if (!url) continue;
    urls.set(row.storage_path, url);
    signedUrlCache.set(signedUrlKey(row), { url, signedAt: now });
  }
  return urls;
}

async function fetchOwnProfilePhotos(profileId: string): Promise<OwnProfilePhotos> {
  const { data, error } = await supabase
    .from("profile_media")
    .select("storage_path, photo_role, moderation_status")
    .eq("profile_id", profileId)
    .in("photo_role", ["profile", "header"]);
  if (error) throw error;

  const rows = (data ?? []) as ProfileMediaRow[];
  const signedUrls = await stableSignedUrls(rows);
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
