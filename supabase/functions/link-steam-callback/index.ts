// Completes a Steam OpenID 2.0 login and links the verified SteamID64 to whichever
// profile started the flow (looked up via the one-time `state` token from
// start_steam_link() — see 0025_linked_accounts.sql; never trust a client-supplied
// profile_id here, or anyone could attach a Steam account to someone else's profile).
//
// Configure as this function's URL registered as the OpenID return_to/realm, and set:
//   STEAM_WEB_API_KEY  — free, instant self-serve key from https://steamcommunity.com/dev/apikey
//   APP_DEEP_LINK_SCHEME (optional, defaults to "duoqueue")
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STEAM_WEB_API_KEY = Deno.env.get("STEAM_WEB_API_KEY");
const APP_DEEP_LINK_SCHEME = Deno.env.get("APP_DEEP_LINK_SCHEME") ?? "duoqueue";

const CLAIMED_ID_PATTERN = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/;

function redirectToApp(result: "success" | "error", detail?: string): Response {
  const url = new URL(`${APP_DEEP_LINK_SCHEME}://link-steam-result`);
  url.searchParams.set("result", result);
  if (detail) url.searchParams.set("detail", detail);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  if (!state) {
    return redirectToApp("error", "missing_state");
  }

  if (!STEAM_WEB_API_KEY) {
    return redirectToApp("error", "steam_not_configured");
  }

  // Re-verify the OpenID assertion server-to-server (never trust the redirect alone —
  // it's just a browser navigation, anyone could hit this URL with forged params).
  const verifyParams = new URLSearchParams(url.search);
  verifyParams.delete("state");
  verifyParams.set("openid.mode", "check_authentication");

  const verifyRes = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString(),
  });
  const verifyText = await verifyRes.text();
  if (!verifyText.includes("is_valid:true")) {
    return redirectToApp("error", "invalid_assertion");
  }

  const claimedId = url.searchParams.get("openid.claimed_id") ?? "";
  const match = CLAIMED_ID_PATTERN.exec(claimedId);
  if (!match) {
    return redirectToApp("error", "no_steam_id");
  }
  const steamId64 = match[1];

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: stateRow, error: stateError } = await serviceClient
    .from("steam_link_state")
    .select("profile_id")
    .eq("state", state)
    .maybeSingle();
  if (stateError || !stateRow) {
    return redirectToApp("error", "state_expired");
  }
  await serviceClient.from("steam_link_state").delete().eq("state", state);

  const summaryRes = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_WEB_API_KEY}&steamids=${steamId64}`,
  );
  const summaryJson = (await summaryRes.json().catch(() => null)) as {
    response?: { players?: { personaname?: string; avatarfull?: string }[] };
  } | null;
  const player = summaryJson?.response?.players?.[0];

  const { error: upsertError } = await serviceClient.from("linked_accounts").upsert(
    {
      profile_id: stateRow.profile_id as string,
      provider: "steam",
      external_id: steamId64,
      display_name: player?.personaname ?? `Steam user ${steamId64}`,
      avatar_url: player?.avatarfull ?? null,
      raw_data: player ?? null,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,provider" },
  );
  if (upsertError) {
    return redirectToApp("error", "save_failed");
  }

  return redirectToApp("success");
});
