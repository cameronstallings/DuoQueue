-- Checks for supabase/migrations/0073_play_together_pushes.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0073 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0073_play_together_pushes.sql
--   Before: chain it after the migration(s) in one rolled-back transaction (see 0071's check).
--
-- NO PUSH IS SENT: notify_via_edge_function only enqueues into net.http_request_queue, which a
-- rollback discards (asserted in 0072's check, section 0). The queue is read for payloads.
--
-- WHO: the App Review account and the demo persona it has a live match with (Priya today),
-- acting through the real RPCs and RLS as `authenticated`. Extra matches with other personas
-- are created inside the transaction to test the 5-chat lock. All rolled back.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table chk_base (queue_id bigint not null);
create temp table lock_cmp (match_id uuid primary key, via_auth boolean, via_for boolean);
grant select on chk_ids to authenticated;
grant insert, select, update on lock_cmp to authenticated;

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

create function pg_temp.events(p_type text, p_match uuid) returns setof jsonb
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
  where e.body->>'type' = p_type and e.body->>'matchId' = p_match::text
$f$;

-- ===========================================================================
-- 0. Setup
-- ===========================================================================
do $$
declare
  v_rev uuid;
  v_partner uuid;
  v_match uuid;
begin
  select u.id into v_rev from auth.users u where u.email = 'review@duoqueue.io';
  if v_rev is null then
    raise exception '0: review@duoqueue.io not found';
  end if;
  select m.id, p.id into v_match, v_partner
    from public.matches m
    join public.profiles p on p.id = case when m.user_a_id = v_rev then m.user_b_id else m.user_a_id end
   where v_rev in (m.user_a_id, m.user_b_id)
     and m.unmatched_at is null
     and p.is_demo and not p.is_banned
   order by (p.display_name = 'Priya') desc, m.matched_at
   limit 1;
  if v_match is null then
    raise exception '0: the review account has no live match with a demo persona';
  end if;
  insert into chk_ids values ('rev', v_rev), ('priya', v_partner), ('match', v_match);
  insert into chk_base select coalesce(max(q.id), 0) from net.http_request_queue q;

  -- A clean slate for this match: no claims, no shares, no live proposals.
  delete from public.match_event_pushes where match_id = v_match;
  delete from public.discord_shares where match_id = v_match;
  update public.match_sessions set status = 'cancelled' where match_id = v_match and status = 'pending';
  insert into check_log (line) values ('0 ok: review account and its matched persona found; match cleaned for the test');
end;
$$;

-- ===========================================================================
-- A. Schema and grants
-- ===========================================================================
do $$
begin
  assert exists (select 1 from pg_trigger where tgname = 'on_match_session_proposed' and tgrelid = 'public.match_sessions'::regclass and not tgisinternal),
    'A: on_match_session_proposed is missing';
  assert exists (select 1 from pg_trigger where tgname = 'on_discord_shared' and tgrelid = 'public.discord_shares'::regclass and not tgisinternal),
    'A: on_discord_shared is missing';
  assert exists (select 1 from pg_trigger where tgname = 'enforce_discord_share_has_username_trigger' and tgrelid = 'public.discord_shares'::regclass and not tgisinternal),
    'A: the Discord name guard is missing';

  assert (select relrowsecurity from pg_class where oid = 'public.match_event_pushes'::regclass), 'A: match_event_pushes has no RLS';
  assert not has_table_privilege('anon', 'public.match_event_pushes', 'select'), 'A: anon can read match_event_pushes';
  assert not has_table_privilege('authenticated', 'public.match_event_pushes', 'select'), 'A: authenticated can read match_event_pushes';
  assert has_table_privilege('service_role', 'public.match_event_pushes', 'select, insert, update, delete'), 'A: service_role lacks match_event_pushes grants';
  assert (select count(*) from pg_constraint
           where conrelid = 'public.match_event_pushes'::regclass and contype = 'f' and confdeltype = 'c') = 2,
    'A: match_event_pushes ids do not both cascade';

  assert not has_function_privilege('authenticated', 'public.is_conversation_unlocked_for(uuid,uuid)', 'execute'), 'A: is_conversation_unlocked_for callable by authenticated';
  assert not has_function_privilege('authenticated', 'public.claim_match_event_push(uuid,uuid)', 'execute'), 'A: claim_match_event_push callable by authenticated';
  assert not has_function_privilege('authenticated', 'public.match_event_push_recipient(uuid,uuid)', 'execute'), 'A: match_event_push_recipient callable by authenticated';
  assert has_function_privilege('authenticated', 'public.propose_session(uuid,timestamptz)', 'execute'), 'A: authenticated lost propose_session';

  insert into check_log (line) values ('A ok: both push triggers and the Discord guard exist; match_event_pushes RLS on, server-only, cascades; helpers server-only');
end;
$$;

-- ===========================================================================
-- B. A proposal pushes the other player once an hour, never for a past time
-- ===========================================================================
do $$
declare
  v_match uuid := pg_temp.id('match');
  v_ev jsonb;
  v_first uuid;
begin
  perform pg_temp.act_as('rev');
  select (public.propose_session(v_match, now() + interval '1 day')).id into v_first;
  perform public.propose_session(v_match, now() + interval '2 days');
  reset role;

  assert (select count(*) from pg_temp.events('session_proposed', v_match)) = 1,
    format('B: expected 1 session_proposed after two proposals in an hour, got %s', (select count(*) from pg_temp.events('session_proposed', v_match)));
  select e into v_ev from pg_temp.events('session_proposed', v_match) e;
  assert v_ev ?& array['type', 'matchId', 'sessionId', 'proposerId', 'recipientId'] and (select count(*) from jsonb_object_keys(v_ev)) = 5,
    format('B: session_proposed keys are %s', (select array_agg(k) from jsonb_object_keys(v_ev) k));
  assert v_ev->>'sessionId' = v_first::text, 'B: the push is not for the first proposal';
  assert v_ev->>'proposerId' = pg_temp.id('rev')::text and v_ev->>'recipientId' = pg_temp.id('priya')::text,
    'B: proposer or recipient is wrong';

  -- A past time from the other side: no push (and it would be inside nobody's claim).
  perform pg_temp.act_as('priya');
  perform public.propose_session(v_match, now() - interval '1 hour');
  reset role;
  assert (select count(*) from pg_temp.events('session_proposed', v_match)) = 1, 'B: a proposal for a past time pushed';

  insert into check_log (line) values ('B ok: proposal -> one session_proposed {type, matchId, sessionId, proposerId, recipientId} to the other player; a second within the hour is silent; a past time never pushes');
end;
$$;

-- ===========================================================================
-- C. Discord: no name, no share; with a name, one push to the other player
-- ===========================================================================
do $$
declare
  v_match uuid := pg_temp.id('match');
  v_priya uuid := pg_temp.id('priya');
  v_raised boolean := false;
  v_hint text;
  v_ev jsonb;
begin
  update public.profiles set discord_username = null where id = v_priya;
  perform pg_temp.act_as('priya');
  begin
    insert into public.discord_shares (match_id, shared_by) values (v_match, v_priya);
  exception when others then
    v_raised := sqlerrm = 'discord_username_missing';
    get stacked diagnostics v_hint = pg_exception_hint;
  end;
  reset role;
  assert v_raised, 'C: a share from a player with no Discord name went through';
  assert v_hint = 'Add your Discord username first, then share it.', format('C: hint was %s', v_hint);
  assert not exists (select 1 from public.discord_shares where match_id = v_match and shared_by = v_priya), 'C: the refused share left a row';

  update public.profiles set discord_username = 'priya.check0073' where id = v_priya;
  perform pg_temp.act_as('priya');
  insert into public.discord_shares (match_id, shared_by) values (v_match, v_priya);
  reset role;

  assert (select count(*) from pg_temp.events('discord_shared', v_match)) = 1, 'C: expected one discord_shared';
  select e into v_ev from pg_temp.events('discord_shared', v_match) e;
  assert v_ev ?& array['type', 'matchId', 'shareId', 'sharerId', 'recipientId'] and (select count(*) from jsonb_object_keys(v_ev)) = 5,
    format('C: discord_shared keys are %s', (select array_agg(k) from jsonb_object_keys(v_ev) k));
  assert v_ev->>'sharerId' = v_priya::text and v_ev->>'recipientId' = pg_temp.id('rev')::text, 'C: sharer or recipient is wrong';

  insert into check_log (line) values ('C ok: share with no Discord name refused (discord_username_missing + readable hint, no row); with a name, one discord_shared {type, matchId, shareId, sharerId, recipientId} to the other player');
end;
$$;

-- ===========================================================================
-- D. Blocked or unmatched: nobody to push
-- ===========================================================================
do $$
declare
  v_match uuid := pg_temp.id('match');
  v_rev uuid := pg_temp.id('rev');
  v_priya uuid := pg_temp.id('priya');
begin
  assert public.match_event_push_recipient(v_match, v_rev) = v_priya, 'D: the live match has no recipient';
  assert public.match_event_push_recipient(v_match, gen_random_uuid()) is null, 'D: a stranger got a recipient';

  insert into public.blocks (blocker_id, blocked_id) values (v_priya, v_rev);
  assert public.match_event_push_recipient(v_match, v_rev) is null, 'D: a blocked pair still has a recipient';
  assert (select unmatched_at from public.matches where id = v_match) is not null, 'D: a block no longer sets unmatched_at (0073 header relies on knowing this)';
  delete from public.blocks where blocker_id = v_priya and blocked_id = v_rev;
  assert public.match_event_push_recipient(v_match, v_rev) is null, 'D: an unmatched match still has a recipient';

  insert into check_log (line) values ('D ok: a block (which also sets unmatched_at) and an unmatch both leave nobody to push');
end;
$$;

-- ===========================================================================
-- E. is_conversation_unlocked_for agrees with is_conversation_unlocked, past the 5-chat cap
-- ===========================================================================
do $$
declare
  v_rev uuid := pg_temp.id('rev');
  v_p uuid;
  v_n int := 0;
  v_diff int;
  v_locked int;
begin
  -- Seven more live matches for the review account, so a free account has locked chats.
  for v_p in
    select p.id from public.profiles p join auth.users u on u.id = p.id
     where p.is_demo and p.onboarding_completed and u.email like '%@duoqueue.io'
       and p.id <> v_rev
       and not exists (select 1 from public.matches m where m.user_a_id = least(v_rev, p.id) and m.user_b_id = greatest(v_rev, p.id))
     order by p.id
     limit 7
  loop
    insert into public.matches (user_a_id, user_b_id, matched_at)
    values (least(v_rev, v_p), greatest(v_rev, v_p), now() - make_interval(hours => v_n + 1));
    v_n := v_n + 1;
  end loop;

  insert into lock_cmp (match_id, via_for)
  select m.id, public.is_conversation_unlocked_for(v_rev, m.id)
    from public.matches m
   where v_rev in (m.user_a_id, m.user_b_id) and m.unmatched_at is null;

  perform pg_temp.act_as('rev');
  update lock_cmp set via_auth = public.is_conversation_unlocked(lock_cmp.match_id);
  reset role;

  select count(*) into v_diff from lock_cmp where via_auth is distinct from via_for;
  select count(*) into v_locked from lock_cmp where not via_for;
  assert v_diff = 0, format('E: the two lock rules disagree on %s matches', v_diff);

  insert into check_log (line) values (format('E ok: on %s live matches (%s locked for a free account, 0 if premium) is_conversation_unlocked_for matches is_conversation_unlocked exactly', (select count(*) from lock_cmp), v_locked));
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
