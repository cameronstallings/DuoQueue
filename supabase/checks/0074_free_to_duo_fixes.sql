-- Checks for supabase/migrations/0074_free_to_duo_fixes.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0074 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0074_free_to_duo_fixes.sql
--   Before: chain it after the migration(s) in one rolled-back transaction (see 0071's check).
--
-- NO PUSH IS SENT: notify_via_edge_function only enqueues into net.http_request_queue, which a
-- rollback discards. The queue is read for payloads.
--
-- WHO: the App Review account (the recipient) and its matched demo persona (the player who
-- turns "free to duo" on), through set_looking_now as `authenticated`. All rolled back.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table chk_base (queue_id bigint not null);
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

create function pg_temp.pings() returns bigint
language sql stable as $f$
  select count(*)
  from net.http_request_queue q
  where q.id > (select b.queue_id from chk_base b)
    and q.method = 'POST'
    and q.body is not null
    and q.url like '%/send-push-notification'
    and convert_from(q.body, 'UTF8')::jsonb->>'type' = 'looking_now'
    and convert_from(q.body, 'UTF8')::jsonb->>'matchId' = (select c.id::text from chk_ids c where c.role = 'match')
$f$;

create function pg_temp.zone_at(p_hour int) returns text
language sql stable as $f$
  select z.name from pg_timezone_names z
  where z.name ~ '^Etc/GMT[+-][0-9]+$'
    and extract(hour from now() at time zone z.name)::int = p_hour
  limit 1
$f$;

-- ===========================================================================
-- A. The sweep is scheduled, and nothing is stuck right now
-- ===========================================================================
do $$
declare
  v_stuck int;
begin
  assert exists (
    select 1 from cron.job
    where jobname = 'looking-now-expire-5min' and schedule = '*/5 * * * *'
      and command like '%public.expire_looking_now()%'
  ), 'A: looking-now-expire-5min is not scheduled every 5 minutes';
  assert not has_function_privilege('authenticated', 'public.expire_looking_now()', 'execute'), 'A: expire_looking_now callable by authenticated';
  assert not has_function_privilege('anon', 'public.expire_looking_now()', 'execute'), 'A: expire_looking_now callable by anon';

  select count(*) into v_stuck from public.profiles
   where is_looking_now and (looking_now_expires_at is null or looking_now_expires_at <= now());
  assert v_stuck = 0, format('A: %s profiles are still ON with an expired window', v_stuck);

  insert into check_log (line) values ('A ok: looking-now-expire-5min runs every 5 minutes; 0 profiles stuck ON with an expired window');
end;
$$;

-- ===========================================================================
-- B. Setup
-- ===========================================================================
do $$
declare
  v_rev uuid;
  v_partner uuid;
  v_match uuid;
begin
  select u.id into v_rev from auth.users u where u.email = 'review@duoqueue.io';
  select m.id, p.id into v_match, v_partner
    from public.matches m
    join public.profiles p on p.id = case when m.user_a_id = v_rev then m.user_b_id else m.user_a_id end
   where v_rev in (m.user_a_id, m.user_b_id) and m.unmatched_at is null and p.is_demo and not p.is_banned
   order by (p.display_name = 'Priya') desc, m.matched_at
   limit 1;
  if v_match is null then
    raise exception 'B: the review account has no live match with a demo persona';
  end if;
  insert into chk_ids values ('rev', v_rev), ('priya', v_partner), ('match', v_match);
  insert into chk_base select coalesce(max(q.id), 0) from net.http_request_queue q;

  -- The recipient (review account) at local noon, switch on; the toggler off; no recent ping.
  update public.profiles set timezone = pg_temp.zone_at(12) where id = v_rev;
  insert into public.notification_settings (profile_id) values (v_rev) on conflict (profile_id) do nothing;
  update public.notification_settings set nudge_online = true where profile_id = v_rev;
  update public.profiles set is_looking_now = false, looking_now_expires_at = null where id = v_partner;
  delete from public.match_nudges where match_id = v_match;

  assert public.is_conversation_unlocked_for(v_rev, v_match), 'B: the review account''s chat with its partner is locked';
  insert into check_log (line) values ('B ok: review account (recipient) at local noon; its matched persona (toggler) starts OFF');
end;
$$;

-- ===========================================================================
-- C. The fix: an expired window re-arms the ping; a live renewal stays silent
-- ===========================================================================
do $$
declare
  v_match uuid := pg_temp.id('match');
  v_priya uuid := pg_temp.id('priya');
  v_before bigint;
  v_ev jsonb;
begin
  -- First time ON: one ping.
  perform pg_temp.act_as('priya');
  perform public.set_looking_now(true);
  reset role;
  assert pg_temp.pings() = 1, format('C: first toggle-on queued %s pings, expected 1', pg_temp.pings());
  select convert_from(q.body, 'UTF8')::jsonb into v_ev
    from net.http_request_queue q
   where q.id > (select b.queue_id from chk_base b) and q.url like '%/send-push-notification'
     and convert_from(q.body, 'UTF8')::jsonb->>'type' = 'looking_now'
   limit 1;
  assert v_ev ?& array['type', 'matchId', 'togglerId', 'recipientId'] and (select count(*) from jsonb_object_keys(v_ev)) = 4,
    format('C: looking_now keys are %s', (select array_agg(k) from jsonb_object_keys(v_ev) k));

  -- Renewal inside the live window: silent, as before.
  perform pg_temp.act_as('priya');
  perform public.set_looking_now(true);
  reset role;
  assert pg_temp.pings() = 1, 'C: a renewal inside a live window pinged';

  -- The hour runs out WITHOUT the sweep (the old stuck state), past the 6-hour cap.
  update public.profiles set looking_now_expires_at = now() - interval '5 minutes' where id = v_priya;
  update public.match_nudges set looking_now_notified_at = now() - interval '7 hours' where match_id = v_match;
  v_before := pg_temp.pings();
  perform pg_temp.act_as('priya');
  perform public.set_looking_now(true);
  reset role;
  assert pg_temp.pings() = v_before + 1, 'C: toggling ON over an EXPIRED window did not ping (the 2 Oct bug)';

  -- And the sweep turns an expired flag OFF.
  update public.profiles set looking_now_expires_at = now() - interval '1 minute' where id = v_priya;
  assert public.expire_looking_now() >= 1, 'C: expire_looking_now cleared nothing';
  assert (select not is_looking_now and looking_now_expires_at is null from public.profiles where id = v_priya),
    'C: the expired flag is still ON after the sweep';

  insert into check_log (line) values ('C ok: first ON pings (keys type/matchId/togglerId/recipientId); a renewal inside the hour is silent; ON over an expired window pings again; the sweep turns expired flags OFF');
end;
$$;

-- ===========================================================================
-- D. Quiet hours: never 01:00-09:59 in the recipient's local time
-- ===========================================================================
do $$
declare
  v_before bigint;
begin
  update public.profiles set timezone = pg_temp.zone_at(4) where id = pg_temp.id('rev');
  update public.match_nudges set looking_now_notified_at = now() - interval '7 hours' where match_id = pg_temp.id('match');
  v_before := pg_temp.pings();
  perform pg_temp.act_as('priya');
  perform public.set_looking_now(false);
  perform public.set_looking_now(true);
  reset role;
  assert pg_temp.pings() = v_before, 'D: a looking-now ping went out at 04:00 recipient local time';
  insert into check_log (line) values ('D ok: no looking-now ping at 04:00 recipient local time');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
