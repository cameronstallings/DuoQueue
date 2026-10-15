-- 0081: the server halves the 1.0.2 build needs, shipped ahead of it. All additive: the App
-- Store 1.0.1 client keeps working exactly as before.
--
-- ============================================================================
-- 1. notification_settings.announcements, DEFAULT FALSE (App Store guideline 4.5.4)
-- ============================================================================
--
-- Every existing switch is transactional or engagement, and defaults to true. A push about the
-- app itself ("News from DuoQueue") needs the player's explicit opt-in, so this one defaults to
-- FALSE and stays false for every existing player until they turn it on in 1.0.2. A
-- table-level grant on notification_settings already lets a player write their own row (RLS:
-- own row only), so no grant is needed; 1.0.1 selects "*" and ignores the column.
--
-- get_announcement_recipients() is where that rule lives, so no sender can get it wrong:
-- announcements = true, onboarded, active, not banned or suspended, not demo, with a push
-- token. An INNER join: a player with no settings row is NOT opted in. (That is the opposite of
-- notifyProfile's "a missing row means notify", which is right for pushes about a person and
-- wrong for this one.) Service role only.
--
-- LOCAL HOURS, AND ONE DELIVERY PER PLAYER. An announcement is a batch push, so it keeps the
-- window every scheduled push keeps (Cameron, 15 Oct): 10:00 to 20:59 in the RECIPIENT's local
-- time (0072's local_hour_within; a NULL zone has to be inside it in both New York and Los
-- Angeles). Fired once, it would land in the night for EU, SA and Asia players (88% of last
-- week's swipes) and at 07:00 on the US West Coast. So the sender does not read the list, it
-- CLAIMS from it: claim_announcement_recipients(title, body) returns only the opted-in players
-- who are inside their window right now and have not had this exact announcement yet, and
-- records each of them in announcement_deliveries in the same statement. The announcement's
-- identity is the sha256 of its title and body, so firing the SAME text again an hour later
-- reaches the next time zones and nobody twice. To reach everyone: fire it once an hour from
-- 10:00 New York until every zone that matters has passed 10:00 (about 24 hours covers all).
-- get_announcement_recipients() stays as the plain "who is opted in" list, for counting.
--
-- THE EDGE FUNCTION CONTRACT, when someone builds the sender: an internal-only call,
--   { "type": "announcement", "title": <1..60 chars>, "body": <1..180 chars> }
-- sent to the rows claim_announcement_recipients(title, body) returns, and to nobody else,
-- data.category "announcement" (not a routed category in 1.0.1, so a tap just opens the app),
-- silent, logged in push_log with event "announcement". Copy rules as everywhere: no em
-- dashes, no dating language. Claim first, send second, as every ledger here does: a failed
-- send is a missed announcement, never a duplicate.
--
-- ============================================================================
-- 2. claim_push_token(p_token): the phone's token belongs to whoever is signed in on it
-- ============================================================================
--
-- push_tokens.expo_push_token is UNIQUE and the app registers with
--   upsert({ profile_id, expo_push_token }, { onConflict: 'expo_push_token' })
-- When a second account signs in on a phone, that upsert has to UPDATE a row owned by the
-- first account, push_tokens_update_own (USING profile_id = auth.uid()) refuses it, and the app
-- logs an RLS 403. The token stays on the first account, so the phone keeps receiving the FIRST
-- account's matches and messages after it signed out, and the second account gets none.
-- edge_logs show four of these 403s (3, 5 and 8 Oct).
--
-- claim_push_token moves the token to the caller in one statement: insert it, or, if the token
-- is already registered, reassign it (created_at restarts when the owner changes, so "when did
-- this account get a token" stays true). The token must look like an Expo token. Rate limited
-- (30 an hour; a launch registers once). SECURITY DEFINER, revoked from public and anon,
-- granted to authenticated (from 30 Oct 2026 nothing is granted automatically).
--
-- The trust argument: a caller can only claim a token they already hold. Expo tokens are
-- issued to the device, never shown to another user (push_tokens is readable only by its
-- owner), so in practice the only caller who has the token is the phone it belongs to.
--
-- 1.0.2 calls supabase.rpc('claim_push_token', { p_token }) in place of the upsert, and on
-- sign-out deletes its own row (push_tokens_delete_own already allows that).
--
-- ============================================================================
-- 3. get_standouts: 60 calls per 5 minutes instead of 20, and no dormant profiles
-- ============================================================================
--
-- The shipped client invalidates the Highlights query on EVERY swipe (useSwipeAction.ts), so a
-- player who swipes more than 20 cards in 5 minutes hits rate_limit_exceeded:get_standouts:
-- edge_logs show 63 HTTP 400s from 6 to 14 Oct, in bursts from 4 devices. The client fix rides
-- 1.0.2; raising the bucket to 60 stops the errors on 1.0.1 phones now. Each call is a cheap
-- read after the day's picks exist (daily_standouts).
--
-- And the day's picks leave out dormant profiles (0071's is_dormant_profile): Highlights is a
-- strip of cards in the deck, and a like on a dormant card is the same dead end as one in the
-- deck. Picks already made today stay as they are.
--
-- Rebuilt from the live definition (2026-10-14). Signature, RETURNS shape and ACL unchanged.
--
-- Checks: supabase/checks/0081_build_server_halves.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Announcements opt-in.
-- ---------------------------------------------------------------------------
alter table public.notification_settings
  add column if not exists announcements boolean not null default false;

create or replace function public.get_announcement_recipients()
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $fn$
  select p.id
  from public.profiles p
  join public.notification_settings ns on ns.profile_id = p.id
  where ns.announcements = true
    and p.onboarding_completed = true
    and p.is_active = true
    and p.is_banned = false
    and p.is_admin_suspended = false
    and p.is_demo = false
    and exists (select 1 from public.push_tokens t where t.profile_id = p.id);
$fn$;

revoke execute on function public.get_announcement_recipients() from public, anon, authenticated;
grant execute on function public.get_announcement_recipients() to service_role;

-- The per-announcement ledger. profile_id cascades (App Store 5.1.1(v)). Server-only: RLS with
-- no policies, the client roles revoked (0052's default privileges would hand them SELECT), and
-- service_role granted explicitly (30 Oct 2026 rule).
create table if not exists public.announcement_deliveries (
  announcement_key text not null,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  sent_at          timestamptz not null default now(),
  primary key (announcement_key, profile_id),
  constraint announcement_deliveries_key_is_sha256 check (announcement_key ~ '^[0-9a-f]{64}$')
);

alter table public.announcement_deliveries enable row level security;
revoke all on public.announcement_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.announcement_deliveries to service_role;

-- Opted-in players inside 10:00-20:59 local who have not had this announcement, claimed in one
-- statement (a concurrent second call for the same text claims nobody the first one claimed).
create or replace function public.claim_announcement_recipients(p_title text, p_body text)
returns table (profile_id uuid)
language sql
security definer
set search_path = public
as $fn$
  insert into public.announcement_deliveries (announcement_key, profile_id)
  select encode(sha256(convert_to(p_title || chr(10) || p_body, 'UTF8')), 'hex'), r.profile_id
  from public.get_announcement_recipients() r
  join public.profiles p on p.id = r.profile_id
  where p_title is not null
    and p_body is not null
    and public.local_hour_within(p.timezone, 10, 20)
  on conflict (announcement_key, profile_id) do nothing
  returning announcement_deliveries.profile_id;
$fn$;

revoke execute on function public.claim_announcement_recipients(text, text) from public, anon, authenticated;
grant execute on function public.claim_announcement_recipients(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. claim_push_token
-- ---------------------------------------------------------------------------
create or replace function public.claim_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_token text := btrim(coalesce(p_token, ''));
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(v_token) > 4096
     or v_token !~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$' then
    raise exception 'invalid_push_token'
      using hint = 'That does not look like a push token.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_me) then
    raise exception 'profile_missing';
  end if;
  perform public.check_rate_limit('claim_push_token', 30, interval '1 hour');

  insert into public.push_tokens as pt (profile_id, expo_push_token)
  values (v_me, v_token)
  on conflict (expo_push_token) do update
    set profile_id = excluded.profile_id,
        created_at = now()
    where pt.profile_id is distinct from excluded.profile_id;
end;
$fn$;

revoke execute on function public.claim_push_token(text) from public, anon, authenticated;
grant execute on function public.claim_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_standouts
-- ---------------------------------------------------------------------------
create or replace function public.get_standouts(p_limit integer default 8)
returns table (
  profile_id uuid,
  display_name text,
  age integer,
  gender public.gender_enum,
  region public.region_enum,
  bio text,
  shared_games_count integer,
  shared_shows_count integer,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_today date := current_date;
  v_existing_count int;
  v_viewer_is_demo boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  -- 0081: 60, was 20. The shipped client refetches this on every swipe (useSwipeAction.ts);
  -- the 1.0.2 build stops that, and this keeps 1.0.1 phones out of rate-limit errors until then.
  perform public.check_rate_limit('get_standouts', 60, interval '5 minutes');

  p_limit := least(greatest(coalesce(p_limit, 8), 1), 50);
  v_viewer_is_demo := public.is_demo_viewer();

  select count(*) into v_existing_count
  from public.daily_standouts ds
  where ds.profile_id = v_me and ds.day = v_today;

  if v_existing_count = 0 then
    insert into public.daily_standouts (profile_id, standout_id, day, position)
    select
      v_me,
      c.id,
      v_today,
      row_number() over (order by coalesce(sg.shared_count, 0) desc, random()) - 1
    from (
      select p.id
      from public.profiles p
      where p.id <> v_me
        and p.is_active = true
        and p.is_admin_suspended = false
        and p.onboarding_completed = true
        and p.is_banned = false
        and (p.is_demo = false or v_viewer_is_demo)
        and not exists (
          select 1 from public.swipes s where s.swiper_id = v_me and s.target_id = p.id
        )
        and not public.is_blocked_pair(v_me, p.id)
        and public.same_age_band(v_me, p.id)
        -- 0081: no push token and nothing in 21 days (0071).
        and not public.is_dormant_profile(p.id)
    ) c
    left join (
      select theirs.profile_id, count(*)::int as shared_count
      from public.profile_games theirs
      join public.profile_games mine on mine.game_id = theirs.game_id and mine.profile_id = v_me
      group by theirs.profile_id
    ) sg on sg.profile_id = c.id
    order by coalesce(sg.shared_count, 0) desc, random()
    limit p_limit;
  end if;

  return query
  select
    p.id,
    p.display_name,
    extract(year from age(current_date, p.dob))::int,
    p.gender,
    p.region,
    p.bio,
    coalesce(sg.shared_count, 0),
    coalesce(ss.shared_count, 0),
    0::numeric
  from public.daily_standouts ds
  join public.profiles p on p.id = ds.standout_id
  left join (
    select theirs.profile_id, count(*)::int as shared_count
    from public.profile_games theirs
    join public.profile_games mine on mine.game_id = theirs.game_id and mine.profile_id = v_me
    group by theirs.profile_id
  ) sg on sg.profile_id = p.id
  left join (
    select theirs.profile_id, count(*)::int as shared_count
    from public.profile_shows theirs
    join public.profile_shows mine on mine.show_id = theirs.show_id and mine.profile_id = v_me
    group by theirs.profile_id
  ) ss on ss.profile_id = p.id
  where ds.profile_id = v_me and ds.day = v_today
  order by ds.position;
end;
$fn$;
