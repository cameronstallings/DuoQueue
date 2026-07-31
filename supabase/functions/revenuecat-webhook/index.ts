// Receives RevenueCat webhook events and upserts public.subscriptions using the
// service role — the only writer to that table (see 0001_init.sql: no client
// INSERT/UPDATE grant on subscriptions). Configure this URL + a shared secret in
// the RevenueCat dashboard (Project Settings -> Integrations -> Webhooks), and set
// REVENUECAT_WEBHOOK_AUTH_TOKEN as a secret on this function with the same value.
import { createClient } from "npm:@supabase/supabase-js@2";

import { CONSUMABLE_GRANTS, mapEventToStatus, mapStore, type RevenueCatEvent } from "./mapping.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_AUTH_TOKEN = requireSecret("REVENUECAT_WEBHOOK_AUTH_TOKEN");

interface RevenueCatWebhookBody {
  api_version?: string;
  event?: RevenueCatEvent;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const unauthorized = await checkBearerAuth(req, WEBHOOK_AUTH_TOKEN);
  if (unauthorized) return unauthorized;

  const body = (await req.json().catch(() => null)) as RevenueCatWebhookBody | null;
  const event = body?.event;
  if (!event?.app_user_id || !event.type) {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const consumableGrant = CONSUMABLE_GRANTS[event.product_id];
  if (consumableGrant) {
    // Boost/Roses aren't subscriptions — grant credits instead of touching
    // `subscriptions`. Guard against RevenueCat's at-least-once webhook delivery
    // double-granting credits on a retried event.
    const { error: dedupeError } = await serviceClient
      .from("processed_webhook_events")
      .insert({ event_id: event.id });
    if (dedupeError) {
      if (dedupeError.code === "23505") {
        return jsonResponse({ ok: true, duplicate: true }, 200);
      }
      console.error("dedupe insert failed", { event_id: event.id, code: dedupeError.code });
      return jsonResponse({ error: "Internal error" }, 500);
    }

    const { error: grantError } = await serviceClient.rpc("grant_consumable_credits", {
      p_profile_id: event.app_user_id,
      p_boosts: consumableGrant.boosts ?? 0,
      p_roses: consumableGrant.roses ?? 0,
    });
    if (grantError) {
      // The dedup marker is written first so concurrent deliveries can't double-grant,
      // but that means a failed grant would otherwise be permanent: RevenueCat's retry
      // hits the marker and reports success while the customer never got what they paid
      // for. Release the marker so the retry actually re-runs the grant.
      const { error: releaseError } = await serviceClient
        .from("processed_webhook_events")
        .delete()
        .eq("event_id", event.id);
      if (releaseError) {
        console.error("failed to release dedupe marker after a failed grant", {
          event_id: event.id,
          profile_id: event.app_user_id,
        });
      }
      console.error("grant_consumable_credits failed", { event_id: event.id, code: grantError.code });
      return jsonResponse({ error: "Internal error" }, 500);
    }
    return jsonResponse({ ok: true }, 200);
  }

  const { status, willRenew, isTrial } = mapEventToStatus(event);

  const { error } = await serviceClient.from("subscriptions").upsert({
    profile_id: event.app_user_id,
    revenuecat_app_user_id: event.app_user_id,
    product_id: event.product_id,
    status,
    entitlement: event.entitlement_ids?.[0] ?? "premium",
    current_period_end: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    will_renew: willRenew,
    is_trial: isTrial,
    store: mapStore(event.store),
    raw_event: event,
  });

  if (error) {
    // An app_user_id that isn't a real profile (a RevenueCat anonymous id, say) trips
    // the FK. Retrying can never fix that, so acknowledge instead of leaving RevenueCat
    // redelivering the same event forever.
    if (error.code === "23503" || error.code === "22P02") {
      console.warn("webhook event for an unmappable app_user_id — acknowledging", {
        event_id: event.id,
        app_user_id: event.app_user_id,
      });
      return jsonResponse({ ok: true, ignored: "unknown_user" }, 200);
    }
    console.error("subscriptions upsert failed", { event_id: event.id, code: error.code });
    return jsonResponse({ error: "Internal error" }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
