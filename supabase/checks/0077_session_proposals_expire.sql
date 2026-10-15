-- Checks for supabase/migrations/0077_session_proposals_expire.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0077 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0077_session_proposals_expire.sql
--   Before: chain it after the migration(s) in one rolled-back transaction (see 0071's check).
--
-- WHO: the App Review account and its matched demo persona, through propose_session and
-- respond_session as `authenticated`. Proposals are back-dated as postgres. All rolled back
-- (the proposal pushes 0073 queues are discarded with it).

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

-- priya proposes, then the row is moved to p_when (as postgres). Returns the session id.
create function pg_temp.proposal_at(p_when timestamptz) returns uuid
language plpgsql as $f$
declare
  v_id uuid;
begin
  perform pg_temp.act_as('priya');
  select (public.propose_session(pg_temp.id('match'), now() + interval '1 day')).id into v_id;
  reset role;
  update public.match_sessions set scheduled_at = p_when where id = v_id;
  return v_id;
end;
$f$;

-- ===========================================================================
-- A. Contract, schedule, and nothing stale is still pending
-- ===========================================================================
do $$
declare
  v_stale int;
begin
  assert pg_get_function_result('public.respond_session(uuid,boolean)'::regprocedure) = 'match_sessions', 'A: respond_session RETURNS changed';
  assert has_function_privilege('authenticated', 'public.respond_session(uuid,boolean)', 'execute'), 'A: authenticated lost respond_session';
  assert not has_function_privilege('anon', 'public.respond_session(uuid,boolean)', 'execute'), 'A: anon can call respond_session';
  assert not has_function_privilege('authenticated', 'public.expire_stale_session_proposals()', 'execute'), 'A: the expiry sweep is callable by authenticated';
  assert exists (
    select 1 from cron.job
    where jobname = 'session-proposals-expire-15min' and schedule = '7,22,37,52 * * * *'
      and command like '%public.expire_stale_session_proposals()%'
  ), 'A: session-proposals-expire-15min is not scheduled';

  select count(*) into v_stale from public.match_sessions
   where status = 'pending' and scheduled_at < now() - interval '30 minutes';
  assert v_stale = 0, format('A: %s pending proposals are more than 30 minutes past', v_stale);

  insert into check_log (line) values ('A ok: respond_session shape and grants unchanged; sweep scheduled at :07/:22/:37/:52; 0 stale pending proposals');
end;
$$;

-- ===========================================================================
-- B. Confirming a time that has passed cancels it (no error); declining works; 30 minutes of
--    grace; an answer to a proposal that is no longer pending returns it as it is
-- ===========================================================================
--
-- No call here may raise: the shipped 1.0.1 banner only re-reads itself after a SUCCESSFUL
-- respond_session, so an error leaves a Confirm button that fails forever (0077's header).
do $$
declare
  v_rev uuid;
  v_partner uuid;
  v_match uuid;
  v_s uuid;
  v_status text;
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

  -- An hour past: confirm does not confirm. It cancels the proposal and returns it, no error.
  v_s := pg_temp.proposal_at(now() - interval '1 hour');
  perform pg_temp.act_as('rev');
  select (public.respond_session(v_s, true)).status::text into v_status;
  reset role;
  assert v_status = 'cancelled', format('B: confirming a proposal an hour in the past returned %s, not cancelled', v_status);
  assert (select status::text from public.match_sessions where id = v_s) = 'cancelled', 'B: the past proposal is not cancelled in the table';

  -- Answering it again (a second tap on a banner that has not refreshed): the row as it is.
  perform pg_temp.act_as('rev');
  select (public.respond_session(v_s, true)).status::text into v_status;
  reset role;
  assert v_status = 'cancelled', format('B: a second answer to a cancelled proposal returned %s', v_status);

  -- Declining a past proposal works.
  v_s := pg_temp.proposal_at(now() - interval '1 hour');
  perform pg_temp.act_as('rev');
  select (public.respond_session(v_s, false)).status::text into v_status;
  reset role;
  assert v_status = 'declined', 'B: declining a past proposal failed';

  -- 10 minutes past: still inside the grace, confirm works.
  v_s := pg_temp.proposal_at(now() - interval '10 minutes');
  perform pg_temp.act_as('rev');
  select (public.respond_session(v_s, true)).status::text into v_status;
  reset role;
  assert v_status = 'confirmed', 'B: confirming 10 minutes late was refused';

  -- The proposer cannot answer their own proposal: that still raises, as before 0077.
  v_s := pg_temp.proposal_at(now() + interval '1 day');
  perform pg_temp.act_as('priya');
  begin
    perform public.respond_session(v_s, true);
    assert false, 'B: the proposer confirmed their own proposal';
  exception when assert_failure then
    raise;
  when others then
    null;
  end;
  reset role;

  insert into check_log (line) values ('B ok: confirm an hour late -> cancelled and returned, no error; answering it again returns it; decline still works; confirm 10 minutes late still works; the proposer still cannot answer');
end;
$$;

-- ===========================================================================
-- C. The sweep cancels stale pending proposals and leaves the rest
-- ===========================================================================
do $$
declare
  v_stale uuid;
  v_fresh uuid;
begin
  v_stale := pg_temp.proposal_at(now() - interval '2 hours');
  update public.match_sessions set status = 'pending' where id = v_stale;
  insert into public.match_sessions (match_id, proposed_by, scheduled_at)
  values (pg_temp.id('match'), pg_temp.id('priya'), now() + interval '3 hours')
  returning id into v_fresh;

  assert public.expire_stale_session_proposals() >= 1, 'C: the sweep cancelled nothing';
  assert (select status::text from public.match_sessions where id = v_stale) = 'cancelled', 'C: a proposal 2 hours past is still pending';
  assert (select status::text from public.match_sessions where id = v_fresh) = 'pending', 'C: a future proposal was cancelled';

  insert into check_log (line) values ('C ok: the sweep cancels a pending proposal 2 hours past and leaves a future one pending');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
