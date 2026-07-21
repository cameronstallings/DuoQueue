// Receives RevenueCat webhook events and upserts public.subscriptions using the
// service role — the only writer to that table (see 0001_init.sql: no client
// INSERT/UPDATE grant on subscriptions). Configure this URL + a shared secret in
// the RevenueCat dashboard (Project Settings -> Integrations -> Webhooks), and set
// REVENUECAT_WEBHOOK_AUTH_TOKEN as a secret on this function with the same value.
import { createClient } from "@supabase/supabase-js";

import { mapEventToStatus, mapStore, type RevenueCatEvent } from "./mapping.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_AUTH_TOKEN = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_TOKEN");

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

  if (WEBHOOK_AUTH_TOKEN) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${WEBHOOK_AUTH_TOKEN}`) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  const body = (await req.json().catch(() => null)) as RevenueCatWebhookBody | null;
  const event = body?.event;
  if (!event?.app_user_id || !event.type) {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  const { status, willRenew, isTrial } = mapEventToStatus(event);

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
