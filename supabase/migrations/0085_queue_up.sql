-- 0085: Queue Up. Duo Pops (a ping to up to 6 players in your game, the first to tap I'm in is
-- your duo) and Duo Call (an LFG post with a code that only works while you are queued).
--
-- WHAT IT IS FOR. DuoQueue 1.0.2 (build 19) replaces the deck header's "Online" link and the
-- free-to-duo switch with one "Queue up" button. One tap does three things: it marks you free
-- to duo for an hour (exactly what set_looking_now(true) writes, so 0074's push to your matches
-- follows under its own rules), it sends a Duo Pop to up to 6 opted-in players in your game,
-- and it mints a call code for an LFG post you can share anywhere. This file is the whole
-- server half. The client half is Group Q of docs/superpowers/plans/2026-10-15-build-19.md;
-- the push half is send-push-notification's new duo_pop event and new_match enrichment (S3).
--
-- Depends on 0071 (server_group), 0072 (like alerts), 0080 (push_log), 0083 (the DEFERRABLE
-- like-alert trigger, which is what lets answer_duo_pop write two likes and a match without a
-- stray "Someone wants to duo with you"). Apply after 0084.
--
-- ============================================================================
-- SAFE FOR THE 1.0.1 APP IN THE STORE
-- ============================================================================
--
--   * notification_settings.queue_pop is NOT NULL DEFAULT false and nothing backfills it:
--     everyone starts opted out (App Store 4.5.4, push for marketing-like use needs consent).
--     1.0.1 selects * from that table and ignores a column it does not know; it cannot set it.
--   * queue_ups is reachable only through the functions below (RLS on, no policies, no client
--     grant). 1.0.1 calls none of them.
--   * resolve_invite_code and accept_invite are rebuilt from their LIVE definitions with the
--     same signatures, RETURNS and ACLs. A permanent invite code behaves exactly as before; the
--     only new path is a code that is not anyone's permanent code (see section 6).
--   * The new_match push is enriched only for a match that came out of a Duo Pop, which only a
--     1.0.2 phone can start.
--
-- ============================================================================
-- WHAT IS HERE
-- ============================================================================
--
--   1. notification_settings.queue_pop (the opt-in, "Duo Pops" in Settings > Notifications).
--   2. public.queue_ups: one row per Queue up tap. Its id is the push's popId.
--   3. Helpers, no client grant: generate_call_code(), duo_pop_pair_ok(), duo_pop_clock_ok(),
--      duo_pop_recipients(), queue_up_out().
--   4. The sender's RPCs: start_queue_up(game, ping), get_my_queue_up(), stop_queue_up().
--   5. The recipient's RPCs: get_duo_pop(pop), answer_duo_pop(pop, accept).
--   6. Duo Call through the existing invite plumbing: resolve_invite_code and accept_invite
--      rebuilt, and call_code_ended(code) for the "That Duo Call has ended" line.
--   7. Account deletion and retention: a BEFORE DELETE trigger on profiles takes the deleted id
--      out of every queue_ups array (App Store 5.1.1(v)); prune_queue_ups() deletes rows older
--      than 30 days, daily at 09:57 UTC (queue-ups-prune-daily; :57 is unused on cron.job,
--      read 15 Oct 2026).
--
-- ============================================================================
-- WHO GETS A DUO POP (duo_pop_recipients), AT MOST 6, ALL OF:
-- ============================================================================
--
--   not the sender; onboarded, active, not banned, not suspended; is_demo equal to the
--   sender's (the App Review account never pops a real player); both in server_group 'na';
--   a notification_settings row with queue_pop = true (a MISSING row is not opted in, the
--   opposite of notifyProfile's default); the game on their profile; at least one push token;
--   same_age_band; not blocked either way; no pass either way; no matches row of any kind
--   between them (a live match has its chat, an unmatched one said no); no report either way;
--   each side's age-range setting admits the other's age (floored at 18 as
--   deck_gate_preferences does); the whole 10-minute pop inside 10:00-00:59 on their clock
--   (duo_pop_clock_ok: a fan-out from 10:00 to 00:49, Cameron's decision 6, a Duo Pop never
--   ARRIVES between 01:00 and 09:59; the push's ttl is the seconds the pop has left, so it
--   cannot land after the pop closes); no Duo Pop received in the last 3 hours and fewer than 3
--   in the last 24; not someone who tapped Not now on THIS sender's pop in the last 7 days.
--   Order: can duo by rank (League only: lol_solo_duo_eligible true, then unknown, then false;
--   every other game ties), then free to duo right now, then most recently seen, then random.
--
-- WHO MAY SEND ONE (start_queue_up), on top of being onboarded and in North America:
--   a day past setup (a throwaway account cannot ping strangers the minute it exists), no report
--   against them in the last 30 days, and at most 3 queue-ups with pops in 24 hours. A sender
--   who fails any of these is still queued (their matches see them, the call code works); the
--   row's pop_note says why nobody was pinged, and the app says it honestly.
--
-- Two locks. start_queue_up and stop_queue_up first lock the caller's own profiles row, so one
-- sender's calls run one at a time: a double tap, or a script firing the RPC in parallel, gets
-- one queue-up and one fan-out, and the second call sees the first's committed row and answers
-- already_queued (without it, every parallel call passed the live-row and 3-a-day checks before
-- any of them had committed, and each popped 6 more players). Then the fan-out itself runs
-- under one transaction-scoped advisory lock, so two senders tapping at once cannot both pick
-- the same recipient past the 3-hour and 3-a-day caps.
--
-- ============================================================================
-- TWO DEPARTURES FROM THE PLAN, ON PURPOSE
-- ============================================================================
--
-- 1. The plan's recipient rule was local_hour_within(r.timezone, 10, 0), which lets a pop go out
-- at 00:59 and, with a 10-minute ttl, land after 01:00, against decision 6 ("never arrive").
-- duo_pop_clock_ok asks the same of the pop's last minute as of its first.
--
-- 2. The plan asked for `(locked_at is null) = (locked_by is null)`. locked_by references profiles
-- ON DELETE SET NULL, so deleting the locker's account would set locked_by to null with
-- locked_at still set, fail that check, and so fail the account deletion itself. The constraint
-- here is one-way: locked_by implies locked_at. A pop whose locker deleted their account keeps
-- its locked_at (it was taken; it must never reopen), and reads as "taken" to everyone.
--
-- ============================================================================
-- KILL SWITCHES (the 2am version)
-- ============================================================================
--
--   Stop every Duo Pop now, keep Queue up:   update public.notification_settings set queue_pop = false where queue_pop;
--   Stop Queue up entirely (the app says     revoke execute on function public.start_queue_up(uuid, boolean) from authenticated;
--     "Queue Up isn't ready yet"):
--   Stop the retention sweep:                select cron.unschedule('queue-ups-prune-daily');
--
-- Checks: supabase/checks/0085_queue_up.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. The opt-in
-- ---------------------------------------------------------------------------
-- No backfill: everyone starts opted out. notification_settings has table-level grants, so the
-- owner's own row is updatable by the 1.0.2 app through notification_settings_update_own like
-- every other switch (asserted by the check).
alter table public.notification_settings
  add column if not exists queue_pop boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. queue_ups
-- ---------------------------------------------------------------------------
create table if not exists public.queue_ups (
  id             uuid primary key default gen_random_uuid(),
  sender_id      uuid not null references public.profiles (id) on delete cascade,
  game_id        uuid not null references public.games (id) on delete cascade,
  -- What the sender asked for ("Ping players"), not whether anyone was pinged: see pop_note.
  ping           boolean not null,
  created_at     timestamptz not null default now(),
  -- created_at + 10 minutes: how long a pop can be answered.
  pop_expires_at timestamptz not null,
  -- created_at + 60 minutes, equal to the looking_now_expires_at written at start.
  looking_until  timestamptz not null,
  -- Set by stop_queue_up. A row is LIVE while ended_at is null and looking_until > now().
  ended_at       timestamptz,
  recipients     uuid[] not null default '{}',
  -- The recipients Riot's duo table says can duo with the sender (League only).
  can_duo        uuid[] not null default '{}',
  -- Recipients who opened the Pop card while it was open. Metrics only, never shown to anyone.
  opened         uuid[] not null default '{}',
  -- Recipients who tapped Not now. Never sent to the sender; keeps them out of this sender's
  -- pops for 7 days.
  declined       uuid[] not null default '{}',
  -- Why nobody was pinged (null when somebody was).
  pop_note       text,
  locked_by      uuid references public.profiles (id) on delete set null,
  locked_at      timestamptz,
  match_id       uuid references public.matches (id) on delete set null,
  -- The Duo Call code: the same alphabet and shape as invite_codes.code (0065).
  call_code      text,
  constraint queue_ups_recipients_max check (cardinality(recipients) <= 6),
  constraint queue_ups_recipients_no_nulls check (array_position(recipients, null) is null),
  constraint queue_ups_can_duo_subset check (can_duo <@ recipients),
  constraint queue_ups_opened_subset check (opened <@ recipients),
  constraint queue_ups_declined_subset check (declined <@ recipients),
  -- One-way on purpose: see the header's "TWO DEPARTURES FROM THE PLAN", number 2.
  constraint queue_ups_locked_by_needs_locked_at check (locked_by is null or locked_at is not null),
  constraint queue_ups_not_self_lock check (locked_by <> sender_id),
  constraint queue_ups_match_needs_lock check (match_id is null or locked_at is not null),
  constraint queue_ups_pop_note check (
    pop_note is null or pop_note in ('ping_off', 'outside_na', 'daily_limit', 'no_players', 'too_new', 'unavailable')
  ),
  constraint queue_ups_call_code_shape check (call_code is null or call_code ~ '^[0-9A-HJKMNP-TV-Z]{10}$'),
  constraint queue_ups_windows check (pop_expires_at > created_at and looking_until >= pop_expires_at)
);

create index if not exists queue_ups_sender_created_idx on public.queue_ups (sender_id, created_at desc);
-- duo_pop_recipients and the profile-delete trigger ask `recipients @> array[id]`.
create index if not exists queue_ups_recipients_gin on public.queue_ups using gin (recipients);
create unique index if not exists queue_ups_call_code_key on public.queue_ups (call_code) where call_code is not null;
create index if not exists queue_ups_match_id_idx on public.queue_ups (match_id) where match_id is not null;
create index if not exists queue_ups_created_at_idx on public.queue_ups (created_at);

-- Server-only, both ways (0065's D5: default privileges still hand anon and authenticated
-- SELECT on a new table, and from 30 Oct 2026 nothing is auto-granted, service_role included).
-- send-push-notification reads it with the service role.
alter table public.queue_ups enable row level security;
revoke all on public.queue_ups from public, anon, authenticated;
grant select, insert, update, delete on public.queue_ups to service_role;

comment on table public.queue_ups is
  'One row per Queue up tap (0085): the Duo Pop fan-out, its answers and the Duo Call code. Server-only: reached through start_queue_up, get_my_queue_up, stop_queue_up, get_duo_pop, answer_duo_pop, resolve_invite_code, accept_invite, call_code_ended and the service role.';

-- ---------------------------------------------------------------------------
-- 3. Helpers (no client grant)
-- ---------------------------------------------------------------------------

-- A call code: 0065's generator, rejecting any code that is somebody's permanent invite code
-- or any call code still on file (30 days), up to 5 tries.
create or replace function public.generate_call_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_code text;
  i int;
begin
  for i in 1..5 loop
    v_code := public.generate_invite_code();
    if not exists (select 1 from public.invite_codes ic where ic.code = v_code)
       and not exists (select 1 from public.queue_ups q where q.call_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'call_code_generation_failed';
end;
$fn$;

revoke execute on function public.generate_call_code() from public, anon, authenticated;

-- Everything that has to stay true between a sender and a recipient for a pop to be shown or
-- answered: both are ready (onboarded, active, not banned, not suspended), same demo-ness,
-- same age band, no block, no pass and no report in either direction. duo_pop_recipients
-- applies all of this and more at send time; get_duo_pop and answer_duo_pop re-check it,
-- because a block, a report or a pass in the deck can land inside the 10 minutes.
create or replace function public.duo_pop_pair_ok(p_sender uuid, p_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((
    select s.id <> r.id
       and s.onboarding_completed and s.is_active and not s.is_banned and not s.is_admin_suspended
       and r.onboarding_completed and r.is_active and not r.is_banned and not r.is_admin_suspended
       and s.is_demo = r.is_demo
       and public.same_age_band(s.id, r.id)
       and not public.is_blocked_pair(s.id, r.id)
       and not exists (
         select 1 from public.swipes w
         where w.action = 'pass'
           and ((w.swiper_id = s.id and w.target_id = r.id) or (w.swiper_id = r.id and w.target_id = s.id))
       )
       and not exists (
         select 1 from public.reports rep
         where (rep.reporter_profile_id = s.id and rep.reported_profile_id = r.id)
            or (rep.reporter_profile_id = r.id and rep.reported_profile_id = s.id)
       )
    from public.profiles s, public.profiles r
    where s.id = p_sender and r.id = p_recipient
  ), false);
$fn$;

revoke execute on function public.duo_pop_pair_ok(uuid, uuid) from public, anon, authenticated;

-- Cameron's decision 6: a Duo Pop never ARRIVES between 01:00 and 09:59 on the recipient's clock.
-- A pop is pushed once, right after the fan-out, and can be answered for 10 minutes
-- (start_queue_up's pop_expires_at); send-push-notification gives the push a ttl of the seconds
-- the pop has left, so an undelivered push dies with the pop. That makes the rule "the whole 10
-- minutes sits inside 10:00-00:59": the local hour is 10-23 or 0 both now and at the pop's end.
-- In practice a fan-out from 10:00 up to 00:49:59. local_hour_within(tz, 10, 0) alone would let a
-- pop go out at 00:59 and land at 01:05.
-- No timezone on file: both NA coasts must agree, exactly as local_hour_within does
-- (profiles_timezone_valid keeps every stored zone a real one).
create or replace function public.duo_pop_clock_ok(p_timezone text)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select coalesce(bool_and(
    extract(hour from (now() at time zone z.zone))::int not between 1 and 9
    and extract(hour from ((now() + interval '10 minutes') at time zone z.zone))::int not between 1 and 9
  ), false)
  from unnest(
    case when nullif(btrim(p_timezone), '') is null
      then array['America/New_York', 'America/Los_Angeles']
      else array[p_timezone]
    end
  ) as z(zone);
$fn$;

revoke execute on function public.duo_pop_clock_ok(text) from public, anon, authenticated;

-- The people a pop goes to. The full rule list is in this file's header; keep the two in step.
-- VOLATILE because the last tie-break is random().
create or replace function public.duo_pop_recipients(p_sender uuid, p_game uuid)
returns table(profile_id uuid, can_duo boolean)
language sql
volatile
security definer
set search_path = public
as $fn$
  with s as (
    select
      p.id,
      p.region,
      extract(year from age(current_date, p.dob))::int as age,
      greatest(coalesce(pr.min_age, 18), 18) as min_age,
      coalesce(pr.max_age, 99) as max_age,
      sg.lol_tier,
      sg.lol_division
    from public.profiles p
    left join public.preferences pr on pr.profile_id = p.id
    left join public.profile_games sg on sg.profile_id = p.id and sg.game_id = p_game
    where p.id = p_sender
      and public.server_group(p.region) = 'na'
  ),
  cand as (
    select
      r.id,
      (r.is_looking_now and r.looking_now_expires_at > now()) as looking,
      case
        when p_game = public.lol_game_id()
          then public.lol_solo_duo_eligible(s.lol_tier, s.lol_division, rg.lol_tier, rg.lol_division)
      end as duo
    from s
    join public.profiles r on r.id <> s.id
    -- Opted in: the row has to EXIST and say true.
    join public.notification_settings ns on ns.profile_id = r.id and ns.queue_pop = true
    join public.profile_games rg on rg.profile_id = r.id and rg.game_id = p_game
    left join public.preferences rp on rp.profile_id = r.id
    where public.server_group(r.region) = 'na'
      and public.duo_pop_pair_ok(s.id, r.id)
      and exists (select 1 from public.push_tokens t where t.profile_id = r.id)
      and not exists (
        select 1 from public.matches m
        where m.user_a_id = least(s.id, r.id) and m.user_b_id = greatest(s.id, r.id)
      )
      -- Each side's age range admits the other, floored at 18 (deck_gate_preferences).
      and extract(year from age(current_date, r.dob))::int between s.min_age and s.max_age
      and s.age between greatest(coalesce(rp.min_age, 18), 18) and coalesce(rp.max_age, 99)
      -- The whole pop inside 10:00-00:59 on the recipient's clock (Cameron's decision 6).
      and public.duo_pop_clock_ok(r.timezone)
      -- At most one pop in 3 hours and 3 in 24 hours, from anyone.
      and not exists (
        select 1 from public.queue_ups q
        where q.recipients @> array[r.id] and q.created_at > now() - interval '3 hours'
      )
      and (
        select count(*) from public.queue_ups q
        where q.recipients @> array[r.id] and q.created_at > now() - interval '24 hours'
      ) < 3
      -- Said Not now to this sender in the last 7 days.
      and not exists (
        select 1 from public.queue_ups q
        where q.sender_id = s.id and q.declined @> array[r.id] and q.created_at > now() - interval '7 days'
      )
  )
  select c.id, coalesce(c.duo, false)
  from cand c
  order by
    case when c.duo is true then 0 when c.duo is null then 1 else 2 end,
    c.looking desc,
    public.profile_last_seen_at(c.id) desc nulls last,
    random()
  limit 6;
$fn$;

revoke execute on function public.duo_pop_recipients(uuid, uuid) from public, anon, authenticated;

-- One queue_ups row as the sender's RPCs return it. The call code only while the row is live;
-- partner = the locker; popped_in_seconds = ceil(locked_at - created_at), clamped 1..600.
create or replace function public.queue_up_out(p_id uuid, p_already boolean)
returns table(
  queue_id uuid, game_id uuid, game_name text, ping boolean, notified integer, pop_note text,
  created_at timestamptz, pop_expires_at timestamptz, looking_until timestamptz, ended_at timestamptz,
  call_code text, locked_at timestamptz, match_id uuid, partner_id uuid, partner_name text,
  popped_in_seconds integer, already_queued boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    q.id,
    q.game_id,
    g.name,
    q.ping,
    cardinality(q.recipients),
    q.pop_note,
    q.created_at,
    q.pop_expires_at,
    q.looking_until,
    q.ended_at,
    case when q.ended_at is null and q.looking_until > now() then q.call_code end,
    q.locked_at,
    q.match_id,
    q.locked_by,
    lp.display_name,
    case
      when q.locked_at is not null
        then greatest(1, least(600, ceil(extract(epoch from q.locked_at - q.created_at))))::int
    end,
    coalesce(p_already, false)
  from public.queue_ups q
  left join public.games g on g.id = q.game_id
  left join public.profiles lp on lp.id = q.locked_by
  where q.id = p_id;
$fn$;

revoke execute on function public.queue_up_out(uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The sender: start, read, stop
-- ---------------------------------------------------------------------------
create or replace function public.start_queue_up(p_game_id uuid, p_ping boolean)
returns table(
  queue_id uuid, game_id uuid, game_name text, ping boolean, notified integer, pop_note text,
  created_at timestamptz, pop_expires_at timestamptz, looking_until timestamptz, ended_at timestamptz,
  call_code text, locked_at timestamptz, match_id uuid, partner_id uuid, partner_name text,
  popped_in_seconds integer, already_queued boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_live uuid;
  v_note text;
  v_recipients uuid[] := '{}';
  v_can_duo uuid[] := '{}';
  v_code text;
  v_id uuid;
  v_r uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;

  -- One call per sender at a time, taken BEFORE any check. Without it, two calls in flight at
  -- once (a double tap inside one request's lifetime, or a script firing the RPC N times in
  -- parallel) all pass the rate limit, the live-row lookup and the 3-a-day count below before
  -- any of them commits, and each inserts its own live row and fans out to 6 more players. With
  -- it, the second call waits here until the first commits; every statement after this takes a
  -- fresh snapshot (READ COMMITTED, VOLATILE), so it sees the first call's row and answers
  -- already_queued. FOR NO KEY UPDATE is the lock the profiles UPDATE below takes anyway, held to
  -- the end of the transaction either way; it does not block the KEY SHARE that inserts
  -- referencing this profile take (a swipe on them, a message), so nothing else queues behind it.
  -- stop_queue_up takes the same lock, so a Stop sent while a start is still running ends the
  -- row that start writes instead of missing it.
  select * into v_profile from public.profiles p where p.id = v_me for no key update;
  if not found
     or not v_profile.onboarding_completed
     or not v_profile.is_active
     or v_profile.is_admin_suspended then
    raise exception 'profile_not_ready'
      using hint = 'Finish setting up your profile first.';
  end if;

  perform public.check_rate_limit('queue_up', 12, interval '1 hour');

  if p_game_id is null or not exists (
    select 1 from public.profile_games pg where pg.profile_id = v_me and pg.game_id = p_game_id
  ) then
    raise exception 'not_your_game'
      using hint = 'Pick one of the games on your profile.';
  end if;

  -- Idempotent: a second tap while queued returns the live row, unchanged, and pings nobody.
  select q.id into v_live
  from public.queue_ups q
  where q.sender_id = v_me and q.ended_at is null and q.looking_until > now()
  order by q.created_at desc
  limit 1;
  if v_live is not null then
    return query select * from public.queue_up_out(v_live, true);
    return;
  end if;

  -- Free to duo for the next hour: exactly what set_looking_now(true) writes. The UPDATE fires
  -- notify_looking_now, so the sender's matches get 0074's push under 0074's own rules (6 hours
  -- per match, quiet hours, unlocked chats only). looking_until below is the same instant.
  update public.profiles p
     set is_looking_now = true,
         looking_now_expires_at = now() + interval '60 minutes',
         last_active_at = now()
   where p.id = v_me;

  -- Who gets a Duo Pop, decided in this order. Every branch but the last pings nobody and says
  -- why in pop_note; the sender is still queued either way.
  if not coalesce(p_ping, false) then
    v_note := 'ping_off';
  elsif public.server_group(v_profile.region) is distinct from 'na' then
    v_note := 'outside_na';
  -- Anti-spam, the sender's side: a day past setup (12 onboarded profiles predate
  -- onboarding_completed_at; created_at stands in), and no report against them in 30 days.
  elsif coalesce(v_profile.onboarding_completed_at, v_profile.created_at) > now() - interval '24 hours' then
    v_note := 'too_new';
  elsif exists (
    select 1 from public.reports rep
    where rep.reported_profile_id = v_me and rep.created_at > now() - interval '30 days'
  ) then
    v_note := 'unavailable';
  elsif (
    select count(*) from public.queue_ups q
    where q.sender_id = v_me and q.created_at > now() - interval '24 hours' and cardinality(q.recipients) > 0
  ) >= 3 then
    v_note := 'daily_limit';
  else
    -- One fan-out at a time, so two senders at once cannot both take a recipient past the
    -- 3-hour and 3-a-day caps. Held until this transaction ends; a fan-out is one query.
    perform pg_advisory_xact_lock(hashtextextended('duo_pop_fanout', 0));
    -- In duo_pop_recipients' order (can duo first), kept by WITH ORDINALITY.
    select
      coalesce(array_agg(d.profile_id order by d.ord), '{}'),
      coalesce(array_agg(d.profile_id order by d.ord) filter (where d.can_duo), '{}')
    into v_recipients, v_can_duo
    from public.duo_pop_recipients(v_me, p_game_id) with ordinality as d(profile_id, can_duo, ord);
    if cardinality(v_recipients) = 0 then
      v_note := 'no_players';
    end if;
  end if;

  -- Every queue-up gets a call code, pinged or not: the LFG post is how a quiet or non-NA
  -- player still finds someone.
  v_code := public.generate_call_code();

  insert into public.queue_ups as q (
    sender_id, game_id, ping, created_at, pop_expires_at, looking_until,
    recipients, can_duo, pop_note, call_code
  )
  values (
    v_me, p_game_id, coalesce(p_ping, false), now(), now() + interval '10 minutes', now() + interval '60 minutes',
    v_recipients, v_can_duo, v_note, v_code
  )
  returning q.id into v_id;

  -- One push request per recipient, in this transaction: pg_net sends them after COMMIT, so a
  -- failed start pings nobody. The payload names nobody; send-push-notification re-reads the row.
  foreach v_r in array v_recipients loop
    perform public.notify_via_edge_function(
      jsonb_build_object('type', 'duo_pop', 'popId', v_id, 'recipientId', v_r)
    );
  end loop;

  return query select * from public.queue_up_out(v_id, false);
end;
$fn$;

revoke execute on function public.start_queue_up(uuid, boolean) from public, anon;
grant execute on function public.start_queue_up(uuid, boolean) to authenticated, service_role;

-- The sender's newest queue-up of the last 70 minutes (the hour plus the 10-minute pop that
-- can lock at its very end), or zero rows. What the sheet and the resume check read.
create or replace function public.get_my_queue_up()
returns table(
  queue_id uuid, game_id uuid, game_name text, ping boolean, notified integer, pop_note text,
  created_at timestamptz, pop_expires_at timestamptz, looking_until timestamptz, ended_at timestamptz,
  call_code text, locked_at timestamptz, match_id uuid, partner_id uuid, partner_name text,
  popped_in_seconds integer, already_queued boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  perform public.check_rate_limit('get_my_queue_up', 60, interval '1 minute');

  select q.id into v_id
  from public.queue_ups q
  where q.sender_id = v_me and q.created_at > now() - interval '70 minutes'
  order by q.created_at desc
  limit 1;
  if v_id is null then
    return;
  end if;

  return query select * from public.queue_up_out(v_id, false);
end;
$fn$;

revoke execute on function public.get_my_queue_up() from public, anon;
grant execute on function public.get_my_queue_up() to authenticated, service_role;

-- Stop queueing: ends the caller's live rows (their call code stops resolving 15 minutes later,
-- and an open pop answers "ended") and writes what set_looking_now(false) writes. Idempotent.
create or replace function public.stop_queue_up()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  -- start_queue_up's per-sender lock (see there): a Stop that arrives while a start is still
  -- running waits for it, then its UPDATE (a fresh snapshot) sees and ends the row that start
  -- wrote. Without it the Stop ended nothing, the start then committed, and the player who
  -- tapped Stop was left with a live queue-up: its pops open and its call code still working.
  perform 1 from public.profiles p where p.id = v_me for no key update;

  update public.queue_ups q
     set ended_at = now()
   where q.sender_id = v_me and q.ended_at is null and q.looking_until > now();

  update public.profiles p
     set is_looking_now = false,
         looking_now_expires_at = null,
         last_active_at = now()
   where p.id = v_me;
end;
$fn$;

revoke execute on function public.stop_queue_up() from public, anon;
grant execute on function public.stop_queue_up() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. The recipient: read the pop, answer it
-- ---------------------------------------------------------------------------

-- The Pop card. Zero rows unless the caller is one of the pop's recipients and the pair still
-- passes duo_pop_pair_ok. Shows the sender's name and AGE (Cameron's decision 2, ages stay),
-- the game, the rank text and whether Riot's table lets the two duo. status is one of
-- locked_by_you, taken, ended, expired, open; seconds_left is server time (0 unless open), so a
-- phone with a wrong clock still counts down right. Opening an open pop records the caller in
-- `opened` (metrics only).
create or replace function public.get_duo_pop(p_pop_id uuid)
returns table(
  pop_id uuid, sender_id uuid, display_name text, age integer, game_name text, rank_text text,
  can_duo boolean, seconds_left integer, status text, match_id uuid
)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_q public.queue_ups%rowtype;
  v_status text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  perform public.check_rate_limit('get_duo_pop', 60, interval '1 minute');

  select * into v_q from public.queue_ups q where q.id = p_pop_id;
  if not found or not (v_q.recipients @> array[v_me]) then
    return;
  end if;
  if not public.duo_pop_pair_ok(v_q.sender_id, v_me) then
    return;
  end if;

  v_status := case
    when v_q.locked_by = v_me then 'locked_by_you'
    when v_q.locked_at is not null then 'taken'
    when v_q.ended_at is not null then 'ended'
    when v_q.pop_expires_at <= now() then 'expired'
    else 'open'
  end;

  if v_status = 'open' and not (v_q.opened @> array[v_me]) then
    update public.queue_ups q
       set opened = array_append(q.opened, v_me)
     where q.id = v_q.id and not (q.opened @> array[v_me]);
  end if;

  return query
  select
    v_q.id,
    v_q.sender_id,
    p.display_name,
    extract(year from age(current_date, p.dob))::int,
    g.name,
    nullif(btrim(pg.rank_text), ''),
    v_q.can_duo @> array[v_me],
    case
      when v_status = 'open' then greatest(0, ceil(extract(epoch from v_q.pop_expires_at - now())))::int
      else 0
    end,
    v_status,
    case when v_status = 'locked_by_you' then v_q.match_id end
  from public.profiles p
  left join public.games g on g.id = v_q.game_id
  left join public.profile_games pg on pg.profile_id = v_q.sender_id and pg.game_id = v_q.game_id
  where p.id = v_q.sender_id;
end;
$fn$;

revoke execute on function public.get_duo_pop(uuid) from public, anon;
grant execute on function public.get_duo_pop(uuid) to authenticated, service_role;

-- I'm in / Not now. Answers with one of locked, declined, taken, expired, ended,
-- already_matched, unavailable, and never raises for any of them (only for no session, a ban
-- or the rate limit). The row is locked FOR UPDATE, so of two I'm in taps at once exactly one
-- gets `locked` and the other `taken`.
create or replace function public.answer_duo_pop(p_pop_id uuid, p_accept boolean)
returns table(result text, match_id uuid, popped_in_seconds integer)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_q public.queue_ups%rowtype;
  v_existing_id uuid;
  v_existing_unmatched timestamptz;
  v_match uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('answer_duo_pop', 30, interval '1 hour');

  select * into v_q from public.queue_ups q where q.id = p_pop_id for update;
  if not found or not (v_q.recipients @> array[v_me]) then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  -- Not now: remembered for this sender's next 7 days of pops, and never sent to the sender.
  if not coalesce(p_accept, false) then
    if v_q.locked_by is distinct from v_me and not (v_q.declined @> array[v_me]) then
      update public.queue_ups q set declined = array_append(q.declined, v_me) where q.id = v_q.id;
    end if;
    return query select 'declined'::text, null::uuid, null::integer;
    return;
  end if;

  -- I'm in, again, by the player who already has it: the same answer.
  if v_q.locked_by = v_me then
    return query select 'locked'::text, v_q.match_id,
      greatest(1, least(600, ceil(extract(epoch from v_q.locked_at - v_q.created_at))))::int;
    return;
  end if;
  if v_q.locked_at is not null then
    return query select 'taken'::text, null::uuid, null::integer;
    return;
  end if;
  if v_q.ended_at is not null then
    return query select 'ended'::text, null::uuid, null::integer;
    return;
  end if;
  if v_q.pop_expires_at <= now() then
    return query select 'expired'::text, null::uuid, null::integer;
    return;
  end if;
  if not public.duo_pop_pair_ok(v_q.sender_id, v_me) then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  -- A live match already has its chat. An unmatched one means one of them said no, and a pop
  -- must not bring it back.
  select m.id, m.unmatched_at into v_existing_id, v_existing_unmatched
  from public.matches m
  where m.user_a_id = least(v_q.sender_id, v_me) and m.user_b_id = greatest(v_q.sender_id, v_me);
  if v_existing_id is not null then
    if v_existing_unmatched is null then
      return query select 'already_matched'::text, v_existing_id, null::integer;
    else
      return query select 'unavailable'::text, null::uuid, null::integer;
    end if;
    return;
  end if;

  update public.queue_ups q
     set locked_by = v_me,
         locked_at = now()
   where q.id = v_q.id;

  -- Both consents, as ordinary likes, so the match is the same object as one from the deck
  -- (same unmatch, block and report paths), and no swipe quota is charged: this is a direct
  -- insert, not perform_swipe.
  --
  -- The like-alert trigger on_swipe_like_alert is DEFERRABLE INITIALLY DEFERRED (0083:69-74),
  -- so it runs at COMMIT, sees both likes and the match, and 0072's no-match check skips the
  -- alert; a like that already existed takes the conflict path, which is an UPDATE and never
  -- fires the INSERT trigger.
  insert into public.swipes (swiper_id, target_id, action)
  values (v_q.sender_id, v_me, 'like'), (v_me, v_q.sender_id, 'like')
  on conflict (swiper_id, target_id) do update set action = 'like';

  -- The INSERT fires on_match_created, whose new_match push send-push-notification enriches
  -- for a pop: "Duo locked" to the sender only (it reads match_id below, after COMMIT).
  insert into public.matches (user_a_id, user_b_id)
  values (least(v_q.sender_id, v_me), greatest(v_q.sender_id, v_me))
  on conflict (user_a_id, user_b_id) do nothing
  returning id into v_match;
  if v_match is null then
    -- Lost a race with a deck swipe in the same instant: the match is theirs and ours alike.
    select m.id into v_match
    from public.matches m
    where m.user_a_id = least(v_q.sender_id, v_me) and m.user_b_id = greatest(v_q.sender_id, v_me);
  end if;

  update public.queue_ups q set match_id = v_match where q.id = v_q.id;

  return query select 'locked'::text, v_match,
    greatest(1, least(600, ceil(extract(epoch from now() - v_q.created_at))))::int;
end;
$fn$;

revoke execute on function public.answer_duo_pop(uuid, boolean) from public, anon;
grant execute on function public.answer_duo_pop(uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Duo Call: call codes through the invite plumbing
-- ---------------------------------------------------------------------------
--
-- A call code is typed or tapped exactly like an invite code: the invite link, the front door's
-- code field, redeem_invite_code at Save (the 14-day new-account window, unchanged), then
-- /invited and accept_invite. Neither the invite Edge Function nor redeem_invite_code changes:
-- both go through resolve_invite_code.
--
-- resolve_invite_code, rebuilt from its LIVE definition (15 Oct 2026). The first branch is that
-- definition, word for word. The second resolves a LIVE call code: not ended, and its window
-- plus 15 minutes not passed (the code is typed at the front door and redeemed at Save, minutes
-- later, after the age gate and the card), under the same visibility predicate. A permanent
-- code wins a collision: the second branch is skipped when any live permanent code is that
-- string. Same signature, RETURNS, STABLE SECURITY DEFINER and ACL (anon keeps it, 0065's D4).
create or replace function public.resolve_invite_code(p_code text)
returns table(inviter_id uuid, display_name text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select p.id, p.display_name
  from public.invite_codes ic
  join public.profiles p on p.id = ic.profile_id
  where ic.code = public.normalize_invite_code(p_code)
    -- Cheap shape gate before the index probe, so a garbage string never becomes a query.
    and public.normalize_invite_code(p_code) ~ '^[0-9A-HJKMNP-TV-Z]{10}$'
    and ic.revoked_at is null
    and p.is_active = true
    and p.is_admin_suspended = false
    and p.onboarding_completed = true
    and p.is_banned = false
    and p.is_demo = false
  union all
  -- 0085: a live Duo Call code.
  select p.id, p.display_name
  from public.queue_ups q
  join public.profiles p on p.id = q.sender_id
  where q.call_code = public.normalize_invite_code(p_code)
    and public.normalize_invite_code(p_code) ~ '^[0-9A-HJKMNP-TV-Z]{10}$'
    and q.ended_at is null
    and q.looking_until + interval '15 minutes' > now()
    and p.is_active = true
    and p.is_admin_suspended = false
    and p.onboarding_completed = true
    and p.is_banned = false
    and p.is_demo = false
    and not exists (
      select 1 from public.invite_codes ic2
      where ic2.code = public.normalize_invite_code(p_code) and ic2.revoked_at is null
    );
$function$;

-- accept_invite, rebuilt from its LIVE definition (15 Oct 2026). One change: the inviter-side
-- standing like for a redemption made with a call code.
--
-- A redemption is a call-code redemption when its code is NOT the inviter's permanent code
-- (invite_codes.code for that inviter). For one, the standing like is written only while that
-- queue-up is not ended and its window plus 15 minutes has not passed, only while fewer than 3
-- OTHER redemptions of that code have connected (Q8: at most 3 auto-matches per call), and only
-- under the existing 25-a-day cap. Otherwise the invitee's like alone stands, and /invited says
-- "Duo request sent": the caller sees them in Requests and decides.
--
-- Why "not the permanent code" rather than "found in queue_ups": queue_ups rows are pruned at
-- 30 days, and a redemption accepted after that must not fall back to the permanent code's
-- standing consent. The one permanent-code case this reclassifies is a code revoked AND replaced
-- (get_or_create_invite_code mints a new one after a revoke) whose old redemption is accepted
-- afterwards: it now gets no standing like, which is the right answer for a link revoked because
-- it leaked. Read live 15 Oct 2026: 0 redemptions, 0 revoked codes.
create or replace function public.accept_invite()
returns table(matched boolean, match_id uuid, inviter_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_row public.invite_redemptions%rowtype;
  v_recent_connections int;
  v_mutual boolean;
  v_a uuid;
  v_b uuid;
  v_is_call boolean;
  v_call public.queue_ups%rowtype;
  v_call_found boolean := false;
  v_call_connected int := 0;
  v_standing_ok boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;

  select * into v_row from public.invite_redemptions where invitee_id = v_me;
  if not found then
    raise exception 'no_invite' using hint = 'There is no invite on this account.';
  end if;

  -- Every gate the deck would apply to this pair, minus "not already swiped" (which is
  -- the one thing this function is allowed to change) and minus the preference filters
  -- (an invite is a named person, not a search result -- a region filter should not stop
  -- somebody connecting with the friend who brought them).
  if not exists (
    select 1 from public.profiles p
    where p.id = v_row.inviter_id
      and p.is_active = true
      and p.is_admin_suspended = false
      and p.onboarding_completed = true
      and p.is_banned = false
      and (p.is_demo = false or public.is_demo_viewer())
  ) then
    raise exception 'inviter_unavailable'
      using hint = 'That player is not available right now.';
  end if;
  if public.is_blocked_pair(v_me, v_row.inviter_id) then
    raise exception 'inviter_unavailable'
      using hint = 'That player is not available right now.';
  end if;
  if not public.same_age_band(v_me, v_row.inviter_id) then
    raise exception 'inviter_unavailable'
      using hint = 'That player is not available right now.';
  end if;

  -- The invitee's consent. DO UPDATE, not DO NOTHING, and the asymmetry with the inviter's
  -- row below is the point.
  --
  -- Found by running this against the live database rather than by reading it: the invitee
  -- in that test had already passed on the inviter from the deck, `on conflict do nothing`
  -- silently kept the pass, and the pair still matched because the mutual check only looked
  -- at the other side. Two fixes, both here. This side upserts because a tap on a named
  -- person's arrival screen is not a re-swipe of a card -- they are answering the friend who
  -- asked for them by name, and that is a newer and more specific decision than a flick past
  -- a face in a deck.
  insert into public.swipes (swiper_id, target_id, action)
  values (v_me, v_row.inviter_id, 'like')
  on conflict (swiper_id, target_id) do update set action = 'like';

  -- The inviter's standing consent, bounded -- and DO NOTHING, so it can only ever add a
  -- decision, never overwrite one. If the inviter already passed on this person with their
  -- profile in front of them, that judgement stands and no match forms. A link sent before
  -- they had seen the profile does not get to undo what they decided after.
  select count(*) into v_recent_connections
  from public.invite_redemptions
  where invite_redemptions.inviter_id = v_row.inviter_id
    and connected_at > now() - interval '24 hours';

  -- 0085: a Duo Call code's standing consent lasts only as long as the call (see above).
  v_is_call := not exists (
    select 1 from public.invite_codes ic
    where ic.profile_id = v_row.inviter_id and ic.code = v_row.code
  );
  if v_is_call then
    -- FOR UPDATE: two invitees accepting the same call at once count each other.
    select q.* into v_call
    from public.queue_ups q
    where q.call_code = v_row.code and q.sender_id = v_row.inviter_id
    for update;
    v_call_found := found;
    select count(*) into v_call_connected
    from public.invite_redemptions r
    where r.inviter_id = v_row.inviter_id
      and r.code = v_row.code
      and r.invitee_id <> v_me
      and r.connected_at is not null;
    v_standing_ok := v_call_found
      and v_call.ended_at is null
      and v_call.looking_until + interval '15 minutes' > now()
      and v_call_connected < 3;
  else
    v_standing_ok := true;
  end if;

  if v_recent_connections < 25 and v_standing_ok then
    insert into public.swipes (swiper_id, target_id, action)
    values (v_row.inviter_id, v_me, 'like')
    on conflict (swiper_id, target_id) do nothing;
  end if;

  update public.invite_redemptions
  set connected_at = coalesce(connected_at, now())
  where invitee_id = v_me;

  -- BOTH directions, both 'like'. The second half is true by construction after the upsert
  -- above, and it is written out anyway: this is the predicate that decides whether two
  -- people can message each other, and it should not be readable as "and something else
  -- earlier in this function must have gone right".
  select
    exists (
      select 1 from public.swipes
      where swiper_id = v_row.inviter_id and target_id = v_me and action = 'like'
    )
    and exists (
      select 1 from public.swipes
      where swiper_id = v_me and target_id = v_row.inviter_id and action = 'like'
    )
  into v_mutual;

  matched := false;
  match_id := null;
  inviter_id := v_row.inviter_id;

  if v_mutual then
    v_a := least(v_me, v_row.inviter_id);
    v_b := greatest(v_me, v_row.inviter_id);
    -- Same upsert perform_swipe uses, so the on_match_created trigger fires and both
    -- sides get the ordinary "New match!" push. That is the whole notification design for
    -- this feature: no new category, no new setting, no new Edge Function branch.
    insert into public.matches (user_a_id, user_b_id)
    values (v_a, v_b)
    on conflict (user_a_id, user_b_id) do update set unmatched_at = null, unmatched_by = null
    returning id into match_id;
    matched := true;
  end if;

  return next;
end;
$function$;

-- True only for a Duo Call code that has ENDED: the right shape, no live permanent code equals
-- it, and a queue-up of the last 7 days carries it and no longer resolves (stopped, or its
-- window plus 15 minutes passed). The app's InviteBanner shows "That Duo Call has ended" for
-- it instead of "That code did not work". Callable by anon for the same reason as
-- resolve_invite_code (the code is typed before there is an account); it discloses one bit
-- about a 50-bit random string, and never a name.
create or replace function public.call_code_ended(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((
    select v.c ~ '^[0-9A-HJKMNP-TV-Z]{10}$'
       and not exists (
         select 1 from public.invite_codes ic where ic.code = v.c and ic.revoked_at is null
       )
       and exists (
         select 1 from public.queue_ups q
         where q.call_code = v.c
           and q.created_at > now() - interval '7 days'
           and (q.ended_at is not null or q.looking_until + interval '15 minutes' <= now())
       )
    from (select public.normalize_invite_code(p_code) as c) v
  ), false);
$fn$;

revoke execute on function public.call_code_ended(text) from public;
grant execute on function public.call_code_ended(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Account deletion and retention
-- ---------------------------------------------------------------------------

-- A deleted account leaves no trace in anyone else's queue_ups row (App Store 5.1.1(v)). Their
-- own rows go with them (sender_id ON DELETE CASCADE); a lock they made keeps locked_at and loses
-- locked_by (ON DELETE SET NULL, and the header's one-way check is why that cannot fail).
--
-- BEFORE DELETE, not AFTER, found by this file's check: deleting the player who LOCKED a pop
-- also deletes their match (matches ON DELETE CASCADE), and an AFTER trigger's UPDATE of that
-- queue_ups row ran while the row still pointed at the vanished match, so its foreign-key check
-- failed and took the whole account deletion down with it. Before the delete, the match is still
-- there; the cascades that follow then null match_id and locked_by as declared.
create or replace function public.queue_ups_forget_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.queue_ups q
     set recipients = array_remove(q.recipients, old.id),
         can_duo = array_remove(q.can_duo, old.id),
         opened = array_remove(q.opened, old.id),
         declined = array_remove(q.declined, old.id)
   where q.recipients @> array[old.id];
  return old;
end;
$fn$;

revoke execute on function public.queue_ups_forget_profile() from public, anon, authenticated;

drop trigger if exists queue_ups_forget_profile on public.profiles;
create trigger queue_ups_forget_profile
  before delete on public.profiles
  for each row execute function public.queue_ups_forget_profile();

create or replace function public.prune_queue_ups()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  delete from public.queue_ups where created_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke execute on function public.prune_queue_ups() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'queue-ups-prune-daily') then
    perform cron.unschedule('queue-ups-prune-daily');
  end if;
end;
$$;

select cron.schedule(
  'queue-ups-prune-daily',
  '57 9 * * *',
  $$select public.prune_queue_ups()$$
);
