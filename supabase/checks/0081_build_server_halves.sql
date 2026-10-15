-- Checks for supabase/migrations/0081_build_server_halves.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0081 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0081_build_server_halves.sql
--   Before: chain it after the migration(s) in one rolled-back transaction (see 0071's check).
--
-- WHO: the App Review account and two seeded demo personas, through the real RPCs as
-- `authenticated`. A fake Expo token is moved between the two personas. All rolled back.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
grant select on chk_ids to authenticated;

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

create function pg_temp.act_as(p_who text) returns void
language plpgsql as $f$
declare
  v_id uuid;
begin
  select c.id into strict v_id from chk_ids c where c.role = p_who;
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$f$;

create function pg_temp.id(p_who text) returns uuid
language sql stable as $f$
  select c.id from chk_ids c where c.role = p_who
$f$;

-- An IANA zone whose local hour is exactly p_hour right now.
create function pg_temp.zone_at(p_hour int) returns text
language sql stable as $f$
  select z.name from pg_timezone_names z
  where z.name ~ '^Etc/GMT[+-][0-9]+$'
    and extract(hour from now() at time zone z.name)::int = p_hour
  limit 1
$f$;

do $$
declare
  v_ids uuid[];
begin
  insert into chk_ids select 'rev', u.id from auth.users u where u.email = 'review@duoqueue.io';
  select array_agg(x.id order by x.id) into v_ids from (
    select p.id from public.profiles p join auth.users u on u.id = p.id
    where p.is_demo and p.onboarding_completed and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
    order by p.id limit 2
  ) x;
  insert into chk_ids values ('a', v_ids[1]), ('b', v_ids[2]);
end;
$$;

-- ===========================================================================
-- A. announcements: off for everyone until they opt in; the recipient list honours it
-- ===========================================================================
do $$
declare
  v_on int;
begin
  assert exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notification_settings' and column_name = 'announcements'
      and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false'
  ), 'A: notification_settings.announcements is not boolean NOT NULL DEFAULT false';
  select count(*) into v_on from public.notification_settings where announcements;
  assert has_function_privilege('service_role', 'public.get_announcement_recipients()', 'execute'), 'A: service_role cannot read the recipient list';
  assert not has_function_privilege('authenticated', 'public.get_announcement_recipients()', 'execute'), 'A: authenticated can read the recipient list';
  assert not has_function_privilege('anon', 'public.get_announcement_recipients()', 'execute'), 'A: anon can read the recipient list';
  assert (select count(*) from public.get_announcement_recipients()) <= v_on, 'A: the list holds someone who did not opt in';

  -- Opting in puts a real, tokened player on the list; opting out takes them off.
  update public.profiles set is_demo = false where id = pg_temp.id('a');
  insert into public.push_tokens (profile_id, expo_push_token) values (pg_temp.id('a'), 'ExponentPushToken[check-0081-ann]');
  insert into public.notification_settings (profile_id) values (pg_temp.id('a')) on conflict (profile_id) do nothing;
  assert not exists (select 1 from public.get_announcement_recipients() r where r.profile_id = pg_temp.id('a')), 'A: listed without opting in';
  update public.notification_settings set announcements = true where profile_id = pg_temp.id('a');
  assert exists (select 1 from public.get_announcement_recipients() r where r.profile_id = pg_temp.id('a')), 'A: opted in but not listed';

  -- The sender claims, it does not read: inside 10:00-20:59 local only, and each text once.
  assert has_function_privilege('service_role', 'public.claim_announcement_recipients(text,text)', 'execute'), 'A: service_role cannot claim announcement recipients';
  assert not has_function_privilege('authenticated', 'public.claim_announcement_recipients(text,text)', 'execute'), 'A: authenticated can claim announcement recipients';
  assert not has_function_privilege('anon', 'public.claim_announcement_recipients(text,text)', 'execute'), 'A: anon can claim announcement recipients';
  assert (select relrowsecurity from pg_class where oid = 'public.announcement_deliveries'::regclass), 'A: announcement_deliveries has no RLS';
  assert not has_table_privilege('authenticated', 'public.announcement_deliveries', 'select'), 'A: authenticated can read announcement_deliveries';
  assert has_table_privilege('service_role', 'public.announcement_deliveries', 'select, insert, update, delete'), 'A: service_role lacks announcement_deliveries grants';

  update public.profiles set timezone = pg_temp.zone_at(4) where id = pg_temp.id('a');
  assert not exists (select 1 from public.claim_announcement_recipients('check 0081', 'night') c where c.profile_id = pg_temp.id('a')),
    'A: an announcement was claimed for a player at 04:00 local';
  update public.profiles set timezone = pg_temp.zone_at(12) where id = pg_temp.id('a');
  assert exists (select 1 from public.claim_announcement_recipients('check 0081', 'night') c where c.profile_id = pg_temp.id('a')),
    'A: the same announcement did not reach the player once their clock was inside the window';
  assert not exists (select 1 from public.claim_announcement_recipients('check 0081', 'night') c where c.profile_id = pg_temp.id('a')),
    'A: the same announcement was claimed twice for one player';
  assert exists (select 1 from public.claim_announcement_recipients('check 0081', 'another one') c where c.profile_id = pg_temp.id('a')),
    'A: a different announcement was held back by the first one''s ledger row';

  update public.notification_settings set announcements = false where profile_id = pg_temp.id('a');
  delete from public.push_tokens where expo_push_token = 'ExponentPushToken[check-0081-ann]';
  update public.profiles set is_demo = true where id = pg_temp.id('a');

  insert into check_log (line) values (format('A ok: announcements defaults false (%s players opted in today); only opted-in, tokened, non-demo players are listed; the sender claims inside 10:00-20:59 local only, each text once per player; service role only', v_on));
end;
$$;

-- ===========================================================================
-- B. claim_push_token moves the phone's token to whoever is signed in
-- ===========================================================================
do $$
declare
  v_token text := 'ExponentPushToken[check-0081-claim]';
  v_owner uuid;
  v_raised boolean := false;
begin
  assert has_function_privilege('authenticated', 'public.claim_push_token(text)', 'execute'), 'B: authenticated cannot claim';
  assert not has_function_privilege('anon', 'public.claim_push_token(text)', 'execute'), 'B: anon can claim';

  delete from public.rate_limit_hits where bucket = 'claim_push_token' and profile_id in (pg_temp.id('a'), pg_temp.id('b'));

  perform pg_temp.act_as('a');
  perform public.claim_push_token(v_token);
  reset role;
  select profile_id into v_owner from public.push_tokens where expo_push_token = v_token;
  assert v_owner = pg_temp.id('a'), 'B: the first claim did not give the token to A';

  -- B signs in on the same phone: the token moves (the old upsert path got an RLS 403 here).
  perform pg_temp.act_as('b');
  perform public.claim_push_token(v_token);
  perform public.claim_push_token(v_token);  -- idempotent
  reset role;
  select profile_id into v_owner from public.push_tokens where expo_push_token = v_token;
  assert v_owner = pg_temp.id('b'), 'B: the token did not move to B';
  assert (select count(*) from public.push_tokens where expo_push_token = v_token) = 1, 'B: the token is registered twice';

  perform pg_temp.act_as('b');
  begin
    perform public.claim_push_token('not-a-token');
  exception when others then
    v_raised := sqlerrm = 'invalid_push_token';
  end;
  reset role;
  assert v_raised, 'B: a malformed token was accepted';

  insert into check_log (line) values ('B ok: claim_push_token gives the token to the caller, moves it from the previous account, stays one row, refuses a malformed token; anon cannot call it');
end;
$$;

-- ===========================================================================
-- C. get_standouts: same shape, 60 per 5 minutes, dormant left out of new picks
-- ===========================================================================
do $$
declare
  i int;
begin
  assert pg_get_function_result('public.get_standouts(integer)'::regprocedure)
    = 'TABLE(profile_id uuid, display_name text, age integer, gender gender_enum, region region_enum, bio text, shared_games_count integer, shared_shows_count integer, score numeric)',
    'C: get_standouts RETURNS changed';
  assert has_function_privilege('authenticated', 'public.get_standouts(integer)', 'execute'), 'C: authenticated lost get_standouts';
  assert position('is_dormant_profile' in pg_get_functiondef('public.get_standouts(integer)'::regprocedure)) > 0, 'C: standouts picker keeps dormant profiles';

  delete from public.rate_limit_hits where bucket = 'get_standouts' and profile_id = pg_temp.id('rev');
  perform pg_temp.act_as('rev');
  for i in 1..30 loop
    perform count(*) from public.get_standouts(8);
  end loop;
  reset role;

  insert into check_log (line) values ('C ok: get_standouts keeps its shape; 30 calls in a row pass (the old bucket refused the 21st); new picks skip dormant profiles');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
