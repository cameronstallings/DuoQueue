// The invite link: where somebody lands when they tap a DuoQueue invite.
//
//   https://<project-ref>.supabase.co/functions/v1/invite/ABCDE12345
//   https://<project-ref>.supabase.co/functions/v1/invite?c=ABCDE12345
//
// It is a 302, not a page, and `_shared/invite-link.ts` carries the measured reason why
// (the gateway rewrites any text/html response from this origin to text/plain and sandboxes
// it) along with why duoqueue.io could not host the page either. Read that header before
// changing the shape of this.
//
// WHAT IT DOES: sends the browser to app_config.app_store_url, read on every request. Since
// 0082 that is the App Store campaign link with ct=invite, so a tapped invite goes straight
// to the store and the install is credited to invites. If the row is ever emptied, the
// fallback is the duoqueue.io waitlist site. Changing the destination is one UPDATE: no app
// update, no redeploy, no site rebuild.
//
// EVERY LINK EVER SENT KEEPS WORKING: both shapes above, a live code, a revoked or mistyped
// one, and no code at all all get the same 302. Until 15 Oct 2026 a dead code got a 404 with a
// Location header, and a browser does not follow Location on a 404, so an old invite opened a
// blank page (inviteResponse in _shared/invite-link.ts has the detail).
//
// WHY IT LOOKS UP THE CODE AT ALL WHEN THE DESTINATION DOES NOT DEPEND ON IT. Two reasons,
// both small and both real. It is the only place a revoked or malformed code can be
// distinguished from a live one, which is what the X-Invite-Code header below reports
// ("live" or "unknown"; check it with curl -sI); and resolving here keeps this endpoint honest
// about being an invite endpoint rather than a general-purpose open redirect with a
// decorative path segment.
//
// verify_jwt = false, declared in supabase/config.toml rather than left to a
// --no-verify-jwt flag in somebody's shell history: this is reached by a browser following
// a link out of a Discord message, which carries no Supabase JWT and never can. There is no
// shared secret gate either, for the same reason waitlist-signup has none. What bounds it:
// GET/HEAD only, no request body is read at all, and the only thing a caller can influence
// is a ten-character string checked against a fixed alphabet before it reaches the
// database, where it becomes one indexed equality probe.
import { createClient } from "npm:@supabase/supabase-js@2";

import { inviteResponse, parseInviteCodeFromUrl } from "../_shared/invite-link.ts";
import { supabaseSecretKey } from "../_shared/supabase-keys.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY = supabaseSecretKey();

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

/**
 * `app_config.app_store_url` (0082), or "" when the row is empty or unreadable.
 *
 * Read per request rather than cached in module scope on purpose: changing it is one UPDATE
 * (0065's section 7, 0082), and a cached value would mean it does nothing until the isolate
 * happens to recycle.
 */
async function readAppStoreUrl(): Promise<string> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "app_store_url")
    .maybeSingle();
  if (error) {
    // Falling through to the waitlist is the safe direction: it is a real page either way,
    // and it links to the App Store.
    console.error("app_store_url read failed", error.message);
    return "";
  }
  return (data?.value as string | undefined) ?? "";
}

async function codeResolves(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("resolve_invite_code", { p_code: code });
  if (error) {
    console.error("resolve_invite_code failed", error.message);
    return false;
  }
  return ((data ?? []) as unknown[]).length > 0;
}

Deno.serve(async (req) => {
  // HEAD is answered like GET, because chat clients send it to build link previews and a
  // 405 makes a shared invite render as a broken link in the app it was pasted into.
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const code = parseInviteCodeFromUrl(req.url);
  const [appStoreUrl, resolves] = await Promise.all([
    readAppStoreUrl(),
    code ? codeResolves(code) : Promise.resolve(false),
  ]);

  // 302 and not 301: the destination lives in app_config and can change, and a permanently
  // cached redirect would outlive that change in every browser that had ever followed one.
  const { status, headers } = inviteResponse(appStoreUrl, resolves ? "live" : "unknown");
  return new Response(null, { status, headers });
});
