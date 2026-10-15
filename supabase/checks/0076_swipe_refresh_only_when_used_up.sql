-- Checks for supabase/migrations/0076_swipe_refresh_only_when_used_up.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0076 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0076_swipe_refresh_only_when_used_up.sql
--   Before: chain it after the migration(s) in one rolled-back transaction (see 0071's check).
--
-- This RPC sends nothing itself (daily-swipes-refreshed does, after reading it), so the checks
-- only read its answer. WHO: one seeded demo persona made non-demo inside the transaction, with
-- a token, a timezone and swipe counters set per step. All rolled back.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);

do $$
begin
  begin
    assert false, 'probe';
    raise exception 'plpgsql.check_asserts is off: every assert in this file would pass silently';
  exception when assert_failure then
    null;
  end;
end;
$$;

create function pg_temp.id(p_who text) returns uuid
language sql stable as $f$
  select c.id from chk_ids c where c.role = p_who
$f$;

create function pg_temp.zone_at(p_hour int) returns text
language sql stable as $f$
  select z.name from pg_timezone_names z
  where z.name ~ '^Etc/GMT[+-][0-9]+$'
    and extract(hour from now() at time zone z.name)::int = p_hour
  limit 1
$f$;

create function pg_temp.listed() returns boolean
language sql stable as $f$
  select exists (
    select 1 from public.get_profiles_needing_swipe_refresh_notification() x
    where x.profile_id = (select c.id from chk_ids c where c.role = 'r')
  )
$f$;

-- Set R's swipe counters for local yesterday and today.
create function pg_temp.counters(p_yesterday int, p_today int) returns void
language plpgsql as $f$
declare
  v_r uuid := (select c.id from chk_ids c where c.role = 'r');
  v_today date;
begin
  select (now() at time zone coalesce(p.timezone, 'utc'))::date into v_today from public.profiles p where p.id = v_r;
  delete from public.daily_swipe_counters where profile_id = v_r and day in (v_today - 1, v_today);
  if p_yesterday is not null then
    insert into public.daily_swipe_counters (profile_id, day, swipe_count) values (v_r, v_today - 1, p_yesterday);
  end if;
  if p_today is not null then
    insert into public.daily_swipe_counters (profile_id, day, swipe_count) values (v_r, v_today, p_today);
  end if;
end;
$f$;

-- ===========================================================================
-- A. Contract
-- ===========================================================================
do $$
begin
  assert pg_get_function_result('public.get_profiles_needing_swipe_refresh_notification()'::regprocedure) = 'TABLE(profile_id uuid)',
    'A: RETURNS changed (daily-swipes-refreshed reads profile_id)';
  assert has_function_privilege('service_role', 'public.get_profiles_needing_swipe_refresh_notification()', 'execute'), 'A: service_role lost the RPC';
  assert not has_function_privilege('authenticated', 'public.get_profiles_needing_swipe_refresh_notification()', 'execute'), 'A: callable by authenticated';
  assert not has_function_privilege('anon', 'public.get_profiles_needing_swipe_refresh_notification()', 'execute'), 'A: callable by anon';
  insert into check_log (line) values ('A ok: shape and grants unchanged');
end;
$$;

-- ===========================================================================
-- B. Who gets "Swipes refreshed!"
-- ===========================================================================
do $$
declare
  v_r uuid;
  v_live int;
begin
  -- Live answer right now, before anything is changed (a census, not an assertion).
  select count(*) into v_live from public.get_profiles_needing_swipe_refresh_notification();

  select p.id into v_r
    from public.profiles p join auth.users u on u.id = p.id
   where p.is_demo and p.onboarding_completed and p.is_active and not p.is_banned and not p.is_admin_suspended
     and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
     and not public.is_premium(p.id)
   order by p.id
   limit 1;
  if v_r is null then
    raise exception 'B: no free demo persona';
  end if;
  insert into chk_ids values ('r', v_r);

  update public.profiles set is_demo = false, timezone = pg_temp.zone_at(10) where id = v_r;
  insert into public.push_tokens (profile_id, expo_push_token) values (v_r, 'ExponentPushToken[check-0076-r]');
  insert into public.notification_settings (profile_id) values (v_r) on conflict (profile_id) do nothing;
  update public.notification_settings set daily_swipes_refreshed = true where profile_id = v_r;
  delete from public.swipe_refresh_notifications where profile_id = v_r;

  -- Ran out yesterday, nothing today, 10:00 local, a deck with people in it: listed.
  perform pg_temp.counters(25, null);
  assert pg_temp.listed(), 'B: a player who ran out yesterday is not listed at 10:00 local';

  perform pg_temp.counters(24, null);
  assert not pg_temp.listed(), 'B: listed with 24 of 25 swipes used yesterday';

  perform pg_temp.counters(25, 1);
  assert not pg_temp.listed(), 'B: listed although already swiping today';

  perform pg_temp.counters(25, null);
  update public.profiles set timezone = pg_temp.zone_at(0) where id = v_r;
  perform pg_temp.counters(25, null);
  assert not pg_temp.listed(), 'B: listed at local midnight';
  update public.profiles set timezone = pg_temp.zone_at(10) where id = v_r;
  perform pg_temp.counters(25, null);

  update public.profiles set is_demo = true where id = v_r;
  assert not pg_temp.listed(), 'B: a demo profile is listed';
  update public.profiles set is_demo = false where id = v_r;

  delete from public.push_tokens where profile_id = v_r;
  assert not pg_temp.listed(), 'B: listed with no push token';
  insert into public.push_tokens (profile_id, expo_push_token) values (v_r, 'ExponentPushToken[check-0076-r]');

  insert into public.swipe_refresh_notifications (profile_id, last_notified_day)
  values (v_r, (now() at time zone pg_temp.zone_at(10))::date)
  on conflict (profile_id) do update set last_notified_day = excluded.last_notified_day;
  assert not pg_temp.listed(), 'B: listed twice on the same local day';

  insert into check_log (line) values (format('B ok: listed only when yesterday hit 25, nothing swiped today, 10:00-21:00 local, not demo, has a token, not told today (live list right now: %s)', v_live));
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
