// Permanently deletes the caller's account and all personal data (App Store/Play Store
// account-deletion requirement). Storage objects aren't linked via a Postgres FK, so
// they're removed explicitly; everything else cascades automatically once the
// auth.users row is deleted, thanks to `on delete cascade` on every profile-linked table
// (profiles -> profile_media/games/shows/platforms/languages/playstyles/preferences/
// push_tokens/notification_settings/subscriptions, and swipes/matches/reports/blocks,
// which themselves cascade further into messages/discord_shares — see 0001_init.sql).
import { createClient } from "npm:@supabase/supabase-js@2";

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

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Every bucket holding personal data. Voice intros are recordings of the user's own
  // voice: the profile_voice_intro row cascades away with the profile, but the audio
  // object does not, and once the profile is gone no policy can ever reach it again.
  // Missing one here means "delete my account" quietly leaves personal data behind,
  // which is exactly what the App Store / Play deletion requirement forbids.
  for (const bucket of ["profile-photos", "voice-intros"]) {
    // list() returns at most 100 entries per call and does not paginate on its own.
    // Uploads accumulate (each one writes a fresh timestamped key), so a long-lived
    // account can easily exceed that — the old code deleted the first page and
    // reported success.
    for (;;) {
      const { data: files, error: listError } = await serviceClient.storage
        .from(bucket)
        .list(user.id, { limit: 1000 });
      if (listError) {
        console.error("failed to list objects during account deletion", { bucket, message: listError.message });
        return jsonResponse({ error: "Failed to delete stored files" }, 500);
      }
      if (!files || files.length === 0) break;

      const paths = files.map((f) => `${user.id}/${f.name}`);
      const { error: removeError } = await serviceClient.storage.from(bucket).remove(paths);
      if (removeError) {
        console.error("failed to remove objects during account deletion", { bucket, message: removeError.message });
        return jsonResponse({ error: "Failed to delete stored files" }, 500);
      }

      if (files.length < 1000) break;
    }
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
