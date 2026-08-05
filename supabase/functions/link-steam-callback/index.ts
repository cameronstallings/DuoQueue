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
const STEAM_OP_ENDPOINT = "https://steamcommunity.com/openid/login";

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

  // Pin the OpenID provider. claimed_id is checked below, but without this the
  // signature could have been produced by any endpoint the request names.
  if (url.searchParams.get("openid.op_endpoint") !== STEAM_OP_ENDPOINT) {
    return redirectToApp("error", "bad_op_endpoint");
  }

  // Steam signs the fields listed in openid.signed. Reading claimed_id out of the raw
  // query string without confirming it was signed would mean trusting a value the
  // caller controls.
  const signedFields = (url.searchParams.get("openid.signed") ?? "").split(",");
  if (!signedFields.includes("claimed_id") || !signedFields.includes("return_to")) {
    return redirectToApp("error", "unsigned_claim");
  }

  // Bind the assertion to THIS request, and to this state token.
  //
  // check_authentication proves Steam signed the assertion; it does not prove the
  // assertion was issued for the request now delivering it. state and the signed
  // params arrive as independent inputs, so without this an attacker could complete
  // their own Steam login, keep the signed params, and replay them against
  // ...?state=<a victim's state> — linking their Steam account to the victim's
  // profile. return_to IS signed, so comparing it to the live URL (and to state)
  // closes that gap.
  const returnToRaw = url.searchParams.get("openid.return_to");
  if (!returnToRaw) {
    return redirectToApp("error", "missing_return_to");
  }
  let returnTo: URL;
  try {
    returnTo = new URL(returnToRaw);
  } catch {
    return redirectToApp("error", "bad_return_to");
  }
  if (returnTo.origin !== url.origin || returnTo.pathname !== url.pathname) {
    return redirectToApp("error", "bad_return_to");
  }
  if (returnTo.searchParams.get("state") !== state) {
    return redirectToApp("error", "state_mismatch");
  }

  // Re-verify the OpenID assertion server-to-server (never trust the redirect alone —
  // it's just a browser navigation, anyone could hit this URL with forged params).
  const verifyParams = new URLSearchParams(url.search);
  verifyParams.delete("state");
  verifyParams.set("openid.mode", "check_authentication");

  const verifyRes = await fetch(STEAM_OP_ENDPOINT, {
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

  // Single statement that enforces the 15-minute TTL and consumes the token in one
  // shot (delete ... returning). The previous select-then-delete both let an abandoned
  // token stay valid forever — despite 0025 calling them "short-lived, single-use" —
  // and left a window where two concurrent callbacks could each pass the check.
  const { data: profileId, error: stateError } = await serviceClient.rpc("consume_steam_link_state", {
    p_state: state,
  });
  if (stateError || !profileId) {
    return redirectToApp("error", "state_expired");
  }

  const summaryRes = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_WEB_API_KEY}&steamids=${steamId64}`,
  );
  const summaryJson = (await summaryRes.json().catch(() => null)) as {
    response?: { players?: { personaname?: string; avatarfull?: string }[] };
  } | null;
  const player = summaryJson?.response?.players?.[0];

  const { error: upsertError } = await serviceClient.from("linked_accounts").upsert(
    {
      profile_id: profileId as string,
      provider: "steam",
      external_id: steamId64,
      display_name: player?.personaname ?? `Steam user ${steamId64}`,
      avatar_url: player?.avatarfull ?? null,
      // GetPlayerSummaries can return realname, loccountrycode/locstatecode, timecreated,
      // profileurl, personastate, and more depending on the Steam user's privacy
      // settings — none of which the app reads or discloses anywhere. Collect only what
      // we actually use and disclose (the fields already mirrored into the columns
      // above) instead of holding the rest of that payload indefinitely.
      raw_data: player
        ? { steamid: steamId64, personaname: player.personaname ?? null, avatarfull: player.avatarfull ?? null }
        : null,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,provider" },
  );
  if (upsertError) {
    return redirectToApp("error", "save_failed");
  }

  return redirectToApp("success");
});
