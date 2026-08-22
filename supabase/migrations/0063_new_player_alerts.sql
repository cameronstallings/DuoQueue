-- 0063: the new-player ping. When somebody who plays your games joins, you hear about it.
--
-- (The plan that specifies this file, docs/superpowers/plans/2026-08-18-low-density-fixes.md,
-- calls it 0062, and calls the schedule that follows it 0063. 0061 was taken by
-- 0061_waitlist.sql and the deck gates landed as 0062, so both files shift up by one. Nothing
-- else about the plan changes.)
--
-- WHY THIS EXISTS. DuoQueue launches with four real users. At that density an install lands
-- in an empty deck, and an empty deck is churn: the person leaves, and the thing that would
-- have brought them back -- somebody new to swipe on -- happens on the server while the app
-- is closed. This file inverts that. Every completed signup becomes a reason to re-open the
-- app for whoever was already here and plays the same game, so acquisition compounds into
-- retention instead of leaking out of it.
--
-- ============================================================================
-- D1. A TRIGGER STAMPS, CRON DELIVERS. NOT A FAN-OUT FROM THE SIGNUP.
-- ============================================================================
--
-- The obvious shape is the one notify_looking_now (0038) uses: fan out pg_net posts from the
-- trigger. Rejected here, for four reasons that all come back to this fan-out not being
-- bounded the way that one is.
--
--   * notify_looking_now's loop is bounded by the toggler's match count. This one would be
--     bounded by "everyone who plays Valorant", and it would run inside the UPDATE that
--     completes onboarding -- the single most important write in the funnel.
--     notify_via_edge_function swallows errors, but it does not swallow time.
--   * No batching. Three signups in an hour is three separate pushes to the same person.
--     A recipient-centric sweep collapses that into "3 new players joined".
--   * No quiet hours. A trigger fires when the NEW user finishes, which is when they are
--     awake, not when the recipient is. Suppressing a 3am push from a trigger needs a queue,
--     and once you have a queue you have written the sweep.
--   * No retry. pg_net from a trigger is fire-and-forget. A failed sweep simply runs again
--     next hour, and the ledger below is what stops it double-sending.
--
-- So: the trigger records WHEN onboarding finished, and nothing else. Delivery is an hourly
-- sweep (0064) that asks get_new_player_alert_batch who to tell.
--
-- Also rejected: impersonating the recipient with set_config('request.jwt.claims', ...) inside
-- a service-role transaction, so the sweep could literally call get_deck and duplicate no
-- predicate at all. It works, and a SECURITY DEFINER function that sets JWT claims is one
-- refactor away from being an authorization bypass. Not in this schema.
--
-- ============================================================================
-- D2. "OVERLAPPING GAMES" MEANS AT LEAST ONE SHARED game_id
-- ============================================================================
--
-- The same join get_deck's shared_games CTE uses for scoring, so "overlap" in the
-- notification means exactly what it means in the deck. Shows are deliberately excluded: a
-- shared anime is a weaker signal than a shared game for a co-op matching app.
--
-- The game NAMED in the push is the recipient's highest-priority shared game
-- (order by mine.priority asc), so the copy leads with the game they cared about most when
-- they onboarded.
--
-- Known limitation, accepted: games.is_custom means two people can type the same game as two
-- different rows and fail to overlap. That is a pre-existing catalog problem which affects
-- deck scoring identically today, and under-notifying is the safe direction.
--
-- ============================================================================
-- D3. OVERLAP IS NECESSARY BUT NOT SUFFICIENT -- THE NEW PLAYER MUST BE VISIBLE
-- ============================================================================
--
-- A push that leads to an empty deck is the exact failure this workstream exists to remove.
-- So a new player is only announced to a recipient if that new player would actually appear
-- in that recipient's deck: both deck gates from 0062 are applied per pair. That is a
-- duplication of get_deck's predicate, and 0062's header states both the cost and the
-- obligation -- change get_deck's WHERE clause, change those two functions in the same
-- migration.
--
-- ============================================================================
-- D4. FOUR INDEPENDENT RATE LIMITS, PLUS QUIET HOURS. ALL OF THEM IN SQL.
-- ============================================================================
--
--   1. PER-RECIPIENT COOLDOWN, 24 HOURS. One new-player push per person per day, maximum,
--      forever. Enforced by the `not exists (... sent_at > now() - interval '24 hours')`
--      predicate in eligible_recipients.
--   2. PER-PAIR DEDUPE, PERMANENT. new_player_alerts' primary key IS this limit: a given new
--      player is announced to a given recipient at most once, ever, regardless of retries,
--      replays or a scheduler double-fire. It cannot be bypassed by a bug in TypeScript.
--   3. ANNOUNCEMENT WINDOW, 48 HOURS. Only profiles that finished onboarding in the last 48h
--      are announceable. Comfortably longer than the cooldown, so a signup that lands during
--      a recipient's cooldown still gets announced on the next eligible sweep; short enough
--      that the sweep never degenerates into "everyone you have not been told about", which
--      is just the deck with extra steps.
--   4. PER-RUN RECIPIENT CAP, 200 by default, clamped 1..1000 in SQL. One run can never fan
--      out unboundedly; overflow is picked up next hour. Ordered by new-player count
--      descending so the most-affected recipients are served first.
--
-- QUIET HOURS: only recipients whose LOCAL hour is 10..20 inclusive (a 10:00-21:00 window).
-- profiles.timezone is a validated IANA name (profiles_timezone_valid, 0031) but is nullable
-- (handle_new_user writes NULL when Intl hands up something invalid), so the fallback is
-- America/New_York -- the LATEST US zone, which means a user with a null timezone can never
-- be pushed after 21:00 local no matter where they actually are. Because the sweep is hourly
-- and the window is eleven hours wide, deferring costs a few hours at most, never the
-- notification itself.
--
-- Why all five live here rather than in the Edge Function: a firehose bug is a
-- mass-notification incident and, unlike a bad screen, it cannot be recalled. A bug in the
-- TypeScript must not be able to widen any of them. The kill switch, for the 2am version of
-- this problem, is:  select cron.unschedule('new-player-alerts-hourly');
--
-- ============================================================================
-- ORDER OF APPLICATION
-- ============================================================================
--
-- 0064 (the cron schedule) must NOT be applied until send-new-player-alerts is deployed and
-- hand-fired successfully. Scheduling a post to a route that 404s buys nothing but an hour of
-- confusing rows in net._http_response. Same reason 0058 was its own file.

-- ---------------------------------------------------------------------------
-- 1. When onboarding finished.
-- ---------------------------------------------------------------------------
--
-- DELIBERATELY NOT BACKFILLED. Every existing profile keeps NULL and the sweep requires
-- non-null, so nobody already on the platform is retro-announced to anybody. Announcing the
-- four current users to each other would be false ("just joined") and pointless (they have
-- already seen each other's decks).
--
-- No write access for the client, by inheritance and then again explicitly. 0031 replaced
-- profiles' table-wide UPDATE grant with a column allow-list (display_name, bio, gender,
-- region, hide_last_active, is_active, onboarding_completed, usual_play_start_hour,
-- usual_play_end_hour, discord_username) that this column is not part of, and there is no
-- INSERT policy on profiles at all, so a client can neither update this column nor insert a
-- row carrying it. The REVOKE restates that, the same belt-and-suspenders 0059 used for
-- is_demo -- because a user who could stamp themselves could farm notifications by
-- re-stamping, and 0031's is_admin incident is the reason this schema does not rely on
-- "well, nothing grants it".
alter table public.profiles add column onboarding_completed_at timestamptz;

revoke update (onboarding_completed_at) on public.profiles from authenticated;

-- Partial: the sweep only ever asks for non-null values inside a 48 hour window, and the
-- overwhelming majority of rows will be NULL for the life of this index.
create index profiles_onboarding_completed_at_idx
  on public.profiles (onboarding_completed_at)
  where onboarding_completed_at is not null;

-- The false -> true guard means a later profile edit cannot re-stamp, so the 48 hour
-- announcement window is anchored to the real event and not to whenever somebody last
-- touched their bio.
create or replace function public.stamp_onboarding_completed_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.onboarding_completed = true
     and coalesce(old.onboarding_completed, false) = false then
    new.onboarding_completed_at := now();
  end if;
  return new;
end;
$fn$;

-- Postgres checks EXECUTE on a trigger function at CREATE TRIGGER time, not at fire time, so
-- this revoke does not stop the trigger -- it stops anyone calling the function directly.
-- notify_looking_now (0038) already proves the pattern in this schema.
revoke execute on function public.stamp_onboarding_completed_at() from public, anon, authenticated;

-- `of onboarding_completed` restricts firing to statements that actually assign that column,
-- the same narrowing 0038 used for is_looking_now, so heartbeat()'s last_active_at write and
-- every settings PATCH skip it entirely.
--
-- THE NAME IS LOAD-BEARING. Postgres fires BEFORE-row triggers in name order, and profiles
-- carries enforce_verified_email_before_visible_trigger, which RAISES on this exact
-- false -> true transition when the email is unverified. "stamp_..." sorts after
-- "enforce_..." (and after set_profiles_updated_at), so the email guard runs first and an
-- unverified account is never stamped, and therefore never announced. Checked against
-- pg_trigger on the live database, not assumed.
create trigger stamp_onboarding_completed_at_trigger
  before update of onboarding_completed on public.profiles
  for each row execute function public.stamp_onboarding_completed_at();

-- ---------------------------------------------------------------------------
-- 2. The preference (D5).
-- ---------------------------------------------------------------------------
--
-- Default true, like every other category: it is the only way the feature reaches the four
-- existing users without asking them, and the OS-level push permission is the real consent
-- gate. A boolean column rather than an enum or a table, the precedent 0038 set for exactly
-- this situation.
--
-- Named new_player, not new_signup or new_match_available: "player" is the app's own
-- vocabulary, it carries no dating connotation (this is an 18+ PLATONIC app that was rejected
-- once under App Store guideline 2.3.6), and it reads correctly as a settings row label.
--
-- No new grants needed. notification_settings still carries 0001's table-wide grant to
-- authenticated, scoped to the caller's own row by notification_settings_all_own, and a
-- table-level grant covers columns added later. Verified live rather than read off the
-- migrations.
alter table public.notification_settings add column new_player boolean not null default true;

-- ---------------------------------------------------------------------------
-- 3. The ledger. This table IS rate limits 1 and 2.
-- ---------------------------------------------------------------------------
--
-- The composite primary key is the permanent per-pair dedupe: an INSERT of a pair that has
-- already been announced conflicts, so a retry, a replay or a double-fired scheduler cannot
-- produce a second push. sent_at plus the recipient index is the 24 hour cooldown.
create table public.new_player_alerts (
  recipient_id   uuid not null references public.profiles (id) on delete cascade,
  new_profile_id uuid not null references public.profiles (id) on delete cascade,
  sent_at        timestamptz not null default now(),
  primary key (recipient_id, new_profile_id)
);

-- Serves the cooldown probe, which is per recipient and ordered by recency.
create index new_player_alerts_recipient_sent_at_idx
  on public.new_player_alerts (recipient_id, sent_at desc);

-- Service-role only. RLS with zero policies already returns zero rows to every client role.
--
-- THE REVOKE IS NOT REDUNDANT, and "no grants" is not what a bare CREATE TABLE gives you in
-- this schema. 0052 ran `alter default privileges ... revoke insert, update, delete,
-- truncate, references, trigger on tables from anon, authenticated` -- read the list, SELECT
-- is not in it -- so pg_default_acl still hands `anon=rm/postgres` to every new table here.
-- Measured, not assumed: has_table_privilege('anon','public.match_nudges','select') is TRUE
-- today, and match_nudges (0038) was written under the same service-role-only intent this
-- table is. Without this line the table is born readable by the anonymous role, PostgREST
-- advertises it in its OpenAPI document, and one hurried `disable row level security` turns a
-- record of who-was-told-about-whom into a public endpoint. 0061 established this reasoning
-- for the waitlist tables; this is the second application of it.
alter table public.new_player_alerts enable row level security;
revoke all on public.new_player_alerts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The batch query: who should be told about whom, right now.
-- ---------------------------------------------------------------------------
--
-- RECIPIENT-CENTRIC, one row per person to notify, carrying the list of new players so the
-- ledger can be written for each of them and the copy can say "3 new players joined" instead
-- of sending three separate pushes.
--
-- BOTH SIDES MUST BE NON-DEMO. A demo profile announced to a real user is exactly the
-- deception 0059 exists to prevent, and pushing to a review account has no purpose.
--
-- REQUIRING A push_tokens ROW keeps recipients who never granted permission out of the ledger
-- entirely, so their 24 hour cooldown is not burned on a notification that was never going to
-- arrive. It also means the feature's reach is bounded by the push-permission grant rate,
-- which is a real limit worth watching.
--
-- PREDICATE ORDER IS DELIBERATE. The game-overlap EXISTS is the selective one and is written
-- before the two gate calls so the planner has an indexed join to lead with; the gates are
-- SECURITY DEFINER and therefore cannot be inlined, so they run last, only on pairs that
-- already look plausible.
--
-- SCALE CEILING, STATED HONESTLY: this is eligible_recipients x recent_players gate calls per
-- run. Fine into the low thousands of recipients. Past roughly 10k the fix is to inline the
-- gate predicates as joins here. Revisit then, not now.
create or replace function public.get_new_player_alert_batch(p_max_recipients integer default 200)
returns table (
  recipient_id     uuid,
  new_profile_ids  uuid[],
  new_player_count integer,
  headline_game    text
)
language sql
stable
security definer
set search_path = public
as $fn$
  with recent_players as (
    -- Rate limit 3: the 48 hour announcement window.
    select n.id
    from public.profiles n
    where n.onboarding_completed_at is not null
      and n.onboarding_completed_at > now() - interval '48 hours'
      and n.onboarding_completed = true
      and n.is_active = true
      and n.is_banned = false
      and n.is_admin_suspended = false
      and n.is_demo = false
  ),
  eligible_recipients as (
    select r.id
    from public.profiles r
    join public.notification_settings ns on ns.profile_id = r.id
    where r.onboarding_completed = true
      and r.is_active = true
      and r.is_banned = false
      and r.is_admin_suspended = false
      and r.is_demo = false
      -- D5: the toggle, honoured in SQL so a bug in the Edge Function cannot ignore it.
      and ns.new_player = true
      and exists (select 1 from public.push_tokens t where t.profile_id = r.id)
      -- Rate limit 1: the 24 hour per-recipient cooldown.
      and not exists (
        select 1 from public.new_player_alerts a
        where a.recipient_id = r.id and a.sent_at > now() - interval '24 hours'
      )
      -- Quiet hours, in the RECIPIENT's local time.
      and extract(hour from (now() at time zone coalesce(r.timezone, 'America/New_York')))
            between 10 and 20
  ),
  pairs as (
    select
      er.id as recipient_id,
      rp.id as new_profile_id,
      (select g.name
         from public.profile_games mine
         join public.profile_games theirs on theirs.game_id = mine.game_id
         join public.games g on g.id = mine.game_id
        where mine.profile_id = er.id and theirs.profile_id = rp.id
        order by mine.priority asc
        limit 1) as shared_game_name
    from eligible_recipients er
    join recent_players rp on rp.id <> er.id
    -- D2: at least one shared game.
    where exists (
        select 1 from public.profile_games mine
        join public.profile_games theirs on theirs.game_id = mine.game_id
        where mine.profile_id = er.id and theirs.profile_id = rp.id
      )
      -- Rate limit 2: never announce the same pair twice.
      and not exists (
        select 1 from public.new_player_alerts a
        where a.recipient_id = er.id and a.new_profile_id = rp.id
      )
      -- D3: and the new player has to actually be in this recipient's deck.
      and public.deck_gate_hard(er.id, rp.id)
      and public.deck_gate_preferences(er.id, rp.id)
  )
  select
    p.recipient_id,
    array_agg(p.new_profile_id order by p.new_profile_id),
    count(*)::int,
    (array_agg(p.shared_game_name order by p.new_profile_id))[1]
  from pairs p
  group by p.recipient_id
  order by count(*) desc, p.recipient_id
  -- Rate limit 4: the per-run cap, clamped here rather than trusted from the caller.
  limit greatest(least(coalesce(p_max_recipients, 200), 1000), 1);
$fn$;

-- Supabase's default privileges grant EXECUTE to anon, authenticated AND service_role at
-- creation, and revoking from PUBLIC does not remove a role's own explicit grant -- the
-- mistake 0013 made and 0041 had to clean up. The service_role grant back is redundant
-- against those same defaults today and is stated anyway so the intent survives a
-- default-privileges change, matching check_rate_limit_service (0048).
revoke execute on function public.get_new_player_alert_batch(integer) from public, anon, authenticated;
grant execute on function public.get_new_player_alert_batch(integer) to service_role;
