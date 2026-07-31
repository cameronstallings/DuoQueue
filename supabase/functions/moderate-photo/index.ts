// Sanitizes and moderates a just-uploaded profile photo, then flips its
// moderation_status. Called by the client right after upload completes.
// moderation_status has no client write grant (0006_moderation_and_notifications.sql),
// so this function — using the service role for the actual update — is the only path
// a photo can move from "pending" to "approved" (and become visible to other users via
// public_profile_media, which filters on moderation_status = 'approved').
//
// Order matters: the image is re-encoded (stripping EXIF/GPS and validating the real
// bytes — see sanitize.ts) and the sanitized version overwrites the stored object
// BEFORE the moderation check runs, so the bytes that get checked are the same bytes
// that will actually be served.
import { createClient } from "@supabase/supabase-js";

import { checkImage } from "./provider.ts";
import { ImageRejectedError, sanitizeImage } from "./sanitize.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  const body = (await req.json().catch(() => ({}))) as { mediaId?: string };
  const mediaId = body.mediaId;
  if (!mediaId) {
    return jsonResponse({ error: "mediaId is required" }, 400);
  }

  // RLS (profile_media_all_own) means this only succeeds if the media row belongs to
  // the caller — no separate ownership check needed.
  const { data: media, error: mediaError } = await userClient
    .from("profile_media")
    .select("id, profile_id, storage_path")
    .eq("id", mediaId)
    .single();
  if (mediaError || !media) {
    return jsonResponse({ error: "Media not found" }, 404);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- Sanitize: strip EXIF and validate the real bytes, then overwrite in place. ---
  const { data: originalBlob, error: downloadError } = await serviceClient.storage
    .from("profile-photos")
    .download(media.storage_path);
  if (downloadError || !originalBlob) {
    return jsonResponse({ error: downloadError?.message ?? "Could not read uploaded photo" }, 500);
  }

  let sanitized;
  try {
    sanitized = await sanitizeImage(new Uint8Array(await originalBlob.arrayBuffer()));
  } catch (err) {
    // A file that won't decode is never getting approved — mark it rejected so it
    // can't linger as "pending" and so the client gets a real reason back.
    if (err instanceof ImageRejectedError) {
      await serviceClient.from("profile_media").update({ moderation_status: "rejected" }).eq("id", mediaId);
      return jsonResponse({ moderationStatus: "rejected", reason: err.message }, 200);
    }
    throw err;
  }

  const { error: reuploadError } = await serviceClient.storage
    .from("profile-photos")
    .upload(media.storage_path, sanitized.bytes, { contentType: sanitized.contentType, upsert: true });
  if (reuploadError) {
    return jsonResponse({ error: reuploadError.message }, 500);
  }

  // --- Moderate the sanitized image. ---
  const { data: signed, error: signError } = await serviceClient.storage
    .from("profile-photos")
    .createSignedUrl(media.storage_path, 300);
  if (signError || !signed) {
    return jsonResponse({ error: signError?.message ?? "Could not sign photo URL" }, 500);
  }

  const result = await checkImage(signed.signedUrl);
  const moderationStatus = result.approved ? "approved" : "rejected";

  const { error: updateError } = await serviceClient
    .from("profile_media")
    .update({ moderation_status: moderationStatus })
    .eq("id", mediaId);
  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  return jsonResponse({ moderationStatus, reason: result.reason }, 200);
});
