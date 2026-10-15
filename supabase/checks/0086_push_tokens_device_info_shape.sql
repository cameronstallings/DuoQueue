-- Checks for supabase/migrations/0086_push_tokens_device_info_shape.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0086 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0086_push_tokens_device_info_shape.sql
--   Before: one scratch file holding `begin;`, the migration, this file's body (everything
--   between its first `begin;` line and its last `rollback;` line), then `rollback;` (see 0071's
--   check). A failure raises and the run prints "QUERY FAILED" with the message. A pass prints
--   the log.
--
-- WHO: one seeded demo persona (an @duoqueue.io demo account, never the review account) and a
-- fake Expo token, written as postgres and as that persona through its own-row policy, exactly
-- as the 1.0.2 app stamps it. All rolled back.

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

-- Whether writing p_info to the fixture's token row is refused by device_info_shape.
create function pg_temp.refused(p_info jsonb) returns boolean
language plpgsql as $f$
begin
  update public.push_tokens set device_info = p_info where expo_push_token = 'ExponentPushToken[check-0086]';
  return false;
exception when check_violation then
  return true;
end;
$f$;

-- ===========================================================================
-- A. The constraint is there, validated, and the own-row policies are untouched
-- ===========================================================================
do $$
begin
  assert exists (
    select 1 from pg_constraint
    where conrelid = 'public.push_tokens'::regclass and conname = 'device_info_shape' and contype = 'c' and convalidated
  ), 'A: device_info_shape is missing or not validated';
  assert pg_get_constraintdef((select oid from pg_constraint where conrelid = 'public.push_tokens'::regclass and conname = 'device_info_shape'))
    like '%jsonb_typeof(device_info) = ''object''%pg_column_size(device_info) <= 2048%', 'A: device_info_shape says something else';
  assert exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_tokens'
                 and policyname = 'push_tokens_update_own' and cmd = 'UPDATE'), 'A: push_tokens_update_own is gone';
  assert exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_tokens'
                 and policyname = 'push_tokens_delete_own' and cmd = 'DELETE'), 'A: push_tokens_delete_own is gone';
  assert not exists (select 1 from public.push_tokens where device_info is not null and jsonb_typeof(device_info) <> 'object'),
    'A: a live row holds a non-object';

  insert into check_log (line) values ('A ok: device_info_shape is a validated CHECK (null, or an object of at most 2048 bytes); push_tokens_update_own and push_tokens_delete_own are untouched');
end;
$$;

-- ===========================================================================
-- B. What passes and what is refused
-- ===========================================================================
do $$
declare
  v_id uuid;
  v_stamp jsonb := jsonb_build_object(
    'app_version', '1.0.2', 'build', '19', 'runtime_version', '1.0.2',
    'update_id', '0b8f1f2a-3c4d-4e5f-8a9b-0c1d2e3f4a5b', 'channel', 'production', 'embedded', false,
    'os', 'ios', 'os_version', '26.0.1', 'key_kind', 'publishable', 'stamped_at', '2026-10-15T09:41:00.000Z'
  );
  v_big jsonb;
  v_ok boolean;
begin
  select p.id into v_id
  from public.profiles p join auth.users u on u.id = p.id
  where p.is_demo and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
  order by p.id limit 1;
  if v_id is null then
    raise exception 'B: no demo persona';
  end if;
  insert into chk_ids values ('p', v_id);
  insert into public.push_tokens (profile_id, expo_push_token) values (v_id, 'ExponentPushToken[check-0086]');

  -- About 3 KB that does not compress, so the bound is tested on its face.
  select jsonb_object_agg('k' || i, md5(i::text) || md5((i + 1)::text)) into v_big from generate_series(1, 40) i;
  assert pg_column_size(v_big) > 2048, 'B: setup: the oversize object is not over 2 KB';

  assert not pg_temp.refused(null), 'B: null was refused (every 1.0.1 row is null)';
  assert not pg_temp.refused('{}'::jsonb), 'B: an empty object was refused';
  assert not pg_temp.refused(v_stamp), 'B: the 1.0.2 stamp was refused';
  assert pg_column_size(v_stamp) < 1024, 'B: the 1.0.2 stamp is over 1 KB';
  assert pg_temp.refused(v_big), 'B: a 3 KB object was accepted';
  assert pg_temp.refused('[1, 2, 3]'::jsonb), 'B: an array was accepted';
  assert pg_temp.refused('"ios"'::jsonb), 'B: a string was accepted';
  assert pg_temp.refused('42'::jsonb), 'B: a number was accepted';

  -- The app's own path: the persona stamps its own row through push_tokens_update_own.
  perform pg_temp.act_as('p');
  update public.push_tokens set device_info = v_stamp where expo_push_token = 'ExponentPushToken[check-0086]';
  begin
    update public.push_tokens set device_info = v_big where expo_push_token = 'ExponentPushToken[check-0086]';
    v_ok := true;
  exception when check_violation then
    v_ok := false;
  end;
  reset role;
  assert (select device_info = v_stamp from public.push_tokens where expo_push_token = 'ExponentPushToken[check-0086]'),
    'B: the owner could not stamp its own row';
  assert v_ok = false, 'B: the owner could store a 3 KB object';

  insert into check_log (line) values ('B ok: null, {} and the real 1.0.2 stamp (under 1 KB) pass, also through the owner''s own-row update; a 3 KB object, an array, a string and a number are refused');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
