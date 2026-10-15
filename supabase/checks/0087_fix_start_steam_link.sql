-- Checks for 0087_fix_start_steam_link.sql. Run after the migration is applied:
--   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0087_fix_start_steam_link.sql
-- Everything happens in one transaction that is rolled back; it ends with
-- 'ALL CHECKS PASSED. Rolling back.' or raises at the first failed assert.

begin;

create temp table check_log (n serial primary key, line text not null);

do $$
declare
  v_def text;
  v_acl text;
begin
  v_def := pg_get_functiondef('public.start_steam_link()'::regprocedure);
  assert v_def ~ 'extensions\.gen_random_bytes\(24\)', 'A: start_steam_link does not call extensions.gen_random_bytes';
  assert v_def ~* 'security definer', 'A: start_steam_link is not SECURITY DEFINER';
  assert v_def ~ 'search_path TO ''public''', 'A: search_path changed';

  select string_agg(grantee, ',' order by grantee) into v_acl
  from information_schema.routine_privileges
  where specific_schema = 'public' and routine_name = 'start_steam_link';
  assert v_acl = 'authenticated,postgres,service_role', format('A: unexpected grants %s', v_acl);

  insert into check_log (line) values ('A ok: qualified call, SECURITY DEFINER, search_path public, grants authenticated + service_role only');
end;
$$;

-- B: as a real, non-demo authenticated profile, the call returns a 48-hex state and stores it.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id::text from public.profiles where not coalesce(is_demo, false) and onboarding_completed order by created_at limit 1),
    'role', 'authenticated')::text,
  true);
set local role authenticated;
select set_config('chk.state', public.start_steam_link(), true);
reset role;

do $$
declare
  v_state text := current_setting('chk.state');
  v_me uuid := ((current_setting('request.jwt.claims'))::json ->> 'sub')::uuid;
begin
  assert v_state ~ '^[0-9a-f]{48}$', format('B: state %s is not 48 hex characters', v_state);
  assert (select count(*) from public.steam_link_state where profile_id = v_me) = 1, 'B: no single state row stored for the caller';
  assert (select public.consume_steam_link_state(v_state)) = v_me, 'B: the state does not resolve back to the caller';
  assert (select count(*) from public.steam_link_state where profile_id = v_me) = 0, 'B: consuming did not delete the state';
  insert into check_log (line) values ('B ok: start_steam_link returns a 48-hex state for a signed-in player, and consume_steam_link_state resolves and deletes it');
end;
$$;

-- C: anon still cannot call it.
do $$
begin
  assert not has_function_privilege('anon', 'public.start_steam_link()', 'execute'), 'C: anon can execute start_steam_link';
  insert into check_log (line) values ('C ok: anon cannot execute start_steam_link');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
