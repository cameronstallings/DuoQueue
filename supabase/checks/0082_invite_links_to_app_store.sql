-- Checks for supabase/migrations/0082_invite_links_to_app_store.sql.
--
-- Read-only in effect (one transaction, rolled back). After 0082 is committed:
--   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0082_invite_links_to_app_store.sql
-- Then the end-to-end check, outside the database:
--   curl -sI https://oflexcazqfuvcikrewnb.supabase.co/functions/v1/invite/ABCDE12345
--   -> Location: https://apps.apple.com/app/apple-store/id6798837181?pt=129274943&ct=invite&mt=8

begin;

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
  v_url text;
begin
  select value into v_url from public.app_config where key = 'app_store_url';
  assert v_url = 'https://apps.apple.com/app/apple-store/id6798837181?pt=129274943&ct=invite&mt=8',
    format('app_store_url is %s', coalesce(v_url, '<missing>'));
  -- What _shared/invite-link.ts inviteRedirectTarget accepts: an https URL, nothing else.
  assert v_url like 'https://%', 'app_store_url is not https (the invite function would fall back to the waitlist)';
  assert (select count(*) from public.app_config where key = 'app_store_url') = 1, 'app_store_url is duplicated';
  assert not has_table_privilege('anon', 'public.app_config', 'select')
      or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_config'),
    'app_config is readable by anon through a policy';
  insert into check_log (line) values ('ok: app_store_url is the App Store campaign link with ct=invite; app_config still has no client policy');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
