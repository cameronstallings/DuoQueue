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

  const { data: files, error: listError } = await serviceClient.storage.from("profile-photos").list(user.id);
  if (listError) {
    return jsonResponse({ error: `Failed to list photos: ${listError.message}` }, 500);
  }
  if (files && files.length > 0) {
    const paths = files.map((f) => `${user.id}/${f.name}`);
    const { error: removeError } = await serviceClient.storage.from("profile-photos").remove(paths);
    if (removeError) {
      return jsonResponse({ error: `Failed to delete photos: ${removeError.message}` }, 500);
    }
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
