-- Checks for supabase/migrations/0084_signed_out_game_search_and_chat_cap_10.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0084 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0084_signed_out_game_search_and_chat_cap_10.sql
--   Before: one scratch file holding `begin;`, the migration, this file's body (everything
--   between its first `begin;` line and its last `rollback;` line), then `rollback;` (see 0071's
--   check). A failure raises and the run prints "QUERY FAILED" with the message. A pass prints
--   the log.
--
-- WHO: twelve seeded demo personas (@duoqueue.io demo accounts, never the review account),
-- none premium (asserted). One of them, X, is given exactly eleven live matches with the other
-- eleven, at staggered times, and the three cap functions are read as X through the real RPCs
-- as `authenticated`. Search is called as `anon` with no JWT. All rolled back.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table chk_matches (pos int primary key, match_id uuid not null);
grant select on chk_ids to authenticated;
grant select on chk_matches to authenticated;

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

create function pg_temp.act_as_anon() returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end;
$f$;

create function pg_temp.id(p_who text) returns uuid
language sql stable as $f$
  select c.id from chk_ids c where c.role = p_who
$f$;

-- ===========================================================================
-- A. search_games: same shape, no auth gate, anon may call it, PUBLIC still may not
-- ===========================================================================
do $$
declare
  v_first text;
  v_lol uuid := public.lol_game_id();
  v_rows int;
  v_def text := pg_get_functiondef('public.search_games(text,integer)'::regprocedure);
begin
  assert pg_get_function_result('public.search_games(text,integer)'::regprocedure)
    = 'TABLE(id uuid, name text, is_custom boolean)', 'A: search_games RETURNS changed';
  assert pg_get_function_arguments('public.search_games(text,integer)'::regprocedure)
    = 'p_query text, p_limit integer DEFAULT 25', 'A: search_games arguments changed';
  assert (select prosecdef and provolatile = 's' from pg_proc where oid = 'public.search_games(text,integer)'::regprocedure),
    'A: search_games is no longer STABLE SECURITY DEFINER';
  assert position('Not authenticated' in v_def) = 0, 'A: search_games still raises for a signed-out caller';
  assert has_function_privilege('anon', 'public.search_games(text,integer)', 'execute'), 'A: anon cannot call search_games';
  assert has_function_privilege('authenticated', 'public.search_games(text,integer)', 'execute'), 'A: authenticated lost search_games';
  assert has_function_privilege('service_role', 'public.search_games(text,integer)', 'execute'), 'A: service_role lost search_games';
  assert not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid = 'public.search_games(text,integer)'::regprocedure and a.grantee = 0
  ), 'A: PUBLIC can execute search_games';
  -- Nothing new is disclosed: anon could already read every games row.
  assert has_table_privilege('anon', 'public.games', 'select'), 'A: anon cannot select games (the disclosure argument depends on it)';
  assert exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'games' and policyname = 'games_select_all'
                 and cmd = 'SELECT' and roles::text = '{public}'), 'A: games_select_all is not a PUBLIC select policy';
  assert v_lol is not null, 'A: no League of Legends catalog row';

  perform pg_temp.act_as_anon();
  assert auth.uid() is null, 'A: setup: the anon caller still has a uid';
  select s.name into v_first from public.search_games('lol', 5) s limit 1;
  select count(*) into v_rows from public.search_games('lol', 5);
  reset role;
  assert v_first = 'League of Legends', format('A: anon search for "lol" returned %s first, not League of Legends', coalesce(v_first, 'nothing'));
  assert v_rows between 1 and 5, 'A: anon search ignored its limit';

  perform pg_temp.act_as_anon();
  select count(*) into v_rows from public.search_games('', 5);
  reset role;
  assert v_rows = 0, 'A: an empty query returned rows';

  insert into check_log (line) values ('A ok: search_games keeps its signature, RETURNS, STABLE SECURITY DEFINER and authenticated/service_role grants; anon (no JWT) can call it and "lol" finds League of Legends first; PUBLIC cannot; anon could already read games');
end;
$$;

-- ===========================================================================
-- B. The three cap functions: same shapes and ACLs, the literal is 10
-- ===========================================================================
do $$
declare
  f text;
  v_def text;
begin
  foreach f in array array[
    'public.is_conversation_unlocked(uuid)',
    'public.is_conversation_unlocked_for(uuid,uuid)',
    'public.get_matches_summary()'
  ] loop
    v_def := pg_get_functiondef(f::regprocedure);
    assert v_def ~ 'limit 10\y', format('B: %s has no "limit 10"', f);
    assert v_def !~ 'limit 5\y', format('B: %s still has "limit 5"', f);
    assert (select prosecdef and provolatile = 's' from pg_proc where oid = f::regprocedure),
      format('B: %s is no longer STABLE SECURITY DEFINER', f);
  end loop;

  assert pg_get_function_result('public.is_conversation_unlocked(uuid)'::regprocedure) = 'boolean', 'B: is_conversation_unlocked RETURNS changed';
  assert pg_get_function_result('public.is_conversation_unlocked_for(uuid,uuid)'::regprocedure) = 'boolean', 'B: is_conversation_unlocked_for RETURNS changed';
  assert pg_get_function_result('public.get_matches_summary()'::regprocedure)
    = 'TABLE(match_id uuid, other_profile_id uuid, other_display_name text, other_photo_path text, last_message text, last_message_at timestamp with time zone, last_message_sender_id uuid, unread_count integer, is_locked boolean)',
    'B: get_matches_summary RETURNS changed';

  -- The ACLs exactly as they were read live on 15 Oct 2026, before this file.
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.is_conversation_unlocked(uuid)'::regprocedure)
    = 'postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres', 'B: is_conversation_unlocked ACL changed';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.is_conversation_unlocked_for(uuid,uuid)'::regprocedure)
    = 'postgres=X/postgres,service_role=X/postgres', 'B: is_conversation_unlocked_for ACL changed';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.get_matches_summary()'::regprocedure)
    = 'postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres', 'B: get_matches_summary ACL changed';

  -- No other live function implements a cap of its own.
  assert not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~* 'limit\s+5\y'
  ), 'B: some live function still has a "limit 5"';

  insert into check_log (line) values ('B ok: is_conversation_unlocked, is_conversation_unlocked_for and get_matches_summary say limit 10 (none says limit 5), with unchanged RETURNS, volatility, SECURITY DEFINER and ACLs');
end;
$$;

-- ===========================================================================
-- C. A free account with 11 live matches has exactly 1 locked: the least recently active
-- ===========================================================================
do $$
declare
  v_ids uuid[];
  v_x uuid;
  i int;
  v_m uuid;
begin
  select array_agg(x.id order by x.id) into v_ids from (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.is_demo and p.onboarding_completed and p.is_active and not p.is_banned and not p.is_admin_suspended
      and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
    order by p.id
    limit 12
  ) x;
  if coalesce(array_length(v_ids, 1), 0) < 12 then
    raise exception 'C: need 12 demo personas, found %', coalesce(array_length(v_ids, 1), 0);
  end if;
  v_x := v_ids[1];
  insert into chk_ids values ('x', v_x);
  for i in 2..12 loop
    insert into chk_ids values ('o' || (i - 1), v_ids[i]);
  end loop;

  assert not public.is_premium(v_x), 'C: X is premium, so the cap would not apply';
  -- X starts from nothing: every match of X is ended, then exactly eleven are made live, the
  -- newest first: o1 matched 1 minute ago ... o11 matched 11 minutes ago. No messages, so
  -- matched_at is the activity.
  update public.matches set unmatched_at = now(), unmatched_by = v_x
   where (user_a_id = v_x or user_b_id = v_x) and unmatched_at is null;
  for i in 1..11 loop
    insert into public.matches (user_a_id, user_b_id, matched_at)
    values (least(v_x, v_ids[i + 1]), greatest(v_x, v_ids[i + 1]), now() - make_interval(mins => i))
    on conflict (user_a_id, user_b_id)
      do update set unmatched_at = null, unmatched_by = null, matched_at = excluded.matched_at
    returning id into v_m;
    insert into chk_matches values (i, v_m);
    -- Older messages would move activity; this pair's activity must be exactly matched_at.
    assert not exists (select 1 from public.messages where match_id = v_m and created_at > now() - make_interval(mins => i)),
      format('C: setup: match %s has a newer message than its matched_at', i);
  end loop;
  assert (select count(*) from public.matches where (user_a_id = v_x or user_b_id = v_x) and unmatched_at is null) = 11,
    'C: setup: X does not have exactly 11 live matches';

  insert into check_log (line) values ('C setup: a non-premium persona X with exactly 11 live matches, matched 1 to 11 minutes ago');
end;
$$;

do $$
declare
  v_total int;
  v_locked int;
  v_locked_id uuid;
  v_unlocked_rpc int := 0;
  v_unlocked_for int := 0;
  r record;
begin
  perform pg_temp.act_as('x');
  select count(*), count(*) filter (where s.is_locked) into v_total, v_locked from public.get_matches_summary() s;
  select s.match_id into v_locked_id from public.get_matches_summary() s where s.is_locked;
  for r in select pos, match_id from chk_matches order by pos loop
    if public.is_conversation_unlocked(r.match_id) then
      v_unlocked_rpc := v_unlocked_rpc + 1;
    end if;
  end loop;
  reset role;

  for r in select pos, match_id from chk_matches order by pos loop
    if public.is_conversation_unlocked_for(pg_temp.id('x'), r.match_id) then
      v_unlocked_for := v_unlocked_for + 1;
    end if;
  end loop;

  assert v_total = 11, format('C: get_matches_summary returned %s rows for X, not 11', v_total);
  assert v_locked = 1, format('C: %s of 11 chats are locked, not exactly 1', v_locked);
  assert v_locked_id = (select match_id from chk_matches where pos = 11), 'C: the locked chat is not the least recently active one';
  assert v_unlocked_rpc = 10, format('C: is_conversation_unlocked opened %s of 11, not 10', v_unlocked_rpc);
  assert v_unlocked_for = 10, format('C: is_conversation_unlocked_for opened %s of 11, not 10', v_unlocked_for);
  assert not public.is_conversation_unlocked_for(pg_temp.id('x'), (select match_id from chk_matches where pos = 11)),
    'C: the 11th chat is unlocked for X server-side';

  insert into check_log (line) values ('C ok: with 11 live matches exactly 1 is locked (the oldest), in get_matches_summary, is_conversation_unlocked and is_conversation_unlocked_for alike');
end;
$$;

do $$
declare
  v_locked int;
begin
  -- A message in the oldest chat makes it the most recent: now the 10th-newest match locks.
  insert into public.messages (match_id, sender_id, content)
  values ((select match_id from chk_matches where pos = 11), pg_temp.id('o11'), 'check 0084');
  perform pg_temp.act_as('x');
  select count(*) filter (where s.is_locked) into v_locked from public.get_matches_summary() s;
  assert (select s.is_locked from public.get_matches_summary() s where s.match_id = (select match_id from chk_matches where pos = 10)),
    'C2: after a message in the oldest chat, the next-oldest did not lock';
  assert public.is_conversation_unlocked((select match_id from chk_matches where pos = 11)), 'C2: the chat with the newest message is locked';
  reset role;
  assert v_locked = 1, format('C2: %s locked after the message, not 1', v_locked);

  -- Ten live matches: nothing locked.
  update public.matches set unmatched_at = now(), unmatched_by = pg_temp.id('x')
   where id = (select match_id from chk_matches where pos = 10);
  perform pg_temp.act_as('x');
  select count(*) filter (where s.is_locked) into v_locked from public.get_matches_summary() s;
  reset role;
  assert v_locked = 0, format('C2: %s locked with exactly 10 live matches, not 0', v_locked);

  insert into check_log (line) values ('C2 ok: a newer message moves a chat into the 10 (the next-oldest locks), and 10 live matches lock nothing');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
