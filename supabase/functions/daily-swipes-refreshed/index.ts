// Scheduled (not trigger-driven) — invoke this hourly via a Supabase Cron Trigger or
// any external scheduler (e.g. a GitHub Actions cron workflow) hitting this URL with
// `Authorization: Bearer <INTERNAL_TRIGGER_AUTH_TOKEN>`. Each run asks Postgres which
// free-tier users should hear that their swipes are back and haven't been notified for
// that local day yet (get_profiles_needing_swipe_refresh_notification), then sends and
// records each one — so re-running this within the same hour, or a scheduler that skips
// a beat, never double-notifies.
//
// WHO, since 0076 (all decided in that RPC, none of it here): only players who used all 25
// free swipes yesterday, have not swiped yet today and still have someone in their deck, from
// 10:00 their local time, never demo accounts. It used to be every free player at local
// midnight, about 15 pushes a night that almost nobody acted on. The RPC's name and its one
// column are unchanged, so this loop is too.
//
// Each push is recorded in push_log (0080) as event "daily_swipes_refreshed" (pushToProfile).
import { createClient } from "npm:@supabase/supabase-js@2";

import { pushToProfile } from "../_shared/push-delivery.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";
import { supabaseSecretKey } from "../_shared/supabase-keys.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY = supabaseSecretKey();
const INTERNAL_TRIGGER_AUTH_TOKEN = requireSecret("INTERNAL_TRIGGER_AUTH_TOKEN");

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  // Each run fans out a query-plus-push per candidate, so a GET from a crawler or a
  // scheduler double-fire shouldn't be able to kick it off.
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const unauthorized = await checkBearerAuth(req, INTERNAL_TRIGGER_AUTH_TOKEN);
  if (unauthorized) return unauthorized;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

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
      await pushToProfile(supabase, {
        recipientId: profileId,
        event: "daily_swipes_refreshed",
        category: "daily_swipes_refreshed",
        tokens: tokenList,
        title: "Swipes refreshed!",
        body: "Your daily swipes are back. Go find your next duo.",
      });
      notified++;
    }

    await supabase
      .from("swipe_refresh_notifications")
      .upsert({ profile_id: profileId, last_notified_day: localDateStr });
  }

  return jsonResponse({ checked: candidates?.length ?? 0, notified }, 200);
});
