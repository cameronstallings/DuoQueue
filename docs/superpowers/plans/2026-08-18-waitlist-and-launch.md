# Waitlist and launch sequence

Implementation plan for section 4 of `docs/superpowers/specs/2026-08-18-launch-marketing-design.md`.
Workstream 4 of 4. Written 2026-08-18 against the live tree at `claude/duoqueue-gaming-app-fhga1z`.

The job: a waitlist page on duoqueue.io that collects emails for one to two weeks, then a way to
email everyone within a day or two of release so signups concentrate in time. Concentration is the
whole point, so every decision below is graded on "does this get more of the right people arriving
in the same 48 hours", and second on "does this cost Cameron time he does not have".

---

## 0. What the spec gets wrong, and what it left open

Read this section before anything else. Three of these change what gets built.

### 0.1 BLOCKING: Resend's free plan caps sending at 100 emails per day, and that quota is shared with the auth confirmation email

This is the single most important finding in this workstream, and the spec does not know about it.

Resend's pricing page (fetched 2026-08-18) states the free plan is 3,000 transactional emails per
month, "limited to 100 emails per day", 1 domain. `docs/APP-STORE-SUBMISSION.md:26` confirms Resend
is wired as the hosted Supabase project's custom SMTP provider, and `README.md:163-165` documents
why custom SMTP is mandatory: without it, signups fail with `over_email_send_rate_limit`.

So the signup confirmation code that every new user must receive to create an account, and any
launch blast, come out of the same 100/day bucket. A 300 person blast on launch day would:

1. Fail for roughly two thirds of the list, silently, as 429s.
2. Consume the day's entire quota, so real users arriving from the App Store cannot receive their
   6 digit confirmation code and therefore **cannot create an account at all**, on the one day the
   whole plan is engineered to produce arrivals.

That is a total launch failure with a $0 line item as its cause. Two mitigations, both in the plan:

- **Route the launch blast through Resend Broadcasts (the Marketing Email product), not the
  transactional API.** The pricing page meters marketing separately, by contacts (1,000 contacts
  per month on free), not by the transactional per day cap. If that separation holds, the blast
  never touches the quota auth depends on. This must be confirmed on the Usage page in the
  dashboard before release day (step C2), not assumed.
- **Cap welcome email sends at 80 per day inside the signup endpoint**, leaving 20/day of headroom
  for auth. Signups above the cap are still stored, flagged `deferred`, and simply do not get a
  welcome email. Never lose a signup to protect a quota; never spend the quota auth needs.

If the marketing/transactional separation turns out not to hold, the fallback is one month of
Resend Pro at $20 (50,000 emails, no daily cap, 10 domains), bought the day before release and
cancelled after. Which leads to:

### 0.2 The spec's "no paid tooling" constraint conflicts with itself here

Spec line 20-22 states "No paid tooling", justified entirely by social schedulers. Applied
literally to email, it means either the launch blast cannot be sent, or it must be dripped over
three or more days at under 70/day, which destroys the concentration that spec lines 176-179 call
"the entire point". The constraint and the goal cannot both hold.

**Decision: the no-paid-tooling constraint is scoped to social schedulers, as written, and a
one month $20 Resend Pro subscription is pre-authorised as launch insurance if step C2 shows the
free plan cannot carry the blast.** It is the cheapest possible protection for the app's own signup
path. Flagging it here rather than silently spending Cameron's money.

### 0.3 The privacy policy does not cover the website at all

`docs/legal/privacy-policy.md` is scoped end to end to the app. Section 2 itemises what the *app*
collects; there is no "website visitors" category, no mention of a mailing list, and the Resend row
in the section 3 processor table says "Sends transactional email (signup confirmation, account
emails)". Collecting an email address on duoqueue.io and later sending a marketing message to it is
a new processing activity that the published policy does not describe. Since App Review reads this
page, and since the page is the app's own linked Privacy Policy URL, it has to be updated in the
same change as the form. Step A6 does it.

Note what does **not** change: the App Store privacy nutrition label. Apple's questionnaire covers
data collected by the app and its third party SDKs. A website form is not the app. No label edit,
no new ASC submission needed for this.

### 0.4 The auth confirmation email is still Aurora purple

`supabase/templates/confirmation.html` uses `#7C4DFF` and 20px border radii. That is the pre-Volt
Aurora palette, deleted from the app in the 2026-08-03 restyle. A waitlist person will click the
App Store link, install, sign up, and receive an email that looks like a different company's,
inside the same five minutes. It is a 20 minute fix and it lands at exactly the moment first
impressions are worth the most. Included as optional step C8, with the caveat that the hosted
project's template is pasted by hand in the Dashboard (README step 7), so the file and the
Dashboard must change together.

### 0.5 Open questions in the spec, now decided

| Spec open question | Decision | Why |
|---|---|---|
| Waitlist runs 1 or 2 weeks | Minimum 7 days, maximum 14. End it when the 3 day trailing average of daily signups falls under 40% of the peak day, or at day 14, whichever comes first. | 7 days gives the content pipeline time to compound before judging the rate; a hard 14 day stop respects "a waitlist that outlives its momentum is worse than none"; the trailing average rule makes the decision a query, not a mood. |
| Which genre/vibe wedge leads the copy | Not decided here. The waitlist copy in appendix A deliberately leads with the *reframe* ("not a dating app, it is for finding people to actually play with"), which is workstream 2's strongest hook and is genre neutral. | Picking a genre wedge is a content decision that belongs with the video pipeline, and the landing page has to work for traffic from all three formats. |
| Exact daily reminder time | Workstream 3's problem, not this one. | |
| Release day and blast timing | Release Wednesday morning ET. Blast Thursday 6:30 PM ET. | Release day is for verifying the listing and fixing anything broken. The blast goes out the next evening at peak US gaming attention (3:30 PM PT), and the weekend immediately follows, so the workstream 1b "new signup reactivates matching users" loop gets two high traffic days to compound. |

### 0.6 Cross-workstream collisions the executor must handle

- **Migration number.** The live DB is at 0060 and so is the tree. This plan claims `0061`. If
  workstream 1b lands a notification-type migration first, renumber this file to the next free slot
  *before applying it*. Renaming an unapplied migration is safe; editing an applied one is not.
- **Measurement queries must exclude demo rows.** `scripts/seed-review-demo.mjs` creates 15 auth
  users flagged `is_demo = true`. Any "signups per day" query in workstream 3 that does not filter
  `is_demo = false` will show 15 phantom signups on the seed date and will keep counting them until
  the seed is removed (step D2).
- **The site's launched-phase CTA needs the App Store URL**, which needs the Apple ID from App
  Store Connect. That ID exists before release, so it can be filled in during phase A.

---

## 1. Decisions, with the reasoning

### 1.1 Emails are stored in Supabase, in a new `public.waitlist_signups` table with RLS on and zero policies

Supabase is already there, already has a service role, already has the operational tooling
(`scripts/db/run-sql.ps1`, `apply-migration.ps1`), and is already disclosed as a processor in the
privacy policy. Adding a second vendor to hold 300 email addresses would be worse on every axis.

The table lives in schema `public` and is protected by three independent things:

```sql
alter table public.waitlist_signups enable row level security;   -- and NO policies, ever
revoke all on public.waitlist_signups from public, anon, authenticated;
```

Both lines are required, and the second one is not redundant. Migration `0052` ran
`alter default privileges in schema public revoke insert, update, delete, truncate, references,
trigger on tables from anon, authenticated`, which deliberately left **SELECT** in the defaults. So
a table created by a later migration is born with SELECT granted to `anon` and `authenticated`.
RLS with no policies still returns zero rows, but the grant means PostgREST advertises the table in
its OpenAPI schema and answers `[]` rather than 404, and it means one accidental
`disable row level security` would expose every address collected off the open internet.
`0047_admin_audit_log.sql:102` set the precedent for sensitive tables with
`revoke all on public.admin_audit_log from public, anon, authenticated`. Follow it exactly.
Naming all three roles matters: revoking from PUBLIC does not remove a role's own explicit grant.

**Alternative considered and rejected: a non-exposed schema** (e.g. `waitlist.signups`), which
PostgREST could not reach at any grant level. Rejected for consistency: every table in this project
is in `public`, `docs/security/secrets-inventory.md` and every audit doc assume that, and
`scripts/db/*.ps1` are written against it. The protection from `revoke all` + RLS + no policies is
equivalent in effect and reviewable by the conventions already in the repo.

**Alternative considered and rejected: let the static page POST straight to PostgREST with the anon
key and an INSERT policy.** The anon key is public by design (`docs/security/secrets-inventory.md`
says so explicitly and it already ships in the app binary), so exposure is not the objection. The
objections are that an `insert with check (true)` policy for `anon` is an unauthenticated write
endpoint with no server side validation, no normalisation, no honeypot, no rate limit and no
ability to send the welcome email, and that PostgREST would return the inserted row, which leaks
information back to a prober. An Edge Function buys all of that for about 150 lines.

No `SECURITY DEFINER` function is created by this workstream. The service role bypasses RLS, so
the Edge Function does plain reads and writes and the entire class of grant hazards that
`0031`/`0041`/`0057` had to clean up never arises. That is a deliberate design goal, not an
accident.

### 1.2 The form is a plain HTML POST with a 303 redirect back to the site. No JavaScript, no CORS, no fetch

`scripts/build-site.mjs` produces fully self contained HTML with an inline `<style>` and inline SVG,
and its header comment is emphatic: "no external requests of any kind". The waitlist page keeps
that property.

```html
<form method="post" action="https://oflexcazqfuvcikrewnb.supabase.co/functions/v1/waitlist-signup">
```

A top level form navigation is not subject to CORS at all, and `application/x-www-form-urlencoded`
is a CORS "simple request" so there is no preflight either. The function replies `303 See Other`
with `Location: https://duoqueue.io/waitlist/thanks/`. `link-steam-callback` already proves both
halves of this work on Supabase's gateway: it is reached by a plain browser redirect carrying no
JWT, and it answers with `new Response(null, { status: 302, headers: { Location: url } })`.

Three consequences worth stating plainly:

- **Omitting CORS headers is not a security control.** CORS stops a script from *reading* a cross
  origin response; it never stopped the request. The real protections are in section 1.3.
- **The email never appears in a URL.** POST body in, 303 out. Nothing lands in a Referer header,
  a GitHub Pages access log, or browser history. This is a reason to prefer POST here beyond taste.
- **The project ref in the form action discloses nothing new.** `oflexcazqfuvcikrewnb` is already
  committed in `scripts/db/run-sql.ps1:12` and `apply-migration.ps1:17`, and ships inside the app
  binary as `EXPO_PUBLIC_SUPABASE_URL`.

Error handling without JavaScript means static outcome pages, since a static page cannot read a
query string. Two of them: `/waitlist/thanks/` and `/waitlist/try-again/`. Every accepted, duplicate,
honeypot-tripped and rate-limited request lands on `/waitlist/thanks/`, so nothing the endpoint
knows leaks to a prober and no real person is ever told their signup failed when the row exists.
Only a malformed address or an unchecked 18+ box, which are the two things a human can actually fix,
land on `/waitlist/try-again/`.

### 1.3 Bots are kept out with a honeypot, server side validation, an IP-hash rate limit and a send budget. No Turnstile

Cloudflare Turnstile is free and `.env.example` already contemplates it for app signup
(`EXPO_PUBLIC_TURNSTILE_SITE_KEY`, with the secret in the Supabase Dashboard). It is still the
wrong tool here:

- It requires loading a script from `challenges.cloudflare.com`, which breaks the site's
  no-external-requests property and its zero-JS posture.
- The Supabase side of Turnstile validates tokens for **GoTrue auth endpoints**. An Edge Function
  would have to call Cloudflare's siteverify itself, which is another secret and another network
  round trip inside the request.
- The threat is not account creation. It is junk rows and wasted email sends. The cost of the worst
  realistic bot run is bounded by the rate limit and the send budget below.

What is built instead, in the order the endpoint evaluates it:

| Control | Setting | Reasoning |
|---|---|---|
| Body size cap | 4 KB, enforced while reading the stream, not from `Content-Length` | Same reasoning as `_shared/validation.ts`: `Content-Length` is caller supplied and can be absent or wrong. |
| Attempt logging | every request writes one row to `waitlist_attempts` before any decision | So rejected attempts count toward the limit, not just accepted ones. |
| Per IP rate limit | 10 per hour, 30 per 24 hours, keyed on `sha256(WAITLIST_IP_SALT + ip)` | Deliberately loose. A US mobile audience arriving from TikTok sits behind carrier grade NAT, where one egress IP can legitimately carry many real people. This limit exists to stop one script hammering one endpoint, not to be the primary filter. Over the limit redirects to `/waitlist/thanks/` and stores nothing. |
| Honeypot | a text input named `company`, offscreen via CSS with `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"` | Non-empty means a form filler. Redirect to `/waitlist/thanks/`, store nothing. Silent, so the bot learns nothing and does not retry with the field cleared. |
| Email validation | trim, lowercase, NFC normalise; length 6 to 254; regex `^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$`; reject control characters using the same rule as `isCleanText` | Server side, because `type="email"` in the browser is a convenience, not a check. |
| Source allow-list | one of `direct`, `tt`, `ig`, `yt`, anything else becomes `direct` | The only free text a stranger can influence, so it is not free text. |
| Duplicate collapse | `insert ... on conflict (email) do nothing returning id`; no returned row means already on the list, redirect to thanks, send no second welcome | Prevents both double emails and address enumeration. |
| Welcome send budget | 80 sends per rolling 24 hours, counted from the table | See 0.1. Over budget stores the row with `welcome_status = 'deferred'` and sends nothing. |
| Kill switch | `app_config` row `waitlist_open`; when not `'true'` the endpoint redirects to `https://duoqueue.io/` and stores nothing | One SQL UPDATE turns the endpoint off, no redeploy. Same runtime-config pattern as `edge_function_base_url` and `internal_trigger_token`. |

Only the IP hash is stored, only in `waitlist_attempts`, and only for 48 hours (bounded prune per
call plus an hourly cron backstop, mirroring `rate_limit_hits_cleanup_hourly` from `0048`). The
signup row itself holds no IP, so the privacy policy update in step A6 has exactly one new data
category to describe: an email address, plus which of four links it came from.

### 1.4 The welcome email exists, and it is what makes the launch blast deliverable

Every accepted signup gets one immediate transactional email from the endpoint. Three jobs:

1. **It proves the address.** A typo or a harvested address bounces now, ten days before the blast,
   and `scripts/waitlist.mjs check` marks the row `bounced` so the blast skips it. This is the
   entire bounce-protection strategy, and it costs nothing extra: it is the same one email per
   signup that double opt-in would cost, without the 20 to 30% list shrink from people who never
   click a confirmation link.
2. **It stops the blast being a cold first contact** from a name the recipient last saw ten days
   ago on a TikTok.
3. **It carries the opt-out**, so the launch email is not the first place unsubscribing is offered.

**Double opt-in was considered and rejected.** It buys one thing this design does not already have:
protection against someone deliberately signing up a third party's real address. The rate limits
bound that to a nuisance, and the mailbombing amplification risk that naive double opt-in creates
is worse than the risk it removes at this scale.

### 1.5 The launch email goes out as a Resend Broadcast, driven by a local script, with a batch-API fallback

Not an Edge Function. A local `node scripts/waitlist.mjs` with the service role key and a Resend
key from the gitignored root `.env`, exactly the shape `scripts/seed-review-demo.mjs` and
`scripts/generate-fake-profiles.ts` already use for privileged one-off operations. This means:

- No new public endpoint, no new deployed function, no new Supabase secret for the send path.
- No Edge Function wall clock limit on a several hundred recipient send.
- Cameron runs it deliberately, at the hour he chooses, which is exactly what "concentration in
  time" requires.
- `--dry-run` is the default and `--send` is explicit.

Broadcasts rather than the transactional API, for the quota reason in 0.1 and because Resend's own
docs say broadcasts "handle all your unsubscribe flows for you automatically", which satisfies the
CAN-SPAM working-opt-out requirement without building an unsubscribe endpoint. The `{{{RESEND_UNSUBSCRIBE_URL}}}`
placeholder goes in the template.

**Two things to verify at implementation time rather than trust from this document.** Resend's
create-broadcast reference currently names the target field `segment_id`, where older material says
`audience_id`; and the free plan's marketing meter (1,000 contacts/month) is documented on the
pricing page but its interaction with the transactional daily cap is not spelled out. The script
must fail loudly on an unexpected field name rather than guess, and step C2 is a dashboard check,
not an assumption.

**Fallback if Broadcasts cannot be used**: `POST /emails/batch`, 100 per call, 10 requests/second
team rate limit, chunked, with `headers: { "List-Unsubscribe": "<mailto:support@duoqueue.io?subject=unsubscribe>" }`
and a visible unsubscribe line in the body. Compliant as long as Cameron honours requests, which is
realistic at this scale. The script implements this path behind `--transport=batch`.

Either way the email carries a physical postal address, because CAN-SPAM requires one for a
commercial message: `201 N Becket St, Cary, NC 27513, USA`, already the address in
`docs/legal/terms-of-service.md:175`.

**Open and click tracking stay off.** Click tracking rewrites every link through a Resend tracking
domain, which looks like phishing on a first contact and contradicts the project's deliberate
no-analytics posture (spec line 23). The cost is that there is no "email non-openers" follow up, so
there is exactly one launch email. That is consistent, and one well timed email is what the spec
asked for anyway.

**From address**: `DuoQueue <support@duoqueue.io>`. It is a real, monitored NEO mailbox
(`docs/APP-STORE-SUBMISSION.md:26`), it is the address already published on the site and in both
legal documents, and replies reach a human. A separate marketing subdomain would be textbook better
for protecting transactional reputation, but the free plan allows exactly 1 domain, so that is a
Pro-plan option, noted and not taken.

### 1.6 The site gets a build-time phase constant, and the TODO guard is extended to cover it

`scripts/build-site.mjs` gains, next to `SUPPORT_EMAIL`:

```js
const PHASE = "waitlist";          // flipped to "launched" in the release commit
const APP_STORE_URL = null;        // "https://apps.apple.com/us/app/duoqueue/id<AppleID>"
```

A committed constant rather than an environment variable: the flip is one line, it lands in git as
the record of when the site changed, and it cannot be forgotten by a shell that did not export a
variable. The build refuses to run when `PHASE === "launched"` and `APP_STORE_URL` is null or still
contains `<AppleID>`, printing the same style of message the TODO guard prints. That guard exists
because "a legal page with TODO sitting in it is worse than no legal page"; a launched landing page
whose only call to action is a dead link is the same failure, so it gets the same treatment.

`PHASE` controls exactly three things: the home page hero call to action, the waitlist page body
(form, or "we are live, here is the link"), and whether `/waitlist/` self-canonicalises.

### 1.7 The site build starts emitting `CNAME` and `.nojekyll`, and deployment becomes a script

The `gh-pages` branch contains `.nojekyll`, `CNAME`, `index.html`, `privacy/index.html`,
`terms/index.html`. The repo's `site/` contains only the three HTML files. That gap is why
`gh-pages` history reads `c3e8f2f Delete CNAME` then `13d3a79 Create CNAME`: a deploy that mirrors
`site/` over the worktree removes the custom domain and duoqueue.io goes down, taking the App
Store's Privacy Policy URL with it.

Fix the gap at the source. `build-site.mjs` writes `site/CNAME` (`duoqueue.io`) and `site/.nojekyll`,
so the build output is a complete, self sufficient copy of the published site.

Then `scripts/deploy-site.mjs` (zero dependency, `node:child_process` + `node:fs` + global `fetch`,
matching the rest of `scripts/`) does the deploy with assertions at every step that has burned this
project before:

1. Run the build. Abort on non-zero exit.
2. Assert every expected output file exists and is non-empty, including `CNAME` and `.nojekyll`.
3. Ensure a worktree at `../duoqueue-gh-pages` exists via `git worktree add ../duoqueue-gh-pages gh-pages`.
   Outside the repo tree so no build, lint or glob ever sees it.
4. **Assert the worktree is branch attached**: `git -C ../duoqueue-gh-pages symbolic-ref -q HEAD`
   must print `refs/heads/gh-pages`. A detached HEAD fails here rather than committing into the
   void. This is the specific failure the prompt names, and it is now a hard check.
5. `git -C ../duoqueue-gh-pages pull --ff-only` so a manual dashboard edit is never clobbered.
6. Copy `site/*` over the worktree with `fs.cpSync(..., { recursive: true })`. Never `rm -rf` the
   worktree first. Print a warning listing any file present in the worktree but not in `site/`.
7. Commit (no-op cleanly if nothing changed) and push.
8. **Verify the push landed**: `git ls-remote origin refs/heads/gh-pages` must equal the local
   worktree HEAD SHA. A push that silently did nothing fails here.
9. **Verify the live site**, not the push: `fetch` each of `/`, `/waitlist/`, `/privacy/`,
   `/terms/` with `cache: "no-store"`, retrying for up to 90 seconds, asserting HTTP 200 and that
   the body contains a per-page sentinel string (`id="waitlist-form"` for the waitlist page,
   `apps.apple.com` for the launched home page). Non-200 or missing sentinel exits non-zero.

Checking `/privacy/` and `/terms/` on every deploy is not padding. A 404 on either is a Guideline
5.1.1 rejection risk on an app that is already approved, and this deploy touches the same branch
that serves them.

---

## 2. Files

**Created**

| Path | What |
|---|---|
| `supabase/migrations/0061_waitlist.sql` | `waitlist_signups`, `waitlist_attempts`, grants, RLS, cron cleanup, `waitlist_open` config row |
| `supabase/functions/waitlist-signup/index.ts` | the public form endpoint |
| `scripts/deploy-site.mjs` | build, deploy to gh-pages, verify live |
| `scripts/waitlist.mjs` | `stats` / `check` / `sync` / `broadcast` / `send-deferred` |
| `scripts/templates/launch-email.html` | Volt styled broadcast body |
| `docs/superpowers/plans/2026-08-18-waitlist-and-launch.md` | this plan |

**Modified**

| Path | What |
|---|---|
| `scripts/build-site.mjs` | `PHASE`/`APP_STORE_URL`/`WAITLIST_ENDPOINT` constants, launched-phase guard, waitlist + thanks + try-again + 3 channel pages, phase aware home hero, CSS for form and CTA, `CNAME`, `.nojekyll`, `og.png`, `favicon.png` |
| `supabase/config.toml` | `[functions.waitlist-signup] verify_jwt = false` with a comment explaining the posture |
| `package.json` (root) | `site:build`, `site:deploy`, `waitlist` scripts |
| `.env.example` | `RESEND_ADMIN_API_KEY`, and a note that `RESEND_SEND_API_KEY` and `WAITLIST_IP_SALT` are Supabase function secrets |
| `docs/security/secrets-inventory.md` | two new server-only secrets; a note that this is the project's first unauthenticated write endpoint |
| `docs/legal/privacy-policy.md` | new "Website and waitlist" subsection in section 2; Resend row updated; effective date and version bumped |
| `docs/APP-STORE-SUBMISSION.md` | Part 1.5 demo removal timing corrected to "after release, T+48h"; pointer to the runbook in section 4 here |
| `README.md` | site build/deploy and waitlist operations section |
| `site/**` | rebuilt output, committed as usual |

**New generated site output** (all committed, all produced by `build-site.mjs`): `site/waitlist/index.html`,
`site/waitlist/thanks/index.html`, `site/waitlist/try-again/index.html`, `site/tt/index.html`,
`site/ig/index.html`, `site/yt/index.html`, `site/CNAME`, `site/.nojekyll`, `site/og.png`,
`site/favicon.png`.

**New dependencies: none.** Everything is `node:*` builtins, global `fetch`, and the existing
`npm:@supabase/supabase-js@2` import in Deno.

---

## 3. Steps

Each step says what it verifies before the next one starts. Do not skip a verification because the
previous step "obviously worked"; three of these verify things that have silently failed in this
repo before.

### Phase A: build it, while the content pipeline is still spinning up

**A1. Migration `0061_waitlist.sql`.**

Header comment explains WHY, per house rule. Body:

```sql
create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'direct',
  created_at timestamptz not null default now(),
  welcome_status text not null default 'pending',
  welcome_email_id text,
  welcome_sent_at timestamptz,
  synced_to_resend_at timestamptz,
  launch_email_sent_at timestamptz,
  unsubscribed_at timestamptz,
  constraint waitlist_signups_email_shape check (
    email = lower(email)
    and length(email) between 6 and 254
    and email ~ '^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$'
  ),
  constraint waitlist_signups_source_shape check (source in ('direct', 'tt', 'ig', 'yt')),
  constraint waitlist_signups_welcome_status_shape check (
    welcome_status in ('pending', 'sent', 'deferred', 'failed', 'bounced', 'complained')
  )
);

create unique index waitlist_signups_email_key on public.waitlist_signups (email);
create index waitlist_signups_created_at_idx on public.waitlist_signups (created_at);
create index waitlist_signups_welcome_status_idx on public.waitlist_signups (welcome_status);

alter table public.waitlist_signups enable row level security;
-- No policies, deliberately. Only the service role touches this table, the same shape
-- rate_limit_hits (0048) and active_boosts (0013) use.
revoke all on public.waitlist_signups from public, anon, authenticated;

create table public.waitlist_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index waitlist_attempts_ip_hash_created_at_idx
  on public.waitlist_attempts (ip_hash, created_at);
alter table public.waitlist_attempts enable row level security;
revoke all on public.waitlist_attempts from public, anon, authenticated;

-- :45 is the only free slot. :00 is daily-swipes-refreshed and the nudges, :30 the
-- nudges again, :15 rate_limit_hits_cleanup_hourly (0048), :40 verified-stats (0058).
select cron.schedule(
  'waitlist_attempts_cleanup_hourly',
  '45 * * * *',
  $$delete from public.waitlist_attempts where created_at < now() - interval '48 hours'$$
);

insert into public.app_config (key, value) values ('waitlist_open', 'true')
on conflict (key) do nothing;
```

*Verify:* dry run first, which is what `apply-migration.ps1` defaults to.

```powershell
.\scripts\db\apply-migration.ps1 supabase\migrations\0061_waitlist.sql
.\scripts\db\apply-migration.ps1 supabase\migrations\0061_waitlist.sql -Commit
```

Then confirm the grants really are gone, because this is the exact thing that has bitten this repo:

```powershell
.\scripts\db\run-sql.ps1 -Query "select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('waitlist_signups','waitlist_attempts') order by 1,2"
```

Expect zero rows for `anon` and `authenticated`. If `SELECT` shows up for either, `0052`'s default
privileges left it in and the `revoke all` line did not run. Also confirm RLS is on and policy count
is zero:

```powershell
.\scripts\db\run-sql.ps1 -Query "select relname, relrowsecurity, (select count(*) from pg_policies p where p.tablename = c.relname) as policies from pg_class c where relname in ('waitlist_signups','waitlist_attempts')"
```

**A2. Secrets.**

```bash
npx supabase secrets set RESEND_SEND_API_KEY=<sending-only key, domain restricted to duoqueue.io>
npx supabase secrets set WAITLIST_IP_SALT=<32 random bytes, base64url>
```

The Resend key here is a **new** key with Sending access only, not the key used as the Supabase
Auth SMTP password. Two keys so rotating the waitlist one cannot break account confirmation, which
is the higher-value path. Put a full-access key in the gitignored root `.env` as
`RESEND_ADMIN_API_KEY` for the local scripts (contacts and broadcasts need more than send access).

*Verify:* `npx supabase secrets list` shows both names. Never echo values.

**A3. `supabase/functions/waitlist-signup/index.ts`.**

`Deno.serve` handler, in this order:

1. `req.method !== "POST"` returns 303 to `https://duoqueue.io/waitlist/`. A crawler GET should
   land on the page, not a 405 body.
2. Read the body with a 4 KB cap enforced while streaming. `_shared/validation.ts`'s `readJsonBody`
   is JSON-only, so this needs a sibling reader; either add `readFormBody` there or inline the same
   loop with a comment pointing at it. Prefer adding `readFormBody` to `_shared/validation.ts`, so
   the byte-cap logic exists once.
3. Compute `ipHash = hex(sha256(WAITLIST_IP_SALT + firstHop(x-forwarded-for)))`.
4. Insert the `waitlist_attempts` row. Prune `where ip_hash = $1 and created_at <= now() - 48h`
   (bounded, indexed, same pattern as `check_rate_limit`).
5. Count attempts for that hash in the last hour and last 24 hours. Over 10 or over 30 returns 303
   to `/waitlist/thanks/`.
6. Read `app_config.waitlist_open`. Not `'true'` returns 303 to `https://duoqueue.io/`.
7. Honeypot `company` non-empty returns 303 to `/waitlist/thanks/`.
8. `adult !== "yes"` returns 303 to `/waitlist/try-again/`.
9. Normalise and validate the email. Invalid returns 303 to `/waitlist/try-again/`.
10. Map `source` through the allow-list.
11. `insert ... on conflict (email) do nothing` with `.select("id")`. No row means duplicate:
    303 to `/waitlist/thanks/`.
12. Count rows with `welcome_status = 'sent'` and `welcome_sent_at > now() - 24h`. At or over 80,
    set `welcome_status = 'deferred'` and return 303 to `/waitlist/thanks/`.
13. `POST https://api.resend.com/emails` with the welcome content from appendix A. Store the
    returned id in `welcome_email_id`, set `welcome_status = 'sent'` and `welcome_sent_at`. On any
    error, set `welcome_status = 'failed'` and log, but still redirect to thanks. The row is what
    matters; a failed welcome is recoverable with `send-deferred`.
14. 303 to `/waitlist/thanks/`.

Add to `supabase/config.toml`, with a comment stating that unlike every other `verify_jwt = false`
function in this project this one has **no** shared secret gate, because it must be callable by any
member of the public from a static page, and that its protections are validation, rate limiting,
and the fact that its only write is one insert into one no-grant table.

*Verify:* deploy and exercise it before the site links to it. The endpoint is unreferenced at this
point, so testing against production is safe.

```bash
npx supabase functions deploy waitlist-signup --project-ref oflexcazqfuvcikrewnb
```

```bash
# happy path: expect 303 and Location: https://duoqueue.io/waitlist/thanks/
curl -i -X POST https://oflexcazqfuvcikrewnb.supabase.co/functions/v1/waitlist-signup \
  -d 'email=YOUR+REAL@address.test' -d 'adult=yes' -d 'source=tt'
# no Authorization header at all, on purpose: this proves verify_jwt=false took effect

# honeypot: expect 303 to /waitlist/thanks/ and NO new row
curl -i -X POST ... -d 'email=bot@example.com' -d 'adult=yes' -d 'company=Acme'

# bad address: expect 303 to /waitlist/try-again/
curl -i -X POST ... -d 'email=not-an-email' -d 'adult=yes'

# missing 18+ box: expect 303 to /waitlist/try-again/
curl -i -X POST ... -d 'email=someone@example.com'

# oversized body: expect 413
curl -i -X POST ... --data-binary @<(head -c 20000 /dev/zero | tr '\0' 'a')

# kill switch: set waitlist_open='false', expect 303 to https://duoqueue.io/, then set it back
```

Then confirm exactly one row exists, that the honeypot and invalid attempts stored nothing, and
that the welcome email actually arrived in a real inbox:

```powershell
.\scripts\db\run-sql.ps1 -Query "select email, source, welcome_status, welcome_email_id from public.waitlist_signups order by created_at"
```

Delete the test rows before going live.

**A4. `scripts/build-site.mjs`.**

Add the constants from 1.6, the launched-phase guard, the new page builders, and the asset copies
(`apps/mobile/assets/icon.png` to `site/og.png`, 1024x1024 and fine for `og:image` plus
`twitter:card=summary`; `apps/mobile/assets/favicon.png` to `site/favicon.png`, 48x48; the site
currently has no favicon at all).

New CSS, using only tokens that already exist in `COLORS`, so nothing new to audit:

```
.cta { background: var(--accent); color: var(--bg); border: 1px solid var(--accent);
       padding: 0.85em 1.4em; font-weight: 700; text-decoration: none; display: inline-block; }
.hp  { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
```

Contrast, computed against the exact hex values in `COLORS` (Volt dark and Paper light):

| Pair | Ratio | Needs |
|---|---|---|
| `#0A0B09` on `#CDFF3D` (dark CTA) | 16.88 | 4.5 |
| `#FFFFFF` on `#4A6B00` (Paper CTA) | 6.19 | 4.5 |
| `#CDFF3D` on `#0A0B09` (dark link) | 16.88 | 4.5 |
| `#4A6B00` on `#F2F4EB` (Paper link) | 5.57 | 4.5 |

All pass AA for normal text. Note that `pnpm audit:contrast` reads
`apps/mobile/src/theme/tokens.ts` only and does not cover the site, so these are hand computed and
recorded here on purpose. Do not introduce a colour the table above does not cover.

The three channel pages (`/tt/`, `/ig/`, `/yt/`) are the same template with a different hidden
`source` value and `<link rel="canonical" href="https://duoqueue.io/waitlist/">`. Short paths
because they go in social bios. This is what gives workstream 3 per-channel attribution with no
analytics SDK and no query-string JavaScript.

*Verify:*

```bash
node scripts/build-site.mjs
```

Expect nine written paths. Open `site/waitlist/index.html` in a browser, submit it, and confirm you
land on `https://duoqueue.io/waitlist/thanks/` (which will 404 until A5 deploys, and that 404 is
itself proof the redirect fired). Then prove the guard works:

```bash
# temporarily set PHASE = "launched" with APP_STORE_URL still null
node scripts/build-site.mjs   # must exit 1 and name the constant, writing nothing
```

Revert to `"waitlist"`. Confirm `git status` shows `site/privacy/index.html` and
`site/terms/index.html` unchanged, meaning the refactor did not alter the legal pages.

**A5. `scripts/deploy-site.mjs`, then the first deploy.**

Implement the nine steps in 1.7.

*Verify:* the script verifies itself, which is the point. Run it and confirm it prints the remote
SHA match and four HTTP 200s with sentinels found. Then independently:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://duoqueue.io/waitlist/
curl -sS https://duoqueue.io/waitlist/ | grep -c 'id="waitlist-form"'
curl -sS -o /dev/null -w '%{http_code}\n' https://duoqueue.io/privacy/
curl -sS -o /dev/null -w '%{http_code}\n' https://duoqueue.io/terms/
curl -sS https://duoqueue.io/CNAME
```

The last one must print `duoqueue.io`. If it 404s, the custom domain is about to break.

Then do the real end to end test: on a phone, on cellular, open `https://duoqueue.io/tt/`, submit a
real address, confirm the thanks page renders, confirm the welcome email arrives, and confirm the
row has `source = 'tt'`.

**A6. Privacy policy.**

Add to section 2, after "Usage information":

> ### Website and waitlist
> Before DuoQueue launched we ran a waitlist on duoqueue.io. If you entered your email address
> there, we stored that address, the date, and which of our links you arrived from (so we know
> which channel worked), for the single purpose of emailing you once when the app went live. We did
> not store your IP address with your signup. We use a short lived, salted hash of it, kept for 48
> hours, only to stop automated abuse of the form. We do not use cookies on duoqueue.io and there
> is no analytics or advertising script on any page of it.

Update the Resend row in the section 3 table to "Sends transactional email (signup confirmation,
account emails) and the one-time waitlist launch announcement". Bump the effective date and the
version line.

Note the tense: the paragraph is written to stay true after launch, when the waitlist is closed.

*Verify:* `node scripts/build-site.mjs` must still succeed, meaning no `TODO(Cameron)` or
`TODO(lawyer)` marker crept back in. Diff `site/privacy/index.html` and confirm the new subsection
renders and the anchors did not shift. **Check the new prose for em dashes before deploying**, per
house rule; this text is user and reviewer readable. Redeploy with `node scripts/deploy-site.mjs`.

**A7. Docs and package scripts.**

`.env.example`, `docs/security/secrets-inventory.md` (two new server-only secrets, plus a short
paragraph that `waitlist-signup` is this project's first unauthenticated public write endpoint and
what bounds it), `README.md` operations section, root `package.json` scripts.

*Verify:*

```bash
pnpm typecheck && pnpm lint && pnpm audit:contrast
```

All three must be green. None of them cover `scripts/*.mjs` or `supabase/functions/**` (the root
has no eslint config and `pnpm -r` only reaches `apps/mobile` and `packages/shared-types`), so
green here means "nothing was broken", not "the new code was checked". The new code was checked by
A3's curl matrix and A5's live fetch.

### Phase B: the waitlist runs, 7 to 14 days

**B1.** Put `duoqueue.io/tt`, `/ig`, `/yt` in the three social bios. Every video's end card in
workstream 2 points at the matching one.

**B2.** Daily, alongside workstream 3's reminder:

```bash
node scripts/waitlist.mjs stats
```

Prints signups per day, split by source, and the `welcome_status` breakdown. Two things to watch:
any `deferred` rows means the 80/day budget is biting and the Pro decision (0.2) just became real;
any `failed` rows means the Resend key or the domain has a problem, ten days before it would matter.

**B3.** Twice during the window:

```bash
node scripts/waitlist.mjs check
```

Fetches `GET https://api.resend.com/emails/{id}` for each `sent` row and marks `bounced` or
`complained`. A bounce rate over about 5% means the honeypot is being bypassed and it is time to
tighten the IP limits or close the form early.

**B4.** The end condition from 0.5: 3 day trailing average under 40% of the peak day, or day 14.
`stats` prints both numbers so this is a reading, not a judgement call.

### Phase C: release

The click by click runbook is section 4. The engineering steps it references:

**C1.** Fill `APP_STORE_URL` in `build-site.mjs` from the Apple ID in App Store Connect. Leave
`PHASE = "waitlist"`. Commit. Do not deploy yet.

**C2.** Resend dashboard, Settings then Usage: read the current plan's remaining transactional
quota and confirm whether Broadcasts meter separately. If they do not, or if the list is larger
than the day's remaining transactional headroom, buy one month of Pro now, before release day, not
during it.

**C3.** `node scripts/waitlist.mjs sync --dry-run` then `--send`. Creates or finds the Resend
audience, pushes every row that is not `bounced`, `complained` or unsubscribed, and stamps
`synced_to_resend_at`. Verify the contact count in the Resend dashboard equals the script's count.

**C4.** `node scripts/waitlist.mjs broadcast --dry-run` writes the rendered HTML to
`.tmp/launch-email-preview.html`. Open it. Send yourself a single test through Resend's dashboard
before creating the real broadcast. Check it in Gmail on mobile, which is where most of it will be
read, and confirm the unsubscribe link resolves.

**C5.** Release in App Store Connect, then flip the site, then send. Order matters and section 4
has it.

**C6.** `node scripts/waitlist.mjs broadcast --send` at the chosen hour. It stamps
`launch_email_sent_at` on every synced row so a re-run cannot double send.

**C7.** Close the form:

```powershell
.\scripts\db\run-sql.ps1 -Query "update public.app_config set value='false' where key='waitlist_open'"
```

Old links and QR codes now redirect to the launched home page, which has the App Store button.

**C8.** Optional, recommended: restyle `supabase/templates/confirmation.html` in Volt and paste it
into the Dashboard at Authentication then Email Templates then Confirm signup. Keep `{{ .Token }}`,
never add a confirmation URL variable, for the reason the file's own comment gives. Test with a
throwaway address on a domain Cameron does not control.

### Phase D: after

**D1.** For 72 hours: Resend's bounce and complaint rates after the blast, App Store Connect
impressions and conversion, and signups per day from Supabase filtered to `is_demo = false`.

**D2.** Remove the review demo seed:

```bash
node scripts/seed-review-demo.mjs --remove
```

**Timing: T+48h after release, once the listing is confirmed live and the launch email has gone
out.** Not before release, because Apple can pull an app back into review after it goes live and
the reviewer needs a working demo account. Not indefinitely after, because the 15 demo auth users
pollute every signups-per-day query workstream 3 will run.

Understand the consequence before running it: removal deletes the review auth user, so the
credentials currently pasted into App Review Information stop working. Re-running the seed for the
next version submission generates a **new** password, which must be re-pasted into App Store
Connect before submitting 1.0.1. `docs/APP-STORE-SUBMISSION.md` Part 1.5 should say so; step A7
adds that sentence.

*Verify:* the script reports counts back to the pre-seed baseline. Then confirm no demo rows
survive:

```powershell
.\scripts\db\run-sql.ps1 -Query "select count(*) from public.profiles where is_demo = true"
```

Expect 0.

---

## 4. Release runbook: what Cameron clicks, in what order

Wednesday morning ET. Roughly 90 minutes of attention, most of it waiting.

**Before, the night before**

- [ ] `node scripts/waitlist.mjs stats`. Write down the final list size.
- [ ] C2 done: Resend quota confirmed, Pro bought if needed.
- [ ] C3 done: contacts synced, count matches.
- [ ] C4 done: test email received and read on a phone, unsubscribe link works.
- [ ] `APP_STORE_URL` filled and committed (C1).
- [ ] Workstream 1b (notify on new matching signups) is deployed. Without it, the concentrated
      arrival does not compound and the whole exercise loses half its value.
- [ ] The app's own signup path works end to end on the production build, on a fresh address, on a
      domain nobody here controls. This is the single most important pre-flight check: if
      confirmation email is broken, every arrival bounces off the front door.

**Release, T+0**

1. App Store Connect, the app, the 1.0 version page, **Release This Version**.
2. Wait. Propagation to the storefront is usually minutes but can be an hour.
3. Check the listing is really live, from a device that has never seen it:
   `curl -sS -o /dev/null -w '%{http_code}\n' 'https://apps.apple.com/us/app/id<AppleID>'` returns
   200, and the link opens the App Store app on an iPhone.
4. Install from the public listing. Not TestFlight, not Expo Go. Create a brand new account, get
   the confirmation code, complete onboarding, see the deck. If anything here is broken, stop and
   do not send the email. A list is spendable once.

**Flip the site, T+1h**

5. Set `PHASE = "launched"` in `scripts/build-site.mjs`. One line.
6. `node scripts/deploy-site.mjs`. It will refuse if `APP_STORE_URL` is unset, verify the remote
   SHA, and verify the live pages.
7. Eyeball `https://duoqueue.io/` and `https://duoqueue.io/waitlist/` on a phone. Both must show
   the App Store button. Tap it. It must open the store, not 404.
8. `git commit` the flip and the rebuilt `site/`.

**Send, Thursday 6:30 PM ET**

9. `node scripts/waitlist.mjs broadcast --dry-run` one last time and read the recipient count.
10. `node scripts/waitlist.mjs broadcast --send`.
11. Watch the Resend dashboard for the first two minutes. Delivered climbing, bounces near zero.
    If bounces exceed roughly 5%, stop and investigate before any future send; the domain also
    carries the auth confirmation email.
12. Close the form (C7).

**After**

13. T+2h: check signups in Supabase. The arrival curve is the whole experiment.
14. T+24h: `node scripts/waitlist.mjs check` to fold post-send bounces into the table.
15. T+48h: remove the review demo seed (D2).

---

## 5. Rollback and teardown

- **The form is producing junk.** One SQL update flips `waitlist_open` to `'false'`. No redeploy,
  no site change, takes ten seconds.
- **The site deploy went wrong.** `gh-pages` is a normal branch with normal history:
  `git -C ../duoqueue-gh-pages revert HEAD && git push`. The deploy script's own live fetch check
  is what tells you to do this, usually before anyone notices.
- **The Edge Function is misbehaving.** `npx supabase functions delete waitlist-signup`. The form
  then posts into a 404, which is ugly but harmless, and the kill switch is the better first move.
- **Everything is done and the waitlist is over.** The tables can be dropped once the launch email
  has gone out and the numbers are recorded, but there is no need to hurry. Keep
  `waitlist_signups` at least until the launch has been analysed, and note that dropping it deletes
  the record of consent for anyone who is still on the Resend audience. Unschedule the cron job
  (`select cron.unschedule('waitlist_attempts_cleanup_hourly')`) in the same migration that drops
  the tables, if that migration is ever written.

---

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Resend daily cap silently breaks account confirmation on launch day | High if unhandled | Fatal to the launch | 0.1, the 80/day welcome budget, C2's dashboard check, Pro as the escape hatch |
| Broadcasts turn out to meter against the transactional cap, or the API field is `audience_id` not `segment_id` | Medium | Blocks the send | C2 verifies before release day; the script has a `--transport=batch` fallback and fails loudly rather than guessing a field name |
| gh-pages deploy silently pushes nothing, or removes CNAME | Has happened here before | duoqueue.io down, and with it the App Store Privacy Policy URL | Branch-attached worktree assertion, remote SHA comparison, live fetch of `/`, `/waitlist/`, `/privacy/`, `/terms/` and `CNAME` |
| The new table is created with SELECT granted to anon by Supabase default privileges | Certain without the explicit revoke | Every collected address exposed if RLS is ever disabled | Explicit `revoke all ... from public, anon, authenticated` plus the A1 grant query that proves it |
| The waitlist fills far better than expected and the welcome budget defers hundreds of rows | Low | Recoverable | `send-deferred` after upgrading; rows are never lost, only their welcome email is |
| A single IP behind carrier NAT is rate limited and real signups are dropped | Low, limits are loose | A handful of lost signups, silently | Limits set at 10/hour and 30/day rather than 3/hour for exactly this reason; `stats` will show a suspicious gap if it happens |
| Migration number collides with another workstream | Medium, four workstreams in flight | Confusing history | Renumber before applying; never edit an applied migration |
| Removing the demo seed invalidates the App Review credentials before a 1.0.1 submission | Medium | A rejected or delayed next submission | D2 documents it and A7 puts the sentence in the submission guide |
| The launch email lands in Promotions or spam | Medium | Blunts the concentration | Welcome email ten days earlier establishes the sender; no click tracking so no rewritten links; real monitored From address; plain text alternative; postal address and working unsubscribe |

---

## Appendix A: copy

House rules applied: no em dashes anywhere below, nothing that implies dating, 18+ stated plainly.

### `/waitlist/` (and `/tt/`, `/ig/`, `/yt/`)

> **DuoQueue is almost out.**
>
> It is an 18+ app for finding people to actually play with. Not dating. You match on the games you
> play, the hours you are online, and how you like to play them, then you talk and queue up.
>
> It launches on the App Store in the next couple of weeks. Leave your email and we will send you
> one message the day it goes live. That is the only email you get.
>
> [ email ] [ ] I am 18 or older  **[ Get the launch email ]**
>
> Everyone on this list gets it on the same day on purpose, so the first people in find someone to
> play with instead of an empty screen.
>
> One email, then nothing. We do not share your address. See our [Privacy Policy](/privacy/).

The 18+ checkbox is a self declaration for mailing list hygiene. It must never be described as age
assurance, in this repo or anywhere near App Store Connect. Commit `c849fb4` settled that a
self-reported field is not an age assurance mechanism, and this plan does not reopen it.

### `/waitlist/thanks/`

> **You are on the list.**
>
> We will email you once, the day DuoQueue goes live. Nothing before that, nothing after.
>
> Add support@duoqueue.io to your contacts so it does not land in spam.

### `/waitlist/try-again/`

> **We could not add that one.**
>
> Either the address did not look like an email address, or the 18 or older box was not checked.
> DuoQueue is 18+ only, so that box is not optional.
>
> [Try again](/waitlist/)

### Welcome email

> Subject: You are on the DuoQueue list
>
> You will get one more email from us, the day DuoQueue goes live on the App Store. That is it.
>
> DuoQueue is an 18+ app for finding people to play games with. Not dating. You match on games,
> schedules and playstyle, then you talk and queue up.
>
> Everyone on this list gets the app on the same day on purpose. A matching app is only worth
> opening if there is somebody on the other side, so we are starting everyone at once.
>
> If you did not sign up for this, reply and say so and we will remove you.
>
> DuoQueue, 201 N Becket St, Cary, NC 27513, USA

### Launch email

> Subject: DuoQueue is live
>
> It is out. [Download DuoQueue on the App Store]
>
> Everyone on this list is getting this at the same time, which means the people you are swiping on
> tonight are arriving tonight too. That is the whole reason we waited.
>
> Two things worth doing in your first five minutes: add every game you actually play, not just
> your main, and set the hours you are usually online. Both are what the matching runs on.
>
> Not for you? [Unsubscribe]
>
> DuoQueue, 201 N Becket St, Cary, NC 27513, USA
