// The duoqueue.io waitlist form endpoint.
//
// =============================================================================
// THIS IS THIS PROJECT'S FIRST UNAUTHENTICATED PUBLIC WRITE ENDPOINT. READ THIS.
// =============================================================================
//
// Every other `verify_jwt = false` function here is gated by a shared secret
// (require-secret-auth.ts) or by a signed third-party assertion (link-steam-callback).
// This one has neither and cannot: it is POSTed to by an ordinary <form> on a static
// page, by a member of the public who has no account and no token. Anyone on the
// internet can reach it, as many times as the rate limit below allows.
//
// What bounds the damage, in the order this handler evaluates it:
//
//   * a 4 KB body cap enforced while streaming, so a multi-MB body costs nothing
//   * one attempt row per REQUEST, written before any decision, so that rejected
//     attempts count toward the limit and garbage buys no free tries
//   * 10 requests per hour and 30 per 24 hours per salted IP hash
//   * a kill switch in app_config that closes the form with one UPDATE, no redeploy
//   * a honeypot field, and server-side validation of every field
//   * a four-value allow-list on the only string a stranger can influence
//   * a per-day budget on the outbound welcome email (see THE 80/DAY BUDGET below)
//
// and the fact that its only write is one insert into one table that has RLS on, zero
// policies, and zero grants to `anon` or `authenticated` (0061).
//
// =============================================================================
// EVERY OUTCOME IS A 303 REDIRECT, AND ONLY TWO DESTINATIONS ARE REACHABLE
// =============================================================================
//
// There is no JavaScript on duoqueue.io. The form is a top-level navigation, which means
// this function's response is a page the browser is about to render, not a payload some
// script will interpret. A JSON body would be shown to a human as raw text. So every path
// answers 303 with a Location, and the browser re-issues the follow-up as a GET, which
// also means the address never lands in a URL, a Referer header, a Pages access log or
// browser history.
//
// Accepted, duplicate, honeypot-tripped and rate-limited all land on /waitlist/thanks/.
// That is deliberate: a prober learns nothing about whether an address is already on the
// list, and no real person is ever told their signup failed when the row exists.
// /waitlist/try-again/ is reachable only for the two things a human can actually fix, a
// malformed address and an unchecked 18+ box.
//
// The single exception to "always redirect" is an oversized body, which answers 413
// without reading further. Nothing about that request is a browser doing a normal thing.
//
// =============================================================================
// THE 80/DAY BUDGET, WHICH IS NOT AN OPTIMISATION
// =============================================================================
//
// Resend is this project's custom SMTP provider for Supabase Auth (README step 7,
// docs/APP-STORE-SUBMISSION.md), and without it account signup fails outright with
// `over_email_send_rate_limit`. The free plan allows 3,000 emails a month "limited to 100
// emails per day", and that daily bucket is SHARED. So a busy waitlist day that spent all
// 100 on welcome emails would leave real users arriving from the App Store unable to
// receive the six-digit code they need to create an account at all.
//
// Hence 80, leaving 20/day of headroom for auth. Two rules follow from that and they are
// the two rules this file exists to keep:
//
//   NEVER LOSE A SIGNUP TO PROTECT THE QUOTA. Over budget still writes the row; only the
//   email is skipped, and the row is marked `deferred` so it can be picked up later.
//   NEVER SPEND THE QUOTA AUTH NEEDS. There is no "just this once" path past the count.
//
// The same rule catches a missing RESEND_SEND_API_KEY: the row is written and marked
// `deferred`, never `failed`, because an unset secret is a configuration gap that a later
// send fixes, not a bad address.
//
// Secrets (set with `npx supabase secrets set`, never committed):
//   RESEND_SEND_API_KEY  a SENDING-ONLY Resend key, separate from the SMTP password Auth
//                        uses, so rotating this one cannot break account confirmation
//   WAITLIST_IP_SALT     32 random bytes; without it no IP hash is computed and the rate
//                        limit is skipped rather than keyed on an unsalted hash
import { createClient } from "npm:@supabase/supabase-js@2";

import { isCleanText, readFormBody } from "../_shared/validation.ts";
import {
  FROM_ADDRESS,
  SITE_ORIGIN,
  WELCOME_BUDGET_PER_DAY,
  WELCOME_HEADERS,
  WELCOME_SUBJECT,
  WELCOME_TEXT,
  welcomeHtml,
} from "../_shared/welcome-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_SEND_API_KEY = Deno.env.get("RESEND_SEND_API_KEY");
const WAITLIST_IP_SALT = Deno.env.get("WAITLIST_IP_SALT");

const THANKS_URL = `${SITE_ORIGIN}/waitlist/thanks/`;
const TRY_AGAIN_URL = `${SITE_ORIGIN}/waitlist/try-again/`;
const FORM_URL = `${SITE_ORIGIN}/waitlist/`;

const MAX_BODY_BYTES = 4 * 1024;
const RATE_LIMIT_PER_HOUR = 10;
const RATE_LIMIT_PER_DAY = 30;
const RESEND_TIMEOUT_MS = 8000;


/** The only four values `source` may take. The site publishes /tt/, /ig/ and /yt/ as
 * separate short paths whose sole difference is this hidden input, which is how this
 * project gets per-channel attribution with no analytics SDK and no cookie. Anything
 * else becomes 'direct' rather than being rejected: a stranger editing the field should
 * not be able to make a real signup fail. */
const SOURCES = new Set(["direct", "tt", "ig", "yt"]);

/** Deliberately not a full RFC 5322 parser. This is the same shape the 0061 CHECK
 * constraint enforces, and its job is to reject what is obviously not an address before
 * it costs a row and a send. The real proof that an address exists is the welcome email
 * bouncing or not, ten days before the launch email goes out. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** 303 rather than 302: 303 tells the browser to follow with GET no matter what method
 * it used to get here, which is exactly the POST-redirect-GET the form needs, and it is
 * the one redirect status defined to mean that. no-store so a back button never replays
 * a submission out of cache. */
function seeOther(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** sha256(salt || first hop of X-Forwarded-For). The address itself is never stored and
 * never leaves this function. The salt lives only in the function's environment, so a
 * copy of waitlist_attempts on its own does not let anyone test a candidate IP against
 * it, which a bare hash of a 32-bit value very much would.
 *
 * First hop only: everything after it was appended by intermediaries and everything
 * before this gateway is caller-controlled. Length-capped because the header is not. */
async function hashIp(req: Request): Promise<string | null> {
  if (!WAITLIST_IP_SALT) return null;
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim().slice(0, 64) ?? "";
  if (!first) return null;
  const bytes = new TextEncoder().encode(`${WAITLIST_IP_SALT}:${first}`);
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}

/** True when this hash has spent its allowance.
 *
 * One round trip, not two. Reading the 31 most recent attempts inside the 24 hour window
 * is enough to decide BOTH limits: if more than 31 requests arrived in the last hour then
 * the 24 hour count is already over 30, so the hourly figure can never be under-counted
 * in a case where it would have mattered. The cap on rows read is what keeps this cheap
 * when someone is hammering the endpoint, which is precisely when it runs most.
 *
 * Fails OPEN. If the count query errors, a real person trying to join a waitlist is not
 * turned away because of a database hiccup; the honeypot, the validation and the send
 * budget all still apply. */
async function isRateLimited(ipHash: string): Promise<boolean> {
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const hourAgo = now - 60 * 60 * 1000;

  const { data, error } = await admin
    .from("waitlist_attempts")
    .select("created_at")
    .eq("ip_hash", ipHash)
    .gte("created_at", dayAgo)
    .order("created_at", { ascending: false })
    .limit(RATE_LIMIT_PER_DAY + 1);

  if (error || !data) {
    console.error("waitlist: rate-limit read failed, failing open", error?.message);
    return false;
  }
  if (data.length > RATE_LIMIT_PER_DAY) return true;
  const inLastHour = data.filter((row) => Date.parse(row.created_at as string) >= hourAgo).length;
  return inLastHour > RATE_LIMIT_PER_HOUR;
}

/** Normalise the way a mail server would before comparing two addresses: strip the
 * padding a mobile keyboard adds, NFC-normalise so a composed and a decomposed accented
 * domain are one address rather than two rows, then lowercase. The 0061 constraint
 * `email = lower(email)` is what stops any future writer skipping this. */
function normaliseEmail(raw: string): string {
  return raw.trim().normalize("NFC").toLowerCase();
}

function isValidEmail(value: string): boolean {
  if (value.length < 6 || value.length > 254) return false;
  if (!isCleanText(value, { maxLength: 254 })) return false;
  return EMAIL_PATTERN.test(value);
}

type WelcomeResult =
  | { status: "sent"; emailId: string | null }
  | { status: "deferred" }
  | { status: "failed" };

/** One transactional send. Never throws: the caller has already stored the row, and a
 * failed welcome email is recoverable while a 500 out of this handler would show a real
 * person a browser error page after they successfully joined the list.
 *
 * List-Unsubscribe is set even though this is the transactional API, so a mailbox
 * provider that offers a one-click unsubscribe has something to point at from the very
 * first message. Open and click tracking stay off everywhere: a rewritten link on a first
 * contact reads as phishing, and this project runs no analytics anywhere else either. */
async function sendWelcome(email: string): Promise<WelcomeResult> {
  if (!RESEND_SEND_API_KEY) {
    console.error("waitlist: RESEND_SEND_API_KEY is not set, deferring welcome email");
    return { status: "deferred" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_SEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject: WELCOME_SUBJECT,
        html: welcomeHtml(),
        text: WELCOME_TEXT,
        headers: WELCOME_HEADERS,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("waitlist: resend rejected the send", res.status, await res.text());
      return { status: "failed" };
    }
    const body = (await res.json()) as { id?: string };
    return { status: "sent", emailId: body.id ?? null };
  } catch (err) {
    console.error("waitlist: resend request failed", err instanceof Error ? err.message : err);
    return { status: "failed" };
  }
}

Deno.serve(async (req) => {
  // A crawler, or somebody pasting the endpoint into a browser bar, should land on the
  // page rather than read a 405 body. Everything about this endpoint is public anyway.
  if (req.method !== "POST") {
    return seeOther(FORM_URL);
  }

  const read = await readFormBody(req, MAX_BODY_BYTES);
  if (!read.ok) {
    if (read.reason === "too_large") {
      return new Response("Request body too large", { status: 413 });
    }
    // An empty or unreadable body is not something the real form can produce, but it is
    // also not worth a distinct outcome. Send it where a human with a broken submission
    // can act, which is the only page that tells them what to fix.
    return seeOther(TRY_AGAIN_URL);
  }
  const form = read.form;

  // Attempt accounting happens BEFORE any decision, so that a script sending garbage
  // spends its allowance at the same rate as one sending plausible submissions.
  const ipHash = await hashIp(req);
  if (ipHash) {
    const { error } = await admin.from("waitlist_attempts").insert({ ip_hash: ipHash });
    if (error) console.error("waitlist: attempt insert failed", error.message);

    // Bounded, indexed prune of this hash's own expired rows. The hourly cron job in 0061
    // is the backstop for hashes that stop appearing; this keeps the common case tidy
    // without a table scan.
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await admin.from("waitlist_attempts").delete().eq("ip_hash", ipHash).lt("created_at", cutoff);

    if (await isRateLimited(ipHash)) {
      console.warn("waitlist: rate limited");
      return seeOther(THANKS_URL);
    }
  } else {
    // No salt configured, or no forwarded address to key on. Say so loudly rather than
    // silently running an endpoint with one of its four protections switched off.
    console.warn("waitlist: no IP hash available, rate limit skipped");
  }

  // Kill switch. Anything other than the exact string 'true' closes the form, so a typo
  // fails closed. Closed sends people to the home page, which still explains the app.
  const { data: config } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "waitlist_open")
    .maybeSingle();
  if (config?.value !== "true") {
    return seeOther(`${SITE_ORIGIN}/`);
  }

  // Honeypot. A field named `company`, positioned off-screen with tabindex=-1,
  // autocomplete=off and aria-hidden=true, so neither a sighted person, a keyboard user
  // nor a screen reader ever reaches it. Anything in it is a form filler. Answering with
  // the ordinary success page means the bot learns nothing and does not come back with
  // the field cleared.
  if ((form.get("company") ?? "").trim() !== "") {
    console.warn("waitlist: honeypot tripped");
    return seeOther(THANKS_URL);
  }

  // The 18+ box is a SELF-DECLARATION for mailing list hygiene. It is not age assurance,
  // it is not verification, and it must never be described as either: answering yes to
  // Apple's Age Assurance question on the strength of a self-reported field is what got
  // the 1.0 submission rejected under Guideline 2.3.6 (docs/APP-STORE-SUBMISSION.md).
  // Unchecked is one of exactly two outcomes a human can fix, so it goes to try-again.
  if (form.get("adult") !== "yes") {
    return seeOther(TRY_AGAIN_URL);
  }

  const email = normaliseEmail(form.get("email") ?? "");
  if (!isValidEmail(email)) {
    return seeOther(TRY_AGAIN_URL);
  }

  const requestedSource = (form.get("source") ?? "").trim();
  const source = SOURCES.has(requestedSource) ? requestedSource : "direct";

  // `ignoreDuplicates` is PostgREST's `on conflict do nothing`, so a second submission of
  // the same address inserts nothing and returns nothing. Both halves matter: no second
  // welcome email, and no observable difference between "added" and "already there", so
  // the endpoint cannot be used to test whether an address is on the list.
  const { data: inserted, error: insertError } = await admin
    .from("waitlist_signups")
    .upsert({ email, source }, { onConflict: "email", ignoreDuplicates: true })
    .select("id");

  if (insertError) {
    // 23505 is the unique violation. Reaching it means the conflict resolution above did
    // not apply for some reason; treat it as the duplicate it is rather than as an error.
    if (insertError.code === "23505") return seeOther(THANKS_URL);
    console.error("waitlist: insert failed", insertError.code, insertError.message);
    return seeOther(TRY_AGAIN_URL);
  }

  const row = inserted?.[0];
  if (!row) {
    // Already on the list. Silent success.
    return seeOther(THANKS_URL);
  }

  // THE BUDGET. Read the header of this file before changing this number.
  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: sentToday, error: budgetError } = await admin
    .from("waitlist_signups")
    .select("id", { count: "exact", head: true })
    .eq("welcome_status", "sent")
    .gte("welcome_sent_at", sinceDay);

  if (budgetError) {
    // Fails CLOSED, the opposite of the rate limit, and for the opposite reason: being
    // unable to count sends is not a reason to spend a quota that account confirmation
    // depends on. The row is already written, so nothing is lost by deferring.
    console.error("waitlist: budget read failed, deferring", budgetError.message);
    await admin.from("waitlist_signups").update({ welcome_status: "deferred" }).eq("id", row.id);
    return seeOther(THANKS_URL);
  }

  if ((sentToday ?? 0) >= WELCOME_BUDGET_PER_DAY) {
    console.warn(`waitlist: welcome budget spent (${String(sentToday)}), deferring`);
    await admin.from("waitlist_signups").update({ welcome_status: "deferred" }).eq("id", row.id);
    return seeOther(THANKS_URL);
  }

  const result = await sendWelcome(email);
  if (result.status === "sent") {
    await admin
      .from("waitlist_signups")
      .update({
        welcome_status: "sent",
        welcome_email_id: result.emailId,
        welcome_sent_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  } else {
    await admin.from("waitlist_signups").update({ welcome_status: result.status }).eq("id", row.id);
  }

  return seeOther(THANKS_URL);
});
