-- 0061: the pre-launch waitlist.
--
-- DuoQueue is approved by Apple and deliberately unreleased. Three ad campaigns already
-- point at duoqueue.io, and the whole point of holding the manual release is that a list
-- fills first, so that on launch day everyone arrives inside the same 48 hours and the
-- first person to open the deck finds somebody on the other side of it. This migration is
-- the storage half of that: one table for the addresses, one for abuse accounting.
--
-- WHY BOTH `enable row level security` AND `revoke all` ARE HERE, AND WHY NEITHER IS
-- REDUNDANT.
--
-- 0052 ran `alter default privileges in schema public revoke insert, update, delete,
-- truncate, references, trigger on tables from anon, authenticated`. Read the list: SELECT
-- is not in it. Confirmed against the live cluster's pg_default_acl, which still grants
-- `anon=rm/postgres` on new tables in this schema. So a table created by this file is born
-- readable by the anonymous role, RLS is the only thing standing between it and the open
-- internet, and PostgREST will advertise it in its OpenAPI document and answer `[]` rather
-- than 404 to a prober who guesses the name.
--
-- RLS with zero policies already returns zero rows. The revoke is what makes a future
-- `alter table ... disable row level security` -- typed in a hurry, in a dashboard, at
-- midnight -- a no-op instead of a disclosure of every address ever collected here. This
-- is the one table in the database where that specific accident has that specific cost, so
-- it gets both. 0047_admin_audit_log.sql:102 set the pattern; note that it re-grants
-- select/insert to `authenticated` on the next line and this file deliberately does not.
-- After this migration these are the first genuinely zero-grant tables in the schema.
--
-- Naming `public`, `anon` AND `authenticated` all three matters: revoking from PUBLIC does
-- not remove a role's own explicit grant.
--
-- Only the service role reads or writes either table, from the `waitlist-signup` Edge
-- Function and from local operator scripts. The service role bypasses RLS, so there is no
-- SECURITY DEFINER function here and none of the grant hazards 0031/0041/0057 had to clean
-- up can arise. That is a design goal, not an accident.

-- ---------------------------------------------------------------------------
-- The list itself.
-- ---------------------------------------------------------------------------
--
-- `source` is the only field a stranger can influence, and it is constrained to four
-- values rather than left as free text: the site publishes /tt/, /ig/ and /yt/ as separate
-- short paths whose only difference is a hidden input, which is how this project gets
-- per-channel attribution with no analytics SDK, no cookie and no query-string JavaScript.
--
-- The shape constraints restate what the Edge Function already validates. That duplication
-- is on purpose: the function is the thing that can be redeployed by hand at 2am, and the
-- constraint is the thing that cannot be forgotten. `email = lower(email)` in particular
-- makes the unique index below a genuine one-signup-per-person guarantee rather than a
-- guarantee about whichever casing arrived first.
--
-- No IP address column, by design. Attribution to a person stops at the address they typed
-- and the link they came from, which is exactly what the privacy policy now describes.
create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'direct',
  created_at timestamptz not null default now(),
  -- Lifecycle of the single welcome email. `deferred` is the important one: it means the
  -- row was stored but the day's send budget was already spent, which is a recoverable
  -- state, not a lost signup. See the budget note in the Edge Function.
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

-- Carries the `on conflict (email) do nothing` that collapses a duplicate signup into a
-- silent success. Without it a second submission of the same address would either send a
-- second welcome email or return an error that tells a prober whether an address is on
-- the list; with it, neither is observable from outside.
create unique index waitlist_signups_email_key on public.waitlist_signups (email);
create index waitlist_signups_created_at_idx on public.waitlist_signups (created_at);
create index waitlist_signups_welcome_status_idx on public.waitlist_signups (welcome_status);

alter table public.waitlist_signups enable row level security;
revoke all on public.waitlist_signups from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Abuse accounting.
-- ---------------------------------------------------------------------------
--
-- One row per REQUEST, written before any decision is made, so that rejected attempts
-- count toward the limit and a script cannot get unlimited free tries by sending garbage.
--
-- `ip_hash` is sha256(WAITLIST_IP_SALT || first hop of X-Forwarded-For), never the address
-- itself, and it is kept for 48 hours. The salt is an Edge Function secret and is not in
-- the database, so a copy of this table on its own does not let anyone test a candidate IP.
--
-- Deliberately a separate table from `rate_limit_hits` (0048): that one is keyed on a
-- profile id and exists to bound authenticated users, and this one is keyed on a hash of a
-- network address belonging to someone with no account at all. Sharing it would mean the
-- public form could evict a real user's rate-limit history, and the retention windows
-- differ by a factor of twenty-four.
create table public.waitlist_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index waitlist_attempts_ip_hash_created_at_idx
  on public.waitlist_attempts (ip_hash, created_at);

alter table public.waitlist_attempts enable row level security;
revoke all on public.waitlist_attempts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retention backstop.
-- ---------------------------------------------------------------------------
--
-- The function prunes this hash's own old rows on every call, which is bounded and indexed
-- and handles the ordinary case. This job is what guarantees the 48 hour promise in the
-- privacy policy when the form goes quiet: hashes from the last burst of traffic would
-- otherwise sit there until the next request arrived, which could be days.
--
-- :45 because it is the only free slot. Live schedule at the time of writing: :00
-- daily-swipes-refreshed-hourly, :15 rate_limit_hits_cleanup_hourly (0048), :00/:30
-- reengagement-nudges-half-hourly, 40 */6 verified-stats-sync-six-hourly (0058). Verified
-- against cron.job rather than read off the migrations.
select cron.schedule(
  'waitlist_attempts_cleanup_hourly',
  '45 * * * *',
  $$delete from public.waitlist_attempts where created_at < now() - interval '48 hours'$$
);

-- ---------------------------------------------------------------------------
-- Kill switch.
-- ---------------------------------------------------------------------------
--
-- Same runtime-config pattern as `edge_function_base_url` and `internal_trigger_token`.
-- One UPDATE closes the form without a redeploy, which is what you want at 11pm on launch
-- night or if the endpoint is ever being hammered:
--
--   update public.app_config set value = 'false' where key = 'waitlist_open';
--
-- Anything other than the exact string 'true' closes it, so a typo fails closed.
insert into public.app_config (key, value) values ('waitlist_open', 'true')
on conflict (key) do nothing;
