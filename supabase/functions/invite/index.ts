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
// WHAT IT DOES: validates the code, then sends the browser to the App Store if DuoQueue is
// released and to the duoqueue.io waitlist if it is not. The destination lives in
// app_config, so launch day is one UPDATE and every invite already sent starts pointing at
// the App Store without an app update, a redeploy, or a site rebuild.
//
// WHY IT LOOKS UP THE CODE AT ALL WHEN THE DESTINATION DOES NOT DEPEND ON IT. Two reasons,
// both small and both real. It is the only place a revoked or malformed code can be
// distinguished from a live one, which is what the 302-vs-404 below is; and resolving here
// keeps this endpoint honest about being an invite endpoint rather than a general-purpose
// open redirect with a decorative path segment.
//
// verify_jwt = false, declared in supabase/config.toml rather than left to a
// --no-verify-jwt flag in somebody's shell history: this is reached by a browser following
// a link out of a Discord message, which carries no Supabase JWT and never can. There is no
// shared secret gate either, for the same reason waitlist-signup has none. What bounds it:
// GET/HEAD only, no request body is read at all, and the only thing a caller can influence
// is a ten-character string checked against a fixed alphabet before it reaches the
// database, where it becomes one indexed equality probe.
import { createClient } from "npm:@supabase/supabase-js@2";

import { inviteRedirectTarget, parseInviteCodeFromUrl } from "../_shared/invite-link.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * `app_config.app_store_url`, empty until DuoQueue is released.
 *
 * Read per request rather than cached in module scope on purpose: the flip is one UPDATE
 * (0065's section 7), and a cached value would mean it does nothing until the isolate
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
    // and before launch it is also the correct one.
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

  const target = inviteRedirectTarget(appStoreUrl);

  return new Response(null, {
    // 302 and not 301 for the live case: the destination genuinely changes on launch day,
    // and a permanently-cached redirect to the waitlist would outlive the release in every
    // browser that had ever followed one.
    //
    // 404 for a code that does not resolve, with the same Location. A browser follows it
    // exactly the same way, so the person still gets the app; the status is there so that
    // "is this invite still live" is answerable with curl and shows up in the function logs
    // without anybody having to add a counter.
    status: resolves ? 302 : 404,
    headers: {
      Location: target,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
});
