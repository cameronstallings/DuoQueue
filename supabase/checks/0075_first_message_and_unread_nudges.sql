-- Checks for supabase/migrations/0075_first_message_and_unread_nudges.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0075 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0075_first_message_and_unread_nudges.sql
--   Before: chain it after the migration(s) in one rolled-back transaction (see 0071's check).
--
-- NO PUSH IS SENT: notify_via_edge_function only enqueues into net.http_request_queue, which a
-- rollback discards. The queue is read for payloads.
--
-- WHO: seeded demo personas (@duoqueue.io, never the review account) made non-demo inside the
-- transaction, with matches, a message, timezones and a fake push token created as each step
-- needs. The first-message cutoff in app_config is moved back a day INSIDE the transaction so a
-- match "made 4 hours ago" counts as new. All rolled back.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table chk_base (queue_id bigint not null);

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

create function pg_temp.nudges(p_recipient uuid) returns setof jsonb
language sql stable as $f$
  select e.body
  from (
    select convert_from(q.body, 'UTF8')::jsonb as body
    from net.http_request_queue q
    where q.id > (select b.queue_id from chk_base b)
      and q.method = 'POST'
      and q.body is not null
      and q.url like '%/send-push-notification'
  ) e
  where e.body->>'type' = 'first_message_nudge' and e.body->>'recipientId' = p_recipient::text
$f$;

create function pg_temp.zone_at(p_hour int) returns text
language sql stable as $f$
  select z.name from pg_timezone_names z
  where z.name ~ '^Etc/GMT[+-][0-9]+$'
    and extract(hour from now() at time zone z.name)::int = p_hour
  limit 1
$f$;

create function pg_temp.match(p_a uuid, p_b uuid, p_ago interval) returns uuid
language sql as $f$
  insert into public.matches (user_a_id, user_b_id, matched_at)
  values (least(p_a, p_b), greatest(p_a, p_b), now() - p_ago)
  returning id
$f$;

-- ===========================================================================
-- A. Contract, grants, cutoff
-- ===========================================================================
do $$
begin
  assert pg_get_function_result('public.get_stale_unread_conversations()'::regprocedure)
    = 'TABLE(match_id uuid, recipient_id uuid, sender_id uuid, message_id uuid)',
    'A: get_stale_unread_conversations RETURNS changed (send-reengagement-nudges reads these columns)';
  assert has_function_privilege('service_role', 'public.get_stale_unread_conversations()', 'execute'), 'A: service_role lost the unread RPC';
  assert not has_function_privilege('authenticated', 'public.get_stale_unread_conversations()', 'execute'), 'A: unread RPC callable by authenticated';
  assert not has_function_privilege('authenticated', 'public.send_first_message_nudges(integer)', 'execute'), 'A: first-message sweep callable by authenticated';
  assert not has_function_privilege('anon', 'public.send_first_message_nudges(integer)', 'execute'), 'A: first-message sweep callable by anon';

  assert (select relrowsecurity from pg_class where oid = 'public.first_message_nudges'::regclass), 'A: first_message_nudges has no RLS';
  assert not has_table_privilege('authenticated', 'public.first_message_nudges', 'select'), 'A: authenticated can read first_message_nudges';
  assert not has_table_privilege('anon', 'public.first_message_nudges', 'select'), 'A: anon can read first_message_nudges';
  assert has_table_privilege('service_role', 'public.first_message_nudges', 'select, insert, update, delete'), 'A: service_role lacks first_message_nudges grants';
  assert (select count(*) from pg_constraint
           where conrelid = 'public.first_message_nudges'::regclass and contype = 'f' and confdeltype = 'c') = 2,
    'A: first_message_nudges ids do not both cascade';

  assert (select value::timestamptz from public.app_config where key = 'first_message_nudge_since') <= now(),
    'A: first_message_nudge_since is missing, unparseable or in the future';

  insert into chk_base select coalesce(max(q.id), 0) from net.http_request_queue q;
  insert into check_log (line) values ('A ok: unread RPC shape and grants unchanged; first_message_nudges server-only and cascading; the cutoff is set');
end;
$$;

-- ===========================================================================
-- B. Setup: four personas made real; R has a token
-- ===========================================================================
do $$
declare
  v_ids uuid[];
begin
  select array_agg(x.id order by x.id) into v_ids
    from (
      select p.id
      from public.profiles p join auth.users u on u.id = p.id
      where p.is_demo and p.onboarding_completed and p.is_active and not p.is_banned and not p.is_admin_suspended
        and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
      order by p.id desc
      limit 4
    ) x;
  if coalesce(array_length(v_ids, 1), 0) < 4 then
    raise exception 'B: need 4 demo personas';
  end if;
  insert into chk_ids values ('r', v_ids[1]), ('o1', v_ids[2]), ('o2', v_ids[3]), ('o3', v_ids[4]);

  update public.profiles set is_demo = false where id = any (v_ids);
  update public.profiles set timezone = pg_temp.zone_at(12) where id = v_ids[1];
  delete from public.matches
   where (user_a_id = any (v_ids) and user_b_id = any (v_ids));
  insert into public.push_tokens (profile_id, expo_push_token) values (v_ids[1], 'ExponentPushToken[check-0075-r]');
  delete from public.push_tokens where profile_id = any (v_ids[2:4]);
  insert into public.notification_settings (profile_id) values (v_ids[1]) on conflict (profile_id) do nothing;
  update public.notification_settings set nudge_unread = true where profile_id = v_ids[1];
  delete from public.first_message_nudges where recipient_id = v_ids[1];

  -- Matches from the last day count as new for this test.
  update public.app_config set value = to_char((now() - interval '1 day') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where key = 'first_message_nudge_since';

  insert into check_log (line) values ('B ok: four personas made real for the transaction; R at local noon with a token; cutoff moved back one day');
end;
$$;

-- ===========================================================================
-- C. First-message nudge: new silent match yes, old one no, once only
-- ===========================================================================
do $$
declare
  v_r uuid := pg_temp.id('r');
  v_new uuid;
  v_old uuid;
  v_ev jsonb;
  v_sent int;
begin
  v_new := pg_temp.match(v_r, pg_temp.id('o1'), interval '4 hours');
  v_old := pg_temp.match(v_r, pg_temp.id('o2'), interval '2 days');   -- before the cutoff

  v_sent := public.send_first_message_nudges();
  assert v_sent = 1, format('C: the sweep sent %s nudges, expected 1 (R only; the others have no token)', v_sent);
  assert (select count(*) from pg_temp.nudges(v_r)) = 1, 'C: expected one first_message_nudge for R';
  select e into v_ev from pg_temp.nudges(v_r) e;
  assert v_ev ?& array['type', 'matchId', 'recipientId', 'otherId'] and (select count(*) from jsonb_object_keys(v_ev)) = 4,
    format('C: first_message_nudge keys are %s', (select array_agg(k) from jsonb_object_keys(v_ev) k));
  assert v_ev->>'matchId' = v_new::text, 'C: the nudge is not for the new match (the old one is before the cutoff)';
  assert v_ev->>'otherId' = pg_temp.id('o1')::text, 'C: otherId is wrong';

  assert public.send_first_message_nudges() = 0, 'C: a second run nudged again';

  insert into check_log (line) values ('C ok: a 4-hour-old silent match after the cutoff -> one first_message_nudge {type, matchId, recipientId, otherId}; a match from before the cutoff is never nudged; a second run sends nothing');
end;
$$;

-- ===========================================================================
-- D. Not at night, not after a message, not twice in a day
-- ===========================================================================
do $$
declare
  v_r uuid := pg_temp.id('r');
  v_m3 uuid;
begin
  v_m3 := pg_temp.match(v_r, pg_temp.id('o3'), interval '5 hours');

  -- Inside the 24-hour per-recipient limit: nothing.
  assert public.send_first_message_nudges() = 0, 'D: a second match was nudged within 24 hours';

  -- Lift the daily limit, but put R at 04:00 local: still nothing.
  update public.first_message_nudges set sent_at = now() - interval '25 hours' where recipient_id = v_r;
  update public.profiles set timezone = pg_temp.zone_at(4) where id = v_r;
  assert public.send_first_message_nudges() = 0, 'D: nudged at 04:00 local';

  -- Daytime again, but somebody already wrote: nothing.
  update public.profiles set timezone = pg_temp.zone_at(12) where id = v_r;
  insert into public.messages (match_id, sender_id, content, created_at) values (v_m3, pg_temp.id('o3'), 'gg', now() - interval '2 hours');
  assert public.send_first_message_nudges() = 0, 'D: nudged a match that already has a message';

  insert into check_log (line) values ('D ok: no second nudge inside 24 hours, none at 04:00 local, none once a message exists');
end;
$$;

-- ===========================================================================
-- E. The unread nudge: daytime only, never into a blocked pair
-- ===========================================================================
do $$
declare
  v_r uuid := pg_temp.id('r');
  v_m3 uuid;
begin
  select m.id into v_m3 from public.matches m
   where m.user_a_id = least(v_r, pg_temp.id('o3')) and m.user_b_id = greatest(v_r, pg_temp.id('o3'));

  assert exists (select 1 from public.get_stale_unread_conversations() s where s.match_id = v_m3 and s.recipient_id = v_r),
    'E: an unread message 2 hours old at local noon is not offered for a nudge';

  update public.profiles set timezone = pg_temp.zone_at(2) where id = v_r;
  assert not exists (select 1 from public.get_stale_unread_conversations() s where s.recipient_id = v_r),
    'E: an unread nudge offered at 02:00 local';
  update public.profiles set timezone = pg_temp.zone_at(12) where id = v_r;

  insert into public.blocks (blocker_id, blocked_id) values (v_r, pg_temp.id('o3'));
  assert not exists (select 1 from public.get_stale_unread_conversations() s where s.match_id = v_m3),
    'E: an unread nudge offered into a blocked pair';

  insert into check_log (line) values ('E ok: unread nudge offered at local noon, not at 02:00 local, not after a block');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
