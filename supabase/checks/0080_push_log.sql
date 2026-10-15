-- Checks for supabase/migrations/0080_push_log.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0080 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0080_push_log.sql
--   Before: chain it after the migration(s) in one rolled-back transaction (see 0071's check).
--
-- Writes two rows as service_role (the role the Edge Functions use) and tries to read as
-- authenticated; all rolled back.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);

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

do $$
declare
  v_rev uuid;
  v_raised boolean := false;
  v_seen int;
begin
  -- Schema and grants.
  assert (select relrowsecurity from pg_class where oid = 'public.push_log'::regclass), 'push_log has no RLS';
  assert not has_table_privilege('anon', 'public.push_log', 'select'), 'anon can read push_log';
  assert not has_table_privilege('authenticated', 'public.push_log', 'select'), 'authenticated can read push_log';
  assert not has_table_privilege('authenticated', 'public.push_log', 'insert'), 'authenticated can write push_log';
  assert has_table_privilege('service_role', 'public.push_log', 'select, insert, update, delete'), 'service_role lacks push_log grants';
  assert (select confdeltype from pg_constraint where conrelid = 'public.push_log'::regclass and contype = 'f') = 'c',
    'push_log.recipient_id does not cascade';
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'push_log' and column_name in ('title', 'body', 'data', 'content')
  ), 'push_log has a message content column';
  assert exists (
    select 1 from cron.job where jobname = 'push-log-cleanup-daily' and schedule = '35 9 * * *'
      and command like '%public.prune_push_log()%'
  ), 'push-log-cleanup-daily is not scheduled';
  assert not has_function_privilege('authenticated', 'public.prune_push_log()', 'execute'), 'prune_push_log callable by authenticated';

  -- service_role writes, as the Edge Functions will.
  select u.id into v_rev from auth.users u where u.email = 'review@duoqueue.io';
  set local role service_role;
  insert into public.push_log (recipient_id, category, event, tokens, accepted, ticket_status, error)
  values (v_rev, 'new_player', 'new_like', 2, 1, 'partial', 'DeviceNotRegistered');
  insert into public.push_log (recipient_id, category, event, tokens, accepted, ticket_status, sent_at)
  values (v_rev, 'new_message', 'session_proposed', 1, 1, 'ok', now() - interval '91 days');
  reset role;

  -- The constraints refuse nonsense.
  begin
    insert into public.push_log (recipient_id, category, tokens, accepted, ticket_status)
    values (v_rev, 'new_player', 1, 2, 'ok');
  exception when check_violation then
    v_raised := true;
  end;
  assert v_raised, 'accepted > tokens was stored';

  -- authenticated sees nothing, even its own rows.
  perform set_config('request.jwt.claims', json_build_object('sub', v_rev, 'role', 'authenticated')::text, true);
  begin
    set local role authenticated;
    select count(*) into v_seen from public.push_log;
  exception when insufficient_privilege then
    v_seen := 0;
  end;
  reset role;
  assert v_seen = 0, 'authenticated can read push_log rows';

  assert public.prune_push_log() >= 1, 'the 91-day-old row was not pruned';
  assert exists (select 1 from public.push_log where recipient_id = v_rev and event = 'new_like'), 'a fresh row was pruned';

  insert into check_log (line) values ('ok: push_log RLS on, server-only, cascades, no content columns; service_role can write; bad counts refused; authenticated reads nothing; rows past 90 days pruned daily at 09:35 UTC');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
