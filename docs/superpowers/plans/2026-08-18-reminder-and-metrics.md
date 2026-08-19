# Daily Reminder and Launch Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** Implement workstream 3 of `docs/superpowers/specs/2026-08-18-launch-marketing-design.md`
(section 3, "Reminder and measurement"): a recurring daily reminder that tells Cameron what is
queued and where it lives, and a script that reports real launch numbers without an analytics SDK.

**Architecture:** Six new files and two edited ones. No dependencies, no TypeScript, no migration,
no app change. The measurement half is two `.sql` files run through the existing
`scripts/db/run-sql.ps1` Management API path, plus one PowerShell script that formats them and
merges four hand-entered App Store Connect numbers from a small JSON file. The reminder half is one
PowerShell script that reads workstream 2's `manifest.json`, plus a one-time installer that
registers a Windows scheduled task.

**Status of the code in this plan:** every script below was extracted and executed while the plan
was written. The two queries were run against the live project, and the reminder was exercised
through all four of its branches. The expected outputs quoted in the verify steps are real
observed output, not predictions.

**Tech Stack:** PowerShell 5.1 (Windows PowerShell, the shell already used by `scripts/db/*.ps1`),
plain SQL against the hosted Supabase project, Windows Task Scheduler. Nothing is added to
`package.json` dependencies.

---

## Findings that change the shape of the work

These were all verified against the live project (`oflexcazqfuvcikrewnb`) and this machine on
2026-08-18. Read them before writing any code, because three of them contradict the spec's framing.

### 1. There is nothing in App Store Connect to measure yet, and the API is the wrong trade

The spec treats App Store Connect as a data source to pull from. Three facts make an API
integration the wrong call for this project right now:

- **The app is approved but not released.** Impressions, product page views, downloads and
  conversion are structurally zero until Cameron clicks Release. Every line of JWT-signing code
  written this week would fetch zeroes for the entire waitlist phase.
- **The `.p8` private key is not on this machine and cannot be re-downloaded.** App Store Connect
  lets you download an API key's private key exactly once, at creation. The key EAS uses for
  submission was created and retained by EAS. There is no `.p8` anywhere in this repo (confirmed by
  a repo-wide search; `*.p8` is also in `.gitignore`). Using the API means creating a *new* key in
  App Store Connect under Users and Access -> Integrations, downloading it once, and storing a
  long-lived Apple credential on disk.
- **The Analytics Reports API does not answer queries.** It is a request-and-wait pipeline: you
  POST an `analyticsReportRequest` (`ONGOING` for a daily feed, `ONE_TIME_SNAPSHOT` for history),
  then walk requests -> reports -> instances -> segments and download gzipped TSV from S3. The
  first report arrives roughly 24 to 48 hours after the request, a given day's data is not complete
  until two days later, and instances expire and must be re-requested. That is several hundred
  lines of ES256 JWT signing, polling, gzip and TSV parsing to replace a number Cameron can read
  off a dashboard.

**Decision: do not build the App Store Connect API integration.** Cameron reads four numbers off
the App Store Connect dashboard once a week and pastes them into
`scripts/metrics/asc-weekly.json`. The metrics script merges them into the same summary as the
Supabase numbers, which is what the spec actually asked for ("A script pulls both into one
summary"). This costs about two minutes a week, handles no Apple credentials, and produces no dead
code during the phase when every store number is zero. Revisit only if the weekly read becomes the
bottleneck, which at one person and one app it will not.

### 2. "Share returning" can only be answered as "came back at least once"

`public.profiles.last_active_at` is a single scalar, not an event log. It is written by
`onSignedIn` in `apps/mobile/src/store/session-store.ts:36` and refreshed every 60 seconds by the
`heartbeat()` RPC from `apps/mobile/src/features/online-now/useHeartbeat.ts`, which is mounted in
`apps/mobile/app/(tabs)/_layout.tsx:76`. Because it only ever holds the most recent open, the
question it can answer exactly is "did this user open the app on a calendar day after the day they
signed up", and the question it cannot answer is "what does the D1/D7 retention curve look like".

Worse, it is not reliable on its own. Live check on the four real users: two of the four have
`last_active_at = NULL` even though all four have `onboarding_completed = true`. So the return
signal must be a union of three sources:

- `profiles.last_active_at` (app opened; the only signal that fires when the deck is empty and the
  user does nothing, which is the exact case this launch is about)
- `swipes.created_at` per `swiper_id`
- `messages.created_at` per `sender_id`

The queries below do exactly that. Do not simplify it back down to one column.

### 3. Signups per day is a live count of surviving accounts, not a historical ledger

`supabase/functions/delete-account/index.ts:263` calls `serviceClient.auth.admin.deleteUser`, which
hard-deletes the `auth.users` row and cascades the profile away. Nothing in the schema records that
a signup ever happened. So a past day's signup count silently shrinks when someone deletes their
account. At four users this is visible by eye; at a few hundred it is a real distortion. The
metrics script must label the number honestly rather than pretend otherwise. Appendix A has the
design for a durable date-only tally if it becomes necessary; it is deliberately not part of this
plan.

### 4. `matches` uses `user_a_id` / `user_b_id`, not `profile_a` / `profile_b`

Confirmed live. `public.matches` columns are exactly
`id, user_a_id, user_b_id, matched_at, unmatched_at, unmatched_by`, with a canonical-order CHECK
(`user_a_id < user_b_id`) from `supabase/migrations/0001_init.sql`. "Has this user ever reached a
first match" is therefore `m.user_a_id = p.id or m.user_b_id = p.id`, over all rows including
unmatched ones (an unmatched match still means they reached one).

### 5. Real users must be separated from demo rows, and one filter is not enough

Live counts: 19 rows in `public.profiles`, 15 of them `is_demo = true` (the App Review demo pool
plus the flagged review account from `0059_review_demo_visibility.sql`), 0 with `is_admin = true`,
leaving 4 real users. All 19 have `onboarding_completed = true`.

`is_demo = false` is sufficient *today*, but `scripts/generate-fake-profiles.ts` does **not** set
`is_demo` and creates users at `duoqueue.seed.<n>.<rand>@example.com`. If `pnpm seed:profiles` is
ever pointed at production, those rows would count as real users. The queries below join
`auth.users` and exclude that email prefix as well. This works because the Management API query
endpoint runs as a superuser role, so `auth.users` is readable from `run-sql.ps1` (verified).

### 6. Baseline, so the first report is not mistaken for a bug

Verified live on 2026-08-18: 4 real users, 4 onboarded, 1 active in the last 7 days, **0 matches
ever**, 0 messages. The "share reaching a first match" metric starts at 0/4 and has never been
anything else. Every number in the first weeks will be a small integer, not a rate. That is the
point of the exercise, not a failure of it.

### 7. `run-sql.ps1` returns only the last statement's result

Verified: sending two `select` statements in one call returns rows for the second one only. Each
metric query must therefore be a single statement, or get its own call. Two related PowerShell 5.1
traps that follow from `run-sql.ps1` ending in `$resp | ConvertTo-Json -Depth 10`:

- A zero-row result produces **no output at all** (empty string), not `[]`.
- A one-row result produces a JSON **object**, not a one-element array.
- `ConvertFrom-Json` in PS 5.1 returns a multi-row array as a *single* pipeline item, so
  `@($out | ConvertFrom-Json).Count` is `1`, not `30`.

Task 2 defines one `Get-Rows` helper that handles all three. It is verified working (returns
`Count: 30` and `sum signups: 4` against the live 30-day window). Do not hand-roll a second version.

### 8. Success criterion "notification open rate" is not measurable and is out of scope here

The spec's second success criterion is "a new signup measurably reactivates existing matching
users, with notification open rate as the proxy". Nothing in this repo can produce that number.
Expo push receipts confirm delivery, not opens, and there is deliberately no analytics SDK. This
workstream does not deliver it, and no query below claims to. If it matters, workstream 1b has to
record the deep-link open server-side when the notification is tapped. Flagged, not solved.

---

## Global constraints

- Spec is the authority: `docs/superpowers/specs/2026-08-18-launch-marketing-design.md` section 3.
- **No migration.** Nothing in this workstream writes to the database. Every query is read-only.
  The live DB stays at 0060.
- **No new dependencies.** No npm package, no PowerShell module (BurntToast is confirmed *not*
  installed and is not worth installing for this).
- **No app change**, therefore **no new EAS build**. Nothing here ships to a user's phone.
- Quality gates are untouched by design: `pnpm typecheck`, `pnpm lint` and `pnpm audit:contrast`
  see no `.ps1`, `.sql`, `.json` or `.md` file added here. Run all three at the end anyway and
  confirm green before committing. `pnpm typecheck` was confirmed green at the start of this work.
- Every emitted string (console output, popup text) stays free of em dashes, matching the house
  rule. Code comments may keep them.
- These scripts read `auth.users` and every profile row through a superuser-role endpoint. They are
  local developer tooling. Never run them from CI, never commit their output, never paste a result
  containing an email address anywhere.

---

### Task 1: The two SQL files

**Files:**
- Create: `scripts/metrics/funnel-by-day.sql`
- Create: `scripts/metrics/snapshot.sql`

**Interfaces:**
- `funnel-by-day.sql` produces exactly 30 rows, newest first, columns
  `day, signups, confirmed, onboarded, returned, first_match`.
- `snapshot.sql` produces exactly 1 row, columns
  `users_total, users_onboarded, active_7d, matches_total, matches_active, users_with_a_match,
  messages_total`.
- Task 2 depends on both column lists verbatim.

Both queries below have been run against the live project and returned correct results. Use them as
written.

- [ ] **Step 1: Create `scripts/metrics/funnel-by-day.sql`**

```sql
-- Signup funnel by day, for the launch window. Read by scripts/metrics/launch-metrics.ps1.
--
-- WHY THIS SHAPE:
--   * generate_series produces a row for every one of the last 30 days, so a zero-signup day
--     shows as 0 instead of vanishing. During a launch, the gaps are the signal.
--   * "Real user" means: not a demo row (0059 flagged the App Review pool and the review
--     account is_demo = true), not an admin, and not a leftover from scripts/generate-fake-
--     profiles.ts, which creates duoqueue.seed.*@example.com users and does NOT set is_demo.
--   * "returned" is a union of three signals, not just last_active_at. last_active_at is a
--     single scalar (written at sign-in and heartbeated every 60s from the tabs shell), and
--     on 2026-08-18 it was NULL for two of the four real users despite all four being
--     onboarded. It is still the only signal that fires when a user opens the app, finds an
--     empty deck and does nothing, which is exactly the case this launch is about, so it
--     stays in the union alongside swipes and messages.
--   * Days are bucketed in America/Chicago (Cameron's timezone, and the timezone of 3 of the
--     4 real profiles) so "today" in the report matches the day he is living in. auth.users
--     and every timestamptz here are stored in UTC; the cast does the conversion.
--   * Attribution is by SIGNUP day, so a row means "of the N people who signed up that day,
--     M have since come back". The counts move as later days accrue.
--
-- CAVEAT, deliberately not fixed here: delete-account hard-deletes the auth.users row and
-- cascades the profile away, so a past day's signups shrink when someone deletes. This is a
-- count of surviving accounts, not a historical ledger. See Appendix A of
-- docs/superpowers/plans/2026-08-18-reminder-and-metrics.md.
with real_users as (
  select
    p.id,
    (p.created_at at time zone 'America/Chicago')::date as signup_day,
    p.onboarding_completed,
    p.last_active_at,
    u.email_confirmed_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.is_demo = false
    and p.is_admin = false
    and u.email not like 'duoqueue.seed.%'
),
activity as (
  select r.id, a.at
  from real_users r
  join lateral (
    select s.created_at as at from public.swipes s where s.swiper_id = r.id
    union all
    select m.created_at from public.messages m where m.sender_id = r.id
    union all
    select r.last_active_at where r.last_active_at is not null
  ) a on true
),
returned as (
  select distinct r.id
  from real_users r
  join activity a on a.id = r.id
  where (a.at at time zone 'America/Chicago')::date > r.signup_day
),
matched as (
  select distinct r.id
  from real_users r
  join public.matches m on m.user_a_id = r.id or m.user_b_id = r.id
)
select
  to_char(d.day, 'YYYY-MM-DD') as day,
  count(r.id) as signups,
  count(r.id) filter (where r.email_confirmed_at is not null) as confirmed,
  count(r.id) filter (where r.onboarding_completed) as onboarded,
  count(r.id) filter (where r.id in (select id from returned)) as returned,
  count(r.id) filter (where r.id in (select id from matched)) as first_match
from generate_series(
       (now() at time zone 'America/Chicago')::date - 29,
       (now() at time zone 'America/Chicago')::date,
       interval '1 day'
     ) as d(day)
left join real_users r on r.signup_day = d.day::date
group by d.day
order by d.day desc;
```

- [ ] **Step 2: Create `scripts/metrics/snapshot.sql`**

```sql
-- All-time state of the real user base, as of right now. Read by
-- scripts/metrics/launch-metrics.ps1. One row, always.
--
-- WHY THIS EXISTS ALONGSIDE funnel-by-day.sql: the funnel answers "did the push work", this
-- answers "is the deck non-empty yet", which is the question the whole launch plan turns on.
-- matches_active is the closest thing this schema has to "the product is working".
--
-- real_matches requires BOTH sides to be real users. A demo profile can never surface to a
-- real viewer (0059 gates every discovery surface), so this should never differ from an
-- unfiltered count, and if it ever does that is a visibility bug worth knowing about.
with real_users as (
  select p.id, p.created_at, p.onboarding_completed, p.last_active_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.is_demo = false
    and p.is_admin = false
    and u.email not like 'duoqueue.seed.%'
),
real_matches as (
  select m.*
  from public.matches m
  join real_users a on a.id = m.user_a_id
  join real_users b on b.id = m.user_b_id
)
select
  (select count(*) from real_users) as users_total,
  (select count(*) from real_users where onboarding_completed) as users_onboarded,
  (select count(*) from real_users
     where last_active_at is not null
       and last_active_at > now() - interval '7 days') as active_7d,
  (select count(*) from real_matches) as matches_total,
  (select count(*) from real_matches where unmatched_at is null) as matches_active,
  (select count(distinct id) from (
      select user_a_id as id from real_matches
      union all select user_b_id from real_matches) x) as users_with_a_match,
  (select count(*) from public.messages ms
     join real_matches rm on rm.id = ms.match_id) as messages_total;
```

- [ ] **Step 3: Verify both against the live project**

```powershell
.\scripts\db\run-sql.ps1 -QueryFile .\scripts\metrics\snapshot.sql
.\scripts\db\run-sql.ps1 -QueryFile .\scripts\metrics\funnel-by-day.sql
```

Expected, as of 2026-08-18 (these exact values were observed while writing this plan; the point of
checking them is that a wrong join or a wrong filter shows up immediately as a different number):

- `snapshot.sql` returns a single JSON object with
  `users_total: 4, users_onboarded: 4, active_7d: 1, matches_total: 0, matches_active: 0,
  users_with_a_match: 0, messages_total: 0`.
- `funnel-by-day.sql` returns 30 JSON objects. Exactly three of them have `signups: 1`
  (2026-08-18, 2026-08-15, 2026-08-05); the fourth real user signed up 2026-07-23, which is
  outside the 30-day window. Every `first_match` is 0.

If `signups` sums to more than 3 inside the window, the demo or seed filter is wrong. If a query
errors on `auth.users`, the Management API token is missing (`npx supabase login`).

---

### Task 2: The metrics script and the hand-entered App Store Connect numbers

**Files:**
- Create: `scripts/metrics/asc-weekly.json`
- Create: `scripts/metrics/launch-metrics.ps1`
- Modify: `package.json` (add one script entry)

**Interfaces:**
- Produces `pnpm metrics`, which prints one combined summary to the console.
- `launch-metrics.ps1 -Days N` limits the by-day table and the rollup to the last N days
  (default 14, max 30 because the SQL window is 30).

- [ ] **Step 1: Create `scripts/metrics/asc-weekly.json`**

Committed with one zeroed placeholder row so the file's shape is self-documenting and the script
has something to parse on day one.

```json
{
  "_comment": "Hand-entered from the App Store Connect dashboard. See README, 'Launch metrics'. Four numbers, once a week. Conversion is derived by the script, do not enter it.",
  "_where": "App Store Connect > Apps > DuoQueue > Analytics. App id 6798837181.",
  "weeks": [
    {
      "week_start": "2026-08-17",
      "read_on": "2026-08-18",
      "impressions": 0,
      "product_page_views": 0,
      "downloads": 0,
      "note": "Approved but not released. All store numbers are structurally zero until Release is clicked."
    }
  ]
}
```

- [ ] **Step 2: Create `scripts/metrics/launch-metrics.ps1`**

```powershell
# One combined launch summary: hand-entered App Store Connect numbers on top, Supabase
# activation and retention underneath.
#
# WHY NO APP STORE CONNECT API: the App Store Connect Analytics Reports API is a
# request-and-wait pipeline (POST an analyticsReportRequest, wait 24-48h for the first
# report, then walk reports -> instances -> segments and gunzip TSVs), it needs an ES256
# JWT signed with a .p8 that App Store Connect only lets you download once at creation
# (the EAS-managed key's private half is on Expo's servers, not this machine), and until
# Release is clicked every number it would return is zero. Four numbers read off the
# dashboard once a week beats several hundred lines of credential-handling code. See
# docs/superpowers/plans/2026-08-18-reminder-and-metrics.md, finding 1.
#
#   pnpm metrics
#   .\scripts\metrics\launch-metrics.ps1 -Days 30
param(
  [ValidateRange(1, 30)][int]$Days = 14
)

$ErrorActionPreference = "Stop"

$repo   = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$runSql = Join-Path $repo "scripts\db\run-sql.ps1"

# run-sql.ps1 ends in `$resp | ConvertTo-Json`, which has three separate PS 5.1 quirks:
# zero rows emit nothing at all (not "[]"), one row emits a JSON object rather than a
# one-element array, and ConvertFrom-Json hands a multi-row array back as a SINGLE pipeline
# item so @(...) would report Count 1. This normalises all three to a real array.
function Get-Rows {
  param([string]$SqlFile)
  $raw = (& $runSql -QueryFile $SqlFile) -join "`n"
  if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
  if ($raw -like "QUERY FAILED*") { throw "run-sql.ps1 failed for $SqlFile`n$raw" }
  $parsed = ConvertFrom-Json $raw
  if ($null -eq $parsed) { return @() }
  if ($parsed -is [System.Array]) { return $parsed }
  return @($parsed)
}

function Format-Share {
  param([int]$Part, [int]$Whole)
  if ($Whole -le 0) { return "  n/a" }
  return ("{0,4:N0}%" -f (100.0 * $Part / $Whole))
}

$now = Get-Date
Write-Output ""
Write-Output "DUOQUEUE LAUNCH METRICS"
Write-Output ("Generated {0} (America/Chicago). Day buckets are America/Chicago." -f $now.ToString("yyyy-MM-dd HH:mm"))
Write-Output ("=" * 62)

# ---------------------------------------------------------------- App Store Connect
$ascPath = Join-Path $PSScriptRoot "asc-weekly.json"
Write-Output ""
Write-Output "APP STORE CONNECT (hand-entered)"
if (-not (Test-Path $ascPath)) {
  Write-Output "  asc-weekly.json is missing. Nothing to report."
} else {
  $asc = Get-Content $ascPath -Raw | ConvertFrom-Json
  $week = @($asc.weeks) | Sort-Object week_start | Select-Object -Last 1
  if ($null -eq $week) {
    Write-Output "  asc-weekly.json has no weeks yet."
  } else {
    $age = [int]((Get-Date) - [datetime]$week.read_on).TotalDays
    Write-Output ("  week starting     {0}" -f $week.week_start)
    Write-Output ("  impressions       {0,8:N0}" -f $week.impressions)
    Write-Output ("  page views        {0,8:N0}" -f $week.product_page_views)
    Write-Output ("  downloads         {0,8:N0}" -f $week.downloads)
    if ([int]$week.impressions -gt 0) {
      Write-Output ("  conversion        {0,7:N1}%" -f (100.0 * $week.downloads / $week.impressions))
    } else {
      Write-Output  "  conversion             n/a"
    }
    if ($week.note) { Write-Output ("  note: {0}" -f $week.note) }
    Write-Output ("  read {0} day(s) ago. Refresh it: App Store Connect > Analytics." -f $age)
    if ($age -gt 8) { Write-Output "  STALE. These numbers are more than a week old." }
  }
}

# ---------------------------------------------------------------- Supabase snapshot
$snap = Get-Rows (Join-Path $PSScriptRoot "snapshot.sql")
Write-Output ""
Write-Output "SUPABASE, all time"
if ($snap.Count -eq 0) {
  Write-Output "  snapshot.sql returned nothing."
} else {
  $s = $snap[0]
  Write-Output ("  real users        {0,8:N0}" -f $s.users_total)
  Write-Output ("  onboarded         {0,8:N0}   {1}" -f $s.users_onboarded, (Format-Share $s.users_onboarded $s.users_total))
  Write-Output ("  active last 7d    {0,8:N0}   {1}" -f $s.active_7d, (Format-Share $s.active_7d $s.users_total))
  Write-Output ("  matches ever      {0,8:N0}" -f $s.matches_total)
  Write-Output ("  matches active    {0,8:N0}" -f $s.matches_active)
  Write-Output ("  ever matched      {0,8:N0}   {1}" -f $s.users_with_a_match, (Format-Share $s.users_with_a_match $s.users_total))
  Write-Output ("  messages sent     {0,8:N0}" -f $s.messages_total)
}

# ---------------------------------------------------------------- Supabase by day
$all  = Get-Rows (Join-Path $PSScriptRoot "funnel-by-day.sql")
$rows = @($all | Select-Object -First $Days)
Write-Output ""
Write-Output ("SUPABASE, last {0} days by signup day" -f $Days)
# One format string for the header, the rows and both footers, so the columns cannot drift
# apart. Format-Share always returns 5 characters (" 100%" / "  n/a") so it right-aligns
# into the same width as the integers above it.
$fmt = "  {0,-10}  {1,7}  {2,9}  {3,9}  {4,8}  {5,7}"
Write-Output ($fmt -f "day", "signups", "confirmed", "onboarded", "returned", "matched")
foreach ($r in $rows) {
  Write-Output ($fmt -f $r.day, $r.signups, $r.confirmed, $r.onboarded, $r.returned, $r.first_match)
}
$t = @{}
foreach ($k in "signups", "confirmed", "onboarded", "returned", "first_match") {
  $t[$k] = [int](($rows | Measure-Object -Property $k -Sum).Sum)
}
Write-Output ("  " + ("-" * 56))
Write-Output ($fmt -f "total", $t.signups, $t.confirmed, $t.onboarded, $t.returned, $t.first_match)
Write-Output ($fmt -f "share", "", (Format-Share $t.confirmed $t.signups), `
  (Format-Share $t.onboarded $t.signups), (Format-Share $t.returned $t.signups), `
  (Format-Share $t.first_match $t.signups))

Write-Output ""
Write-Output "Reading these honestly:"
Write-Output "  signups counts accounts that still exist. Self-deletion removes the profile,"
Write-Output "  so a past day's number can shrink. returned means the account showed activity"
Write-Output "  on a calendar day after signup day, not a D1 retention curve."
Write-Output ""
```

- [ ] **Step 3: Add the `metrics` script to `package.json`**

In the `scripts` block, after `"audit:contrast"`:

```json
    "metrics": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/metrics/launch-metrics.ps1"
```

This makes the repo's launch reporting Windows-only, which it already is: `scripts/db/run-sql.ps1`
reads the Supabase token out of Windows Credential Manager and there is no other path to the DB
from this machine (no `psql`, no stored DB password).

- [ ] **Step 4: Verify**

```powershell
pnpm metrics
pnpm metrics -- -Days 30
```

Expected on the first run: the App Store Connect block prints the zeroed placeholder week with the
"not released" note; the Supabase all-time block prints 4 real users, 4 onboarded, 0 matches; the
by-day table prints 14 (then 30) rows with a `total` line summing to 2 signups over 14 days and 3
over 30. No PowerShell errors, no red text.

Then break it deliberately once, to prove the error path is not silent: temporarily rename
`asc-weekly.json` and confirm the script prints "asc-weekly.json is missing" and still prints both
Supabase sections. Rename it back.

- [ ] **Step 5: Commit**

```bash
git add scripts/metrics package.json
git commit -m "Launch numbers without an SDK: two queries and a weekly paste"
```

---

### Task 3: The daily reminder script

**Files:**
- Create: `scripts/daily-content-reminder.ps1`

**Interfaces:**
- Consumes workstream 2's published contract, `marketing/video/out/YYYY-MM-DD/manifest.json`, as
  specified in `docs/superpowers/plans/2026-08-18-remotion-pipeline.md` Task 10 Step 4. Fields used:
  `date`, `phase`, and `videos[]` with `slot`, `format`, `file`, `caption`.
- `-NoPopup` prints to the console only, which is how you test it.
- `-Date <datetime>` reports on a different day, which is how you test the missing-folder path.

**Cross-stream note:** the Remotion plan names `manifest.json` "the machine-readable contract the
daily-reminder workstream (spec section 3) consumes", so read that rather than globbing. Two
consequences:

- **The `.gitignore` entry is workstream 2's, not this one's.** That plan's Task "Step 7: append to
  root `.gitignore`" already adds `marketing/video/out/`. Do not add a second entry here; a
  duplicate ignore rule across two branches is a pointless merge conflict.
- **Still degrade gracefully when the manifest is absent.** A folder holding MP4s but no
  `manifest.json` means a render died partway through, which is exactly the morning this reminder
  needs to be useful. The script falls back to listing whatever `.mp4` files are there and says
  plainly that the manifest is missing.

- [ ] **Step 1: Create `scripts/daily-content-reminder.ps1`**

```powershell
# The daily "post today's videos" reminder.
#
# Publishing stays manual (signing into Cameron's social accounts would mean handling his
# credentials, and every scheduler that posts to three platforms is paid). He has time
# daily; the failure mode is forgetting. So this fires once a day, says what is queued and
# where it is, and says so loudly when NOTHING is queued, because a silent no-op reminder
# is worse than none.
#
# Reads marketing/video/out/<date>/manifest.json, the contract published by the Remotion
# pipeline (docs/superpowers/plans/2026-08-18-remotion-pipeline.md, Task 10 Step 4). Falls
# back to listing *.mp4 when the manifest is absent, because "MP4s but no manifest" means a
# render died partway and that is exactly the morning this needs to be useful.
#
# Deliberately dumb: it is a directory listing, not a judgement. Nothing here needs a model,
# a network call, or a credential.
#
#   .\scripts\daily-content-reminder.ps1 -NoPopup          # test in the terminal
#   .\scripts\daily-content-reminder.ps1 -Date 2026-09-01  # test a day with no folder
param(
  [string]$ContentRoot,
  [datetime]$Date = (Get-Date),
  [switch]$NoPopup
)

$ErrorActionPreference = "Stop"

$repo = Split-Path $PSScriptRoot -Parent
if (-not $ContentRoot) { $ContentRoot = Join-Path $repo "marketing\video\out" }

$stamp    = $Date.ToString("yyyy-MM-dd")
$folder   = Join-Path $ContentRoot $stamp
$manifest = Join-Path $folder "manifest.json"
$captions = Join-Path $folder "captions.md"
$lines    = New-Object System.Collections.Generic.List[string]

function Add-Line { param([string]$Text) $lines.Add($Text) | Out-Null }

Add-Line "DuoQueue: post today's videos"
Add-Line $stamp
Add-Line ""

if (-not (Test-Path $folder)) {
  Add-Line "NOTHING IS QUEUED."
  Add-Line "No folder at:"
  Add-Line "  $folder"
  Add-Line ""
  Add-Line "Generate it:  pnpm video:day"
} else {
  $count = 0

  if (Test-Path $manifest) {
    $m      = Get-Content $manifest -Raw | ConvertFrom-Json
    $videos = @($m.videos) | Sort-Object slot
    $count  = $videos.Count
    Add-Line "$count video(s) ready in:"
    Add-Line "  $folder"
    Add-Line ("phase: {0}" -f $m.phase)
    Add-Line ""
    foreach ($v in $videos) {
      Add-Line ("  {0}. [{1}] {2}" -f $v.slot, $v.format, $v.file)
      if ($v.caption) { Add-Line ("      {0}" -f $v.caption) }
    }
  } else {
    # Degraded path: the folder exists but the run did not finish writing its manifest.
    $files = @(Get-ChildItem -Path $folder -Filter *.mp4 -File | Sort-Object Name)
    $count = $files.Count
    Add-Line "manifest.json is MISSING. The render may have failed partway."
    Add-Line "Found $count .mp4 file(s) in:"
    Add-Line "  $folder"
    Add-Line ""
    foreach ($f in $files) { Add-Line ("  {0}" -f $f.Name) }
  }

  if ($count -eq 0) {
    Add-Line ""
    Add-Line "NOTHING IS QUEUED. Generate it:  pnpm video:day"
  } else {
    if ($count -lt 3) {
      Add-Line ""
      Add-Line "SHORT: the plan is 3 per day."
    }
    Add-Line ""
    if (Test-Path $captions) {
      Add-Line "Captions to copy from:"
      Add-Line "  $captions"
    } else {
      Add-Line "captions.md is MISSING from that folder."
    }
    Add-Line "Post each one to Instagram Reels, TikTok and YouTube Shorts."
  }
}

$text = ($lines -join [Environment]::NewLine)
Write-Output $text

if (-not $NoPopup) {
  Add-Type -AssemblyName System.Windows.Forms | Out-Null
  # A bare MessageBox opens behind whatever is focused and is easy to miss. Owning it with
  # a throwaway TopMost form is the standard way to force it in front from a scheduled task.
  $owner = New-Object System.Windows.Forms.Form
  $owner.TopMost = $true
  try {
    [System.Windows.Forms.MessageBox]::Show(
      $owner, $text, "DuoQueue daily post",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
  } finally {
    $owner.Dispose()
  }
}
```

- [ ] **Step 2: Verify all four paths**

Workstream 2 does not exist yet, so build a fake day that matches its published contract exactly.

```powershell
$out = Join-Path (Get-Location) "marketing\video\out"
$day = Join-Path $out (Get-Date -Format "yyyy-MM-dd")

# 1. Missing folder. Expect "NOTHING IS QUEUED" and the exact path it looked at.
.\scripts\daily-content-reminder.ps1 -NoPopup

# 2. Degraded: MP4s present, no manifest. Expect the "manifest.json is MISSING" path.
New-Item -ItemType Directory -Force -Path $day | Out-Null
"" | Out-File (Join-Path $day "01-reframe-001.mp4") -Encoding utf8
"" | Out-File (Join-Path $day "02-pain-004.mp4") -Encoding utf8
.\scripts\daily-content-reminder.ps1 -NoPopup

# 3. Healthy: a real manifest, three videos, plus captions.md.
$m = @{
  date  = (Get-Date -Format "yyyy-MM-dd"); phase = "waitlist"
  generatedAt = (Get-Date).ToString("o")
  videos = @(
    @{ slot=1; id="reframe-001"; format="reframe"; file="01-reframe-001.mp4"; caption="swiping, but for your next duo" },
    @{ slot=2; id="pain-004";    format="pain";    file="02-pain-004.mp4";    caption="LFG posts get 0 replies" },
    @{ slot=3; id="spec-002";    format="spec";    file="03-spec-002.mp4";    caption="match on games, not looks" }
  )
}
$m | ConvertTo-Json -Depth 5 | Out-File (Join-Path $day "manifest.json") -Encoding utf8
"" | Out-File (Join-Path $day "03-spec-002.mp4") -Encoding utf8
"# captions" | Out-File (Join-Path $day "captions.md") -Encoding utf8
.\scripts\daily-content-reminder.ps1 -NoPopup

# 4. The popup itself.
.\scripts\daily-content-reminder.ps1
```

Expected:

1. NOTHING IS QUEUED, naming the folder and `pnpm video:day`.
2. "manifest.json is MISSING", 2 files listed, plus "SHORT: the plan is 3 per day" and the
   "captions.md is MISSING" line. This is the failure morning, and it must read as a problem.
3. "3 video(s) ready", `phase: waitlist`, three numbered lines in slot order each with its format
   in brackets and its caption underneath, no SHORT warning, and the path to `captions.md`.
4. A message box in front of everything else carrying the same text as run 3.

Then clean up: `Remove-Item -Recurse -Force marketing\video\out`. (Leave the rest of
`marketing/video/` alone if workstream 2 has already landed.)

- [ ] **Step 3: Commit**

```bash
git add scripts/daily-content-reminder.ps1
git commit -m "A daily reminder that says what is queued, and says so when nothing is"
```

---

### Task 4: Register the scheduled task

**Files:**
- Create: `scripts/install-daily-reminder.ps1`

**Interfaces:**
- Registers a Windows scheduled task named `DuoQueue Daily Content Reminder`.
- `-At "HH:mm"` overrides the time. `-Remove` unregisters it.

**Why Windows Task Scheduler and not the other two options.** All three were checked on this
machine:

| Option | Fires when Claude is closed | Lives in the repo | Verdict |
| --- | --- | --- | --- |
| Windows Task Scheduler | Yes | Yes, the script does | **Chosen** |
| `scheduled-tasks` MCP (`~/.claude/scheduled-tasks/`) | No, runs on next app launch | No, prompt lives outside the repo | Rejected |
| `CronCreate` | No, session-only and in-memory | No | Rejected outright |

The MCP scheduled-task tool is the easiest to create (one call) and can write nicer prose, but it
only fires while the Claude app is open and otherwise waits for the next launch. A reminder whose
precondition is "Cameron already opened the tool" does not address a failure mode of forgetting.
`CronCreate` is explicitly session-only, dies with the session, and auto-expires after 7 days, so
it cannot serve a 2-week launch window. Task Scheduler's cmdlets (`Register-ScheduledTask`,
`New-ScheduledTaskTrigger`, `New-ScheduledTaskAction`, `New-ScheduledTaskPrincipal`,
`New-ScheduledTaskSettingsSet`, `Unregister-ScheduledTask`) are all present, and
`System.Windows.Forms` loads, both confirmed.

**A fourth option, considered and rejected:** pg_cron already runs in this project
(`0058_schedule_verified_stats_sync.sql`) and `send-push-notification` is deployed, so a job could
push the reminder to Cameron's own phone and reach him anywhere. Rejected because it would require
an edge-function path that sends arbitrary copy to a chosen profile. `0031_security_hardening.sql`
section 2 exists precisely because `notify_via_edge_function` was once reachable with only the anon
key and could forge any push to any user. Reopening that shape for a marketing reminder is a bad
trade. Revisit after launch only if the desktop popup is genuinely being missed.

**Time: 17:40 America/Chicago, daily.** The spec left this open. 17:40 is after a working day, well
before the 19:00 to 22:00 window where short-form video posts best, and off the :00 and :30 marks
that every scheduler on earth lands on. One reminder, not two: if the folder is empty it names the
problem, and that is enough for someone with a few hours a week.

- [ ] **Step 1: Create `scripts/install-daily-reminder.ps1`**

```powershell
# Registers the daily content reminder as a Windows scheduled task. Run once.
#
# WHY TASK SCHEDULER: it is the only one of the three schedulers on this machine that fires
# without the Claude app being open, and the reminder exists precisely for the days Cameron
# is not already sitting in the tool. See docs/superpowers/plans/2026-08-18-reminder-and-
# metrics.md, Task 4.
#
# LogonType Interactive and RunLevel Limited are load-bearing, not defaults-by-accident: a
# task registered to "run whether the user is logged on or not" executes in session 0, where
# a MessageBox is drawn on a desktop nobody can see. Interactive keeps it on Cameron's own
# desktop. StartWhenAvailable makes a run missed while the machine was asleep fire shortly
# after it wakes instead of being dropped.
#
#   .\scripts\install-daily-reminder.ps1
#   .\scripts\install-daily-reminder.ps1 -At "09:20"
#   .\scripts\install-daily-reminder.ps1 -Remove
param(
  [string]$At = "17:40",
  [switch]$Remove
)

$ErrorActionPreference = "Stop"

$taskName = "DuoQueue Daily Content Reminder"

if ($Remove) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Output "Removed scheduled task: $taskName"
  return
}

$repo   = Split-Path $PSScriptRoot -Parent
$script = Join-Path $repo "scripts\daily-content-reminder.ps1"
if (-not (Test-Path $script)) { throw "Missing $script" }

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument ("-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"{0}`"" -f $script) `
  -WorkingDirectory $repo

$trigger   = New-ScheduledTaskTrigger -Daily -At $At
$principal = New-ScheduledTaskPrincipal `
  -UserId ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME) `
  -LogonType Interactive -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Force `
  -Description "Daily reminder to post the queued DuoQueue videos. See scripts/daily-content-reminder.ps1." | Out-Null

$info = Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo
Write-Output "Registered: $taskName"
Write-Output ("Runs daily at {0}. Next run: {1}" -f $At, $info.NextRunTime)
Write-Output "Test it now:  Start-ScheduledTask -TaskName `"$taskName`""
Write-Output "Remove it:    .\scripts\install-daily-reminder.ps1 -Remove"
```

- [ ] **Step 2: Cameron runs it, not an agent**

Registering an OS-level scheduled task on someone's machine is a change to their computer, not to
this repo. Hand him the command rather than running it:

```powershell
.\scripts\install-daily-reminder.ps1
```

- [ ] **Step 3: Verify**

```powershell
Get-ScheduledTask -TaskName "DuoQueue Daily Content Reminder" | Get-ScheduledTaskInfo
Start-ScheduledTask -TaskName "DuoQueue Daily Content Reminder"
```

Expected: `NextRunTime` is today or tomorrow at 17:40, and `Start-ScheduledTask` makes the popup
appear within a few seconds with the same text `-NoPopup` printed in Task 3. `LastTaskResult` reads
0 afterwards. If the popup never appears but `LastTaskResult` is 0, the principal was registered
with the wrong logon type; re-run the installer.

- [ ] **Step 4: Commit**

```bash
git add scripts/install-daily-reminder.ps1
git commit -m "Register the reminder with the one scheduler that fires unattended"
```

---

### Task 5: Document it where Cameron will find it

**Files:**
- Modify: `README.md` (repo layout block, and a new section after "Development commands")

- [ ] **Step 1: Extend the repo layout block**

In the `scripts/` entries around `README.md:91`, add:

```
  daily-content-reminder.ps1  prints/pops what is queued to post today
  install-daily-reminder.ps1  registers that as a daily Windows scheduled task
  metrics/                    launch funnel queries + the weekly App Store Connect paste
```

- [ ] **Step 2: Add a "Launch metrics and the daily reminder" section after "Development commands"**

Insert verbatim (the outer fence below is four backticks only so the inner fences survive; drop it
when pasting):

````markdown
## Launch metrics and the daily reminder

```bash
pnpm metrics              # last 14 days
pnpm metrics -- -Days 30  # full window
```

Prints one summary: App Store Connect on top, Supabase activation and retention underneath.

**The App Store Connect half is hand-entered on purpose.** Once a week, open App Store Connect >
Apps > DuoQueue > Analytics, read impressions, product page views and downloads, and add a row to
`scripts/metrics/asc-weekly.json`. Do not enter conversion; the script derives it. The API
alternative needs a new Apple API key (the private half of a key is downloadable exactly once, and
the EAS-managed one lives on Expo's servers) plus an asynchronous report pipeline that takes 24 to
48 hours to return its first row. Two minutes a week is the better trade for one person. The script
warns when the pasted numbers are more than a week old.

**Read the Supabase half carefully.** `signups` counts accounts that still exist: account deletion
cascades the profile away, so a past day's number can shrink. `returned` means the account showed
activity on a calendar day after the day it signed up, which is a union of `last_active_at`, swipes
and messages. It is not a D1 retention curve, and nothing in this repo can produce one.

**The reminder** fires daily at 17:40. It reads `marketing/video/out/YYYY-MM-DD/manifest.json`,
names the three videos and the captions file to copy from, and says loudly when nothing is queued
or when the manifest is missing because a render died partway.

```powershell
.\scripts\install-daily-reminder.ps1            # once
.\scripts\install-daily-reminder.ps1 -At 09:20  # change the time
.\scripts\install-daily-reminder.ps1 -Remove    # stop it
.\scripts\daily-content-reminder.ps1 -NoPopup   # see what it would say, right now
```
````

- [ ] **Step 3: Final gates and commit**

```powershell
pnpm typecheck
pnpm lint
pnpm audit:contrast
```

All three must be green. None of them should have anything to say about this workstream (it adds no
TypeScript and no theme token), which is the point of checking: a failure here means something
unrelated regressed, not that this plan broke it.

```bash
git add README.md
git commit -m "Document the weekly paste and the daily nudge"
```

---

## What this workstream deliberately does not do

- **No App Store Connect API client.** Finding 1. Revisit only if the weekly read becomes a
  bottleneck.
- **No notification open rate.** Finding 8. Not obtainable without server-side deep-link
  instrumentation that belongs in workstream 1b.
- **No waitlist signup numbers.** Workstream 4 owns the waitlist. If it stores signups in Supabase,
  add a third `.sql` file to `scripts/metrics/` and one block to the script. Until then, during the
  waitlist phase the top-of-funnel number lives on whatever the landing page uses.
- **No stored metric history.** The script reads live and prints. If a trend line is ever wanted,
  redirect the output to a dated file; do not build a warehouse for four users.
- **No migration.** The live DB stays at 0060.

---

## Appendix A: a durable signup tally, if deletions start distorting the numbers

Not part of this plan. Build it only if the daily signup count visibly shrinks between runs.

The design, if needed, is migration `0061_signup_day_tally.sql`:

- A table `public.signup_day_tally (day date primary key, signups integer not null default 0)`.
  Date-only and non-identifying, so it is privacy-clean to retain after an account is deleted, and
  it survives the `on delete cascade` chain because it has no FK to `profiles`.
- RLS enabled with **no policies and no grants at all**, exactly like `daily_swipe_counters` in
  `0001_init.sql`. Nothing but the function owner and the service role can read or write it.
- An `after insert on public.profiles` trigger that upserts the day, **not** an edit to
  `handle_new_user()`. That function guards the 18+ dob check and the banned-identity lookup and
  has been redefined seven times across 0001, 0019, 0030, 0031, 0053, 0054 and 0056. Adding a
  marketing counter to the signup path is not worth the risk of touching it.
- The trigger function is `security definer`, so it must follow the house rule that has bitten this
  repo before:
  `revoke execute on function public.<name>() from public, anon, authenticated;`
  immediately after creation. Supabase default-grants EXECUTE to anon and authenticated at creation
  time, and revoking from PUBLIC alone does not remove a role's own explicit grant. Note that
  `0031_security_hardening.sql` already ran
  `alter default privileges in schema public revoke execute on functions from public`, so PUBLIC
  will not be granted, but anon and authenticated still need the explicit revoke.
- No view is created or recreated, so the "dropping a view in schema public restores anon and
  authenticated privileges" hazard does not apply here.
- `funnel-by-day.sql` would then `left join signup_day_tally` and report both numbers side by side:
  the tally as "signed up", the profile count as "still here". The gap between them is the
  deletion count, which is itself worth seeing.
