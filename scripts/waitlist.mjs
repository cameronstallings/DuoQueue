#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/waitlist.mjs — read the waitlist, and mail the rows the endpoint could
// not.
//
// WHY THIS EXISTS, AND WHY IT EXISTS NOW RATHER THAN AT LAUNCH
//
// `supabase/functions/waitlist-signup` writes the signup row first and sends the
// welcome email second, on purpose: a signup is never lost to protect an email
// quota. That means there are two ordinary, expected paths where a real person
// joins the list and gets no welcome:
//
//   1. The 80/day welcome budget is spent. The row is stored `deferred`.
//   2. RESEND_SEND_API_KEY is not set on the function. The row is stored
//      `deferred` — deliberately `deferred` and not `failed`, because an unset
//      secret is a configuration gap somebody can close later, not a bad address.
//
// As of this writing (2) is the live state: `supabase secrets list` returns 15
// secrets and RESEND_SEND_API_KEY is not one of them. So every signup today is
// stored and none is mailed. That is the correct failure mode only if something
// can later mail them — otherwise the address is never proved, the opt-out is
// never offered, and the launch blast becomes a cold first contact to an
// unverified list, which is exactly the deliverability problem the welcome email
// was designed to prevent.
//
// This script is that something. Until the key is set it prints what it WOULD do
// and sends nothing.
//
// WHAT IT WILL NOT DO
//
//   * It will not exceed the same 80/day budget the endpoint enforces, and it
//     counts against the same rolling 24-hour window from the same table. The
//     20/day of headroom exists for Supabase Auth's account-confirmation email,
//     which shares Resend's 100/day ceiling because Resend is Auth's custom SMTP
//     provider. Spending it would break account signup, which is worse than a
//     late welcome.
//   * It will not send anything without `--send`. The default is a dry run.
//   * It will not touch a row whose status is not `deferred` or `failed`. A
//     `sent` row is never re-sent.
//   * It holds no key of its own. Everything comes from the gitignored root
//     `.env`, the same way scripts/seed-review-demo.mjs does.
//
// USAGE (from the repo root)
//
//   node scripts/waitlist.mjs stats
//   node scripts/waitlist.mjs send-deferred                # dry run, sends nothing
//   node scripts/waitlist.mjs send-deferred --send
//   node scripts/waitlist.mjs send-deferred --send --limit 20
//
// ENV (root .env, never committed)
//
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   required for both commands
//   RESEND_SEND_API_KEY                       required only for --send
//
// The Resend key here is the SENDING key — the same value that belongs in the
// function secret. It is read from the local .env only so a human can run this by
// hand; nothing in this file is ever deployed or served.
// ---------------------------------------------------------------------------

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// The welcome email is imported from the Edge Function's own shared module so the
// two senders cannot drift. Node strips its TypeScript types on the way in.
//
// It is a dynamic import behind a warning filter for one reason: the root
// package.json has no `"type": "module"`, so Node prints a MODULE_TYPELESS_
// PACKAGE_JSON warning every time it type-strips a .ts file from this repo. The
// fix Node suggests is editing the root package.json, which this script is not
// allowed to do — that file is shared with the app and the Remotion pipeline.
// Adding a package.json beside the shared module instead would put a Node module
// marker inside a directory Deno owns. So the warning is filtered here, where the
// blast radius is one script, and every other warning still prints.
process.removeAllListeners("warning");
process.on("warning", (w) => {
  // Node puts the identifier on `code`, not on `name` (which is just "Warning")
  // and not in the message text, so this is the only field worth matching on.
  if (w.code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  console.warn(w.stack ?? `${w.name}: ${w.message}`);
});

const {
  FROM_ADDRESS,
  WELCOME_BUDGET_PER_DAY,
  WELCOME_HEADERS,
  WELCOME_SUBJECT,
  WELCOME_TEXT,
  welcomeHtml,
} = await import("../supabase/functions/_shared/welcome-email.ts");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_SEND_API_KEY = process.env.RESEND_SEND_API_KEY;

const RESEND_TIMEOUT_MS = 8000;
/** Resend's own guidance is 2 requests/second on the transactional API. 600ms is
 * comfortably under it and this is never a hot path — the whole point is that it
 * runs at most a few dozen times a day. */
const SEND_INTERVAL_MS = 600;

function die(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  die(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.\n" +
      "Copy .env.example to .env, fill in the service role key, and re-run.\n" +
      "Never commit that key."
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dayAgo = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

/** The endpoint's budget read, verbatim in intent: how many welcomes actually went
 * out in the last rolling 24 hours. Both senders count the same rows the same way,
 * so running this script cannot push the day's total past the cap the endpoint
 * believes it is enforcing. */
async function sentInLast24h() {
  const { count, error } = await admin
    .from("waitlist_signups")
    .select("id", { count: "exact", head: true })
    .eq("welcome_status", "sent")
    .gt("welcome_sent_at", dayAgo());
  if (error) die(`Could not read the welcome budget: ${error.message}`);
  return count ?? 0;
}

async function cmdStats() {
  const { data, error } = await admin
    .from("waitlist_signups")
    .select("email, source, welcome_status, created_at, welcome_sent_at, unsubscribed_at");
  if (error) die(`Could not read waitlist_signups: ${error.message}`);

  const byStatus = {};
  const bySource = {};
  for (const r of data) {
    byStatus[r.welcome_status] = (byStatus[r.welcome_status] ?? 0) + 1;
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  }
  const unsubscribed = data.filter((r) => r.unsubscribed_at).length;
  const sent24 = await sentInLast24h();

  console.log(`\nwaitlist_signups: ${data.length} row${data.length === 1 ? "" : "s"}`);
  console.log("\n  by welcome_status");
  for (const k of Object.keys(byStatus).sort()) {
    console.log(`    ${String(byStatus[k]).padStart(5)}  ${k}`);
  }
  console.log("\n  by source (which link they arrived from)");
  for (const k of Object.keys(bySource).sort()) {
    console.log(`    ${String(bySource[k]).padStart(5)}  ${k}`);
  }
  console.log(`\n  unsubscribed: ${unsubscribed}`);
  console.log(
    `  welcome emails sent in the last 24h: ${sent24} of ${WELCOME_BUDGET_PER_DAY} ` +
      `(${Math.max(0, WELCOME_BUDGET_PER_DAY - sent24)} left today)`
  );

  const pending = (byStatus.deferred ?? 0) + (byStatus.failed ?? 0);
  if (pending > 0) {
    console.log(
      `\n  ${pending} row${pending === 1 ? " has" : "s have"} no welcome email yet. ` +
        `Run:  node scripts/waitlist.mjs send-deferred`
    );
  }
  console.log();
}

async function sendOne(email) {
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
  if (!res.ok) return { ok: false, detail: `${res.status} ${await res.text()}` };
  const body = await res.json();
  return { ok: true, id: body?.id ?? null };
}

async function cmdSendDeferred(argv) {
  const send = argv.includes("--send");
  const limitFlag = argv.indexOf("--limit");
  const limit = limitFlag >= 0 ? Number(argv[limitFlag + 1]) : Infinity;
  if (Number.isNaN(limit) || limit <= 0) die("--limit needs a positive number.");

  const { data: rows, error } = await admin
    .from("waitlist_signups")
    .select("id, email, source, welcome_status, created_at")
    .in("welcome_status", ["deferred", "failed"])
    .is("unsubscribed_at", null)
    .order("created_at", { ascending: true });
  if (error) die(`Could not read waitlist_signups: ${error.message}`);

  if (rows.length === 0) {
    console.log("\nNothing to do: no deferred or failed rows.\n");
    return;
  }

  const sent24 = await sentInLast24h();
  const budgetLeft = Math.max(0, WELCOME_BUDGET_PER_DAY - sent24);
  const take = Math.min(rows.length, budgetLeft, limit);

  console.log(`\n${rows.length} row${rows.length === 1 ? "" : "s"} awaiting a welcome email.`);
  console.log(
    `Budget: ${sent24} of ${WELCOME_BUDGET_PER_DAY} spent in the last 24h, ${budgetLeft} left.` +
      `  (The other 20/day is reserved for Supabase Auth's confirmation email.)`
  );
  if (limit !== Infinity) console.log(`--limit ${limit} applied.`);
  console.log(`Will send: ${take}${take < rows.length ? `  (${rows.length - take} wait for tomorrow)` : ""}\n`);

  if (take === 0) {
    console.log("Budget is spent for today. Re-run after the rolling 24h window moves.\n");
    return;
  }

  if (!send) {
    for (const r of rows.slice(0, take)) {
      console.log(`  would send -> ${r.email}   [${r.welcome_status}, source ${r.source}]`);
    }
    console.log(`\nDRY RUN. Nothing was sent. Re-run with --send to actually send.\n`);
    return;
  }

  if (!RESEND_SEND_API_KEY) {
    die(
      "RESEND_SEND_API_KEY is not set locally, so --send has nothing to send with.\n" +
        "Put the SENDING key in the root .env (it is gitignored), then re-run.\n" +
        "That is the same value that belongs in the function secret:\n" +
        "  npx supabase secrets set RESEND_SEND_API_KEY=re_..."
    );
  }

  let ok = 0;
  let bad = 0;
  for (const r of rows.slice(0, take)) {
    const result = await sendOne(r.email);
    if (result.ok) {
      const { error: upErr } = await admin
        .from("waitlist_signups")
        .update({
          welcome_status: "sent",
          welcome_sent_at: new Date().toISOString(),
          welcome_email_id: result.id,
        })
        .eq("id", r.id);
      if (upErr) {
        // The mail is out. Say so loudly rather than silently leaving a row that a
        // later run would mail a second time.
        console.error(
          `  SENT BUT NOT RECORDED -> ${r.email}  (${upErr.message})\n` +
            `    Set welcome_status='sent' on id ${r.id} by hand before re-running.`
        );
        bad++;
      } else {
        console.log(`  sent -> ${r.email}`);
        ok++;
      }
    } else {
      await admin.from("waitlist_signups").update({ welcome_status: "failed" }).eq("id", r.id);
      console.error(`  FAILED -> ${r.email}  ${result.detail}`);
      bad++;
    }
    await sleep(SEND_INTERVAL_MS);
  }
  console.log(`\nsent ${ok}, failed ${bad}.\n`);
}

const [, , cmd, ...rest] = process.argv;
switch (cmd) {
  case "stats":
    await cmdStats();
    break;
  case "send-deferred":
    await cmdSendDeferred(rest);
    break;
  default:
    console.log(
      "\nUsage:\n" +
        "  node scripts/waitlist.mjs stats\n" +
        "  node scripts/waitlist.mjs send-deferred [--send] [--limit N]\n\n" +
        "`send-deferred` mails the signups the endpoint stored but could not send —\n" +
        "budget-deferred rows, and every row taken while RESEND_SEND_API_KEY was unset.\n" +
        "It is a dry run unless you pass --send, and it never exceeds the same 80/day\n" +
        "cap the endpoint enforces.\n\n" +
        "The launch-blast commands (sync / broadcast / check) are Phase C and are not\n" +
        "in this file yet — see docs/superpowers/plans/2026-08-18-waitlist-and-launch.md.\n"
    );
    process.exit(cmd ? 1 : 0);
}
