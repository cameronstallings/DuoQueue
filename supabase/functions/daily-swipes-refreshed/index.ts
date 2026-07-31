// Scheduled (not trigger-driven) — invoke this hourly via a Supabase Cron Trigger or
// any external scheduler (e.g. a GitHub Actions cron workflow) hitting this URL with
// `Authorization: Bearer <INTERNAL_TRIGGER_AUTH_TOKEN>`. Each run asks Postgres which
// free-tier users are at their local midnight right now and haven't been notified for
// that local day yet (get_profiles_needing_swipe_refresh_notification), then sends and
// records each one — so re-running this within the same hour, or a scheduler that skips
// a beat, never double-notifies.
import { createClient } from "npm:@supabase/supabase-js@2";

import { sendExpoPush } from "../_shared/expo-push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TRIGGER_AUTH_TOKEN = Deno.env.get("INTERNAL_TRIGGER_AUTH_TOKEN");

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (INTERNAL_TRIGGER_AUTH_TOKEN) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${INTERNAL_TRIGGER_AUTH_TOKEN}`) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: candidates, error } = await supabase.rpc(
    "get_profiles_needing_swipe_refresh_notification",
  );
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  let notified = 0;

  for (const { profile_id: profileId } of candidates ?? []) {
    const [{ data: profile }, { data: settings }, { data: tokens }] = await Promise.all([
      supabase.from("profiles").select("timezone").eq("id", profileId).single(),
      supabase
        .from("notification_settings")
        .select("daily_swipes_refreshed")
        .eq("profile_id", profileId)
        .maybeSingle(),
      supabase.from("push_tokens").select("expo_push_token").eq("profile_id", profileId),
    ]);

    const localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: profile?.timezone ?? "UTC" }).format(
      new Date(),
    );

    if (settings?.daily_swipes_refreshed !== false) {
      const tokenList = (tokens ?? []).map((t) => t.expo_push_token as string);
      await sendExpoPush(
        tokenList,
        "Swipes refreshed!",
        "Your daily swipes are back — go find your next duo.",
        { category: "daily_swipes_refreshed" },
      );
      notified++;
    }

    await supabase
      .from("swipe_refresh_notifications")
      .upsert({ profile_id: profileId, last_notified_day: localDateStr });
  }

  return jsonResponse({ checked: candidates?.length ?? 0, notified }, 200);
});
