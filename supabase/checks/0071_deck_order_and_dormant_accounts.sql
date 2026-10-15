-- Checks for supabase/migrations/0071_deck_order_and_dormant_accounts.sql.
--
-- Plain script, not pgTAP (see supabase/checks/0069_league_rank_duo.sql for why): plpgsql
-- `assert` inside `do` blocks, one transaction, rolled back at the end, nothing left behind.
--
-- HOW TO RUN IT
--   After 0071 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0071_deck_order_and_dormant_accounts.sql
--   Before it is committed: one scratch file holding `begin;`, the migration(s), this file's body
--   (everything between its first `begin;` line and its last `rollback;` line), then `rollback;`.
--   A failure raises and the run prints "QUERY FAILED" with the message. A pass prints the log.
--
-- WHO IT ACTS AS: the App Review account (review@duoqueue.io) and seeded demo personas (other
-- @duoqueue.io demo accounts), read from the database, never printed. Inside the rolled-back
-- transaction a persona is made dormant, made to like the review account and given a shared
-- game; all of that is discarded. RPCs are called as `authenticated` with request.jwt.claims,
-- exactly as PostgREST would.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table deck_rows (run text not null, pos integer not null, profile_id uuid not null);
grant select on chk_ids to authenticated;
grant insert, select on deck_rows to authenticated;

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

-- The review account's deck, as the app asks for it, stored under a run label.
create function pg_temp.deck(p_run text) returns void
language plpgsql as $f$
begin
  perform pg_temp.act_as('rev');
  insert into deck_rows (run, pos, profile_id)
  select p_run, (row_number() over ())::int, d.profile_id from public.get_deck(50) d;
  reset role;
end;
$f$;

-- ===========================================================================
-- A. The shipped contract: shapes and grants
-- ===========================================================================
do $$
begin
  assert pg_get_function_result('public.get_deck(integer)'::regprocedure)
    = 'TABLE(profile_id uuid, display_name text, age integer, gender gender_enum, region region_enum, bio text, shared_games_count integer, shared_shows_count integer, score numeric, lol_duo_eligible boolean)',
    'A: get_deck RETURNS shape changed';
  assert pg_get_function_result('public.get_deck_pool_size()'::regprocedure) = 'integer',
    'A: get_deck_pool_size RETURNS changed';
  assert pg_get_function_result('public.get_party_deck(uuid,integer)'::regprocedure)
    = 'TABLE(profile_id uuid, display_name text, age integer, gender gender_enum, region region_enum, bio text, shared_games_count integer, shared_shows_count integer, score numeric)',
    'A: get_party_deck RETURNS shape changed';

  assert has_function_privilege('authenticated', 'public.get_deck(integer)', 'execute'), 'A: authenticated lost get_deck';
  assert has_function_privilege('authenticated', 'public.get_deck_pool_size()', 'execute'), 'A: authenticated lost get_deck_pool_size';
  assert has_function_privilege('authenticated', 'public.get_party_deck(uuid,integer)', 'execute'), 'A: authenticated lost get_party_deck';
  assert not has_function_privilege('anon', 'public.get_deck(integer)', 'execute'), 'A: anon can call get_deck';

  assert not has_function_privilege('authenticated', 'public.server_group(public.region_enum)', 'execute'), 'A: server_group callable by authenticated';
  assert not has_function_privilege('anon', 'public.server_group(public.region_enum)', 'execute'), 'A: server_group callable by anon';
  assert not has_function_privilege('authenticated', 'public.profile_last_seen_at(uuid)', 'execute'), 'A: profile_last_seen_at callable by authenticated';
  assert not has_function_privilege('anon', 'public.profile_last_seen_at(uuid)', 'execute'), 'A: profile_last_seen_at callable by anon';
  assert not has_function_privilege('authenticated', 'public.is_dormant_profile(uuid)', 'execute'), 'A: is_dormant_profile callable by authenticated';
  assert not has_function_privilege('anon', 'public.is_dormant_profile(uuid)', 'execute'), 'A: is_dormant_profile callable by anon';
  assert not has_function_privilege('authenticated', 'public.deck_gate_hard(uuid,uuid)', 'execute'), 'A: deck_gate_hard callable by authenticated';

  assert position('is_dormant_profile' in pg_get_functiondef('public.get_deck(integer)'::regprocedure)) > 0, 'A: get_deck does not exclude dormant';
  assert position('is_dormant_profile' in pg_get_functiondef('public.deck_gate_hard(uuid,uuid)'::regprocedure)) > 0, 'A: deck_gate_hard does not mirror the dormant rule';
  assert position('is_dormant_profile' in pg_get_functiondef('public.get_party_deck(uuid,integer)'::regprocedure)) > 0, 'A: get_party_deck does not exclude dormant';

  insert into check_log (line) values ('A ok: get_deck, get_deck_pool_size, get_party_deck keep their shapes and grants; the three helpers are server-only; dormant rule present in get_deck, deck_gate_hard, get_party_deck');
end;
$$;

-- ===========================================================================
-- B. server_group
-- ===========================================================================
do $$
begin
  assert public.server_group('na_east') = 'na' and public.server_group('na_west') = 'na', 'B: NA East and West are not one group';
  assert public.server_group('eu') = 'eu' and public.server_group('sa') = 'sa', 'B: a non-NA region is not its own group';
  assert public.server_group(null) is null, 'B: NULL region is not NULL';
  assert public.server_group('na_east') <> public.server_group('sa'), 'B: NA and SA share a group';
  insert into check_log (line) values ('B ok: server_group maps na_east/na_west to na, every other region to itself, NULL to NULL');
end;
$$;

-- ===========================================================================
-- C. Census (live data): how many real accounts are dormant right now
-- ===========================================================================
do $$
declare
  v_real int;
  v_demo int;
begin
  select count(*) into v_real
    from public.profiles p
   where p.onboarding_completed and p.is_active and not p.is_banned and not p.is_demo
     and public.is_dormant_profile(p.id);
  select count(*) into v_demo
    from public.profiles p
   where p.is_demo and public.is_dormant_profile(p.id);
  assert v_demo = 0, format('C: %s demo profiles count as dormant; App Review would lose them from its deck', v_demo);
  insert into check_log (line) values (format('C ok: %s real onboarded accounts are dormant right now; demo profiles are never dormant (0)', v_real));
end;
$$;

-- ===========================================================================
-- D. A dormant account leaves the deck and the pool, and comes back with a push token
-- ===========================================================================
do $$
declare
  v_rev uuid;
  v_d uuid;
  v_pool_a int;
  v_pool_b int;
begin
  select u.id into v_rev from auth.users u where u.email = 'review@duoqueue.io';
  if v_rev is null then
    raise exception 'D: review@duoqueue.io not found';
  end if;
  insert into chk_ids values ('rev', v_rev);

  perform pg_temp.deck('a');
  perform pg_temp.act_as('rev');
  v_pool_a := public.get_deck_pool_size();
  reset role;

  -- A persona in the review deck that has sent no message in 21 days (messages are not
  -- rewritten here), and is not the review account's match partner.
  select dr.profile_id into v_d
    from deck_rows dr
    join auth.users u on u.id = dr.profile_id
   where dr.run = 'a'
     and u.email like '%@duoqueue.io'
     and not exists (
       select 1 from public.messages m
       where m.sender_id = dr.profile_id and m.created_at > now() - interval '21 days'
     )
   order by dr.pos
   limit 1;
  if v_d is null then
    raise exception 'D: no demo persona in the review deck to make dormant';
  end if;
  insert into chk_ids values ('dormant', v_d);

  -- Make it a REAL (non-demo) account with no token and nothing in 60 days.
  update public.profiles
     set is_demo = false, last_active_at = null,
         onboarding_completed_at = now() - interval '60 days', created_at = now() - interval '60 days'
   where id = v_d;
  delete from public.push_tokens where profile_id = v_d;
  update public.swipes set created_at = now() - interval '60 days' where swiper_id = v_d;

  assert public.is_dormant_profile(v_d), 'D: a tokenless account with nothing in 60 days is not dormant';
  assert not public.deck_gate_hard(v_rev, v_d), 'D: deck_gate_hard still passes a dormant account';

  perform pg_temp.deck('b');
  perform pg_temp.act_as('rev');
  v_pool_b := public.get_deck_pool_size();
  reset role;

  assert not exists (select 1 from deck_rows where run = 'b' and profile_id = v_d), 'D: get_deck still returns the dormant account';
  assert v_pool_b = v_pool_a - 1, format('D: pool went %s -> %s, expected one fewer', v_pool_a, v_pool_b);

  -- A push token brings it straight back.
  insert into public.push_tokens (profile_id, expo_push_token) values (v_d, 'ExponentPushToken[check-0071-dormant]');
  assert not public.is_dormant_profile(v_d), 'D: a push token did not end dormancy';
  perform pg_temp.deck('c');
  assert exists (select 1 from deck_rows where run = 'c' and profile_id = v_d), 'D: the account did not come back after getting a token';

  insert into check_log (line) values (format('D ok: dormant account left the deck and the pool (%s -> %s) and came back the moment it had a push token', v_pool_a, v_pool_b));
end;
$$;

-- ===========================================================================
-- E. The order: likers who share a game and the server group first, keys never out of order
-- ===========================================================================
do $$
declare
  v_rev uuid := pg_temp.id('rev');
  v_l uuid;
  v_game uuid;
  v_skill text;
  v_l_pos int;
  v_bad int;
  v_rows int;
begin
  -- A persona in the deck that has never swiped the review account.
  select dr.profile_id into v_l
    from deck_rows dr
    join auth.users u on u.id = dr.profile_id
   where dr.run = 'c'
     and u.email like '%@duoqueue.io'
     and dr.profile_id <> pg_temp.id('dormant')
     and not exists (select 1 from public.swipes s where s.swiper_id = dr.profile_id and s.target_id = v_rev)
   order by dr.pos desc
   limit 1;
  if v_l is null then
    raise exception 'E: no persona left that has not swiped the review account';
  end if;

  -- Same server group as the review account, at least one shared game, and a like.
  update public.profiles set region = (select region from public.profiles where id = v_rev) where id = v_l;
  if not exists (
    select 1 from public.profile_games mine
    join public.profile_games theirs on theirs.game_id = mine.game_id
    where mine.profile_id = v_rev and theirs.profile_id = v_l
  ) then
    select pg.game_id, pg.skill_level::text into v_game, v_skill
      from public.profile_games pg
     where pg.profile_id = v_rev and pg.game_id <> public.lol_game_id()
     limit 1;
    insert into public.profile_games (profile_id, game_id, skill_level, priority)
    values (v_l, v_game, v_skill::public.skill_level_enum, 9);
  end if;
  insert into public.swipes (swiper_id, target_id, action) values (v_l, v_rev, 'like');

  perform pg_temp.deck('d');
  select count(*) into v_rows from deck_rows where run = 'd';
  select pos into v_l_pos from deck_rows where run = 'd' and profile_id = v_l;
  assert v_l_pos is not null, 'E: the liker is not in the deck';

  -- The first four ORDER BY keys, recomputed independently, must never increase down the deck.
  with k as (
    select
      dr.pos,
      exists (select 1 from public.active_boosts ab where ab.profile_id = dr.profile_id and ab.expires_at > now()) as boosted,
      coalesce(public.server_group(c.region) = public.server_group(v.region), false) as same_group,
      (
        exists (select 1 from public.swipes s where s.swiper_id = dr.profile_id and s.target_id = v_rev and s.action = 'like')
        and coalesce(public.server_group(c.region) = public.server_group(v.region), false)
        and exists (
          select 1 from public.profile_games mine
          join public.profile_games theirs on theirs.game_id = mine.game_id
          where mine.profile_id = v_rev and theirs.profile_id = dr.profile_id
        )
      ) as liker,
      coalesce(public.profile_last_seen_at(dr.profile_id) > now() - interval '14 days', false) as recent
    from deck_rows dr
    join public.profiles c on c.id = dr.profile_id
    join public.profiles v on v.id = v_rev
    where dr.run = 'd'
  )
  select count(*) into v_bad
    from k k1
    join k k2 on k2.pos = k1.pos + 1
   where row(k1.boosted, k1.same_group, k1.liker, k1.recent) < row(k2.boosted, k2.same_group, k2.liker, k2.recent);
  assert v_bad = 0, format('E: %s adjacent deck rows are out of key order (boost, group, liker, recent)', v_bad);

  -- And concretely: the liker is above every unboosted same-group card that is not a liker.
  assert not exists (
    select 1
    from deck_rows dr
    join public.profiles c on c.id = dr.profile_id
    where dr.run = 'd'
      and dr.pos < v_l_pos
      and not exists (select 1 from public.active_boosts ab where ab.profile_id = dr.profile_id and ab.expires_at > now())
      and not exists (select 1 from public.swipes s where s.swiper_id = dr.profile_id and s.target_id = v_rev and s.action = 'like')
  ), 'E: an unboosted non-liker sits above the liker';

  insert into check_log (line) values (format('E ok: %s cards, keys (boost, same group, liker with shared game, active 14d) never out of order; the liker is card %s, above every unboosted non-liker', v_rows, v_l_pos));
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
