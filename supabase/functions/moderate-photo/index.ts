// Runs a (pluggable, see provider.ts) NSFW check on a just-uploaded profile photo and
// flips its moderation_status. Called by the client right after upload completes.
// moderation_status has no client write grant (0006_moderation_and_notifications.sql),
// so this function — using the service role for the actual update — is the only path
// a photo can move from "pending" to "approved" (and become visible to other users via
// public_profile_media, which filters on moderation_status = 'approved').
import { createClient } from "@supabase/supabase-js";

import { checkImage } from "./provider.ts";

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

  const { data: signed, error: signError } = await userClient.storage
    .from("profile-photos")
    .createSignedUrl(media.storage_path, 300);
  if (signError || !signed) {
    return jsonResponse({ error: signError?.message ?? "Could not sign photo URL" }, 500);
  }

  const result = await checkImage(signed.signedUrl);
  const moderationStatus = result.approved ? "approved" : "rejected";

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error: updateError } = await serviceClient
    .from("profile_media")
    .update({ moderation_status: moderationStatus })
    .eq("id", mediaId);
  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  return jsonResponse({ moderationStatus, reason: result.reason }, 200);
});
