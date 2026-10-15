-- Checks for supabase/migrations/0078_games_catalog_and_aliases.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0078 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0078_games_catalog_and_aliases.sql
--   Before: chain it after the migration(s) in one rolled-back transaction (see 0071's check).
--
-- WHO: search_games is called as the App Review account (`authenticated`), the way the 1.0.2
-- build will call it. One custom game is inserted as postgres to prove a custom row cannot
-- borrow an alias. All rolled back.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table hits (q text not null, pos int not null, name text not null, is_custom boolean not null);
grant select on chk_ids to authenticated;
grant insert, select on hits to authenticated;

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

-- Run a search as the review account and keep the rows in order.
create function pg_temp.search(p_q text) returns void
language plpgsql as $f$
begin
  perform pg_temp.act_as('rev');
  insert into hits (q, pos, name, is_custom)
  select p_q, (row_number() over ())::int, s.name, s.is_custom from public.search_games(p_q, 25) s;
  reset role;
end;
$f$;

create function pg_temp.top(p_q text) returns text
language sql stable as $f$
  select h.name from hits h where h.q = p_q order by h.pos limit 1
$f$;

-- ===========================================================================
-- A. Schema and grants
-- ===========================================================================
do $$
begin
  assert exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'aliases'
      and data_type = 'ARRAY' and is_nullable = 'NO'
  ), 'A: games.aliases is not a NOT NULL array';
  assert exists (select 1 from pg_constraint where conrelid = 'public.games'::regclass and conname = 'games_aliases_catalog_only'),
    'A: games_aliases_catalog_only is missing';
  assert not has_column_privilege('authenticated', 'public.games', 'aliases', 'INSERT'), 'A: a client can write aliases on insert';
  assert not has_column_privilege('anon', 'public.games', 'aliases', 'INSERT'), 'A: anon can write aliases on insert';
  assert has_function_privilege('authenticated', 'public.search_games(text,integer)', 'execute'), 'A: authenticated cannot search';
  assert not has_function_privilege('anon', 'public.search_games(text,integer)', 'execute'), 'A: anon can search';
  assert (select count(*) from public.games
           where is_custom = false and name in ('NBA 2K26', 'NBA 2K27', 'EA Sports FC 26', 'EA Sports FC 27',
                                                 'Madden NFL 26', 'Madden NFL 27', 'Call of Duty: Black Ops 7', 'ARC Raiders')) = 8,
    'A: not all eight new catalog titles exist as catalog rows';
  assert (select aliases from public.games where lower(name) = 'league of legends' and not is_custom) @> array['lol', 'league'],
    'A: League has no lol/league aliases';
  assert not exists (select 1 from public.games where is_custom and cardinality(aliases) > 0), 'A: a custom game has aliases';
  insert into check_log (line) values ('A ok: aliases column (catalog-only, no client write path); search_games for authenticated only; the 8 new titles exist; League answers to lol and league');
end;
$$;

-- ===========================================================================
-- B. Search finds what people type
-- ===========================================================================
do $$
declare
  v_rev uuid;
begin
  select u.id into v_rev from auth.users u where u.email = 'review@duoqueue.io';
  insert into chk_ids values ('rev', v_rev);

  perform pg_temp.search('lol');
  perform pg_temp.search('LoL ');
  perform pg_temp.search('r6');
  perform pg_temp.search('cod');
  perform pg_temp.search('fn');
  perform pg_temp.search('val');
  perform pg_temp.search('ow');
  perform pg_temp.search('cs');
  perform pg_temp.search('nba2k27');
  perform pg_temp.search('league');
  perform pg_temp.search('%');
  perform pg_temp.search('');

  assert pg_temp.top('lol') = 'League of Legends', format('B: lol -> %s', pg_temp.top('lol'));
  assert pg_temp.top('LoL ') = 'League of Legends', 'B: case or spacing broke the lol alias';
  assert pg_temp.top('r6') = 'Rainbow Six Siege', format('B: r6 -> %s', pg_temp.top('r6'));
  assert pg_temp.top('cod') like 'Call of Duty%', format('B: cod -> %s', pg_temp.top('cod'));
  assert (select count(*) from hits where q = 'cod' and name like 'Call of Duty%') >= 4, 'B: cod finds fewer than 4 Call of Duty titles';
  assert pg_temp.top('fn') = 'Fortnite', format('B: fn -> %s', pg_temp.top('fn'));
  assert pg_temp.top('val') = 'Valorant', format('B: val -> %s', pg_temp.top('val'));
  assert pg_temp.top('ow') = 'Overwatch 2', format('B: ow -> %s', pg_temp.top('ow'));
  assert pg_temp.top('cs') = 'Counter-Strike 2', format('B: cs -> %s', pg_temp.top('cs'));
  assert pg_temp.top('nba2k27') = 'NBA 2K27', format('B: nba2k27 -> %s', pg_temp.top('nba2k27'));
  assert pg_temp.top('league') = 'League of Legends', format('B: league -> %s', pg_temp.top('league'));
  assert not exists (select 1 from hits where q = '%'), 'B: a bare % matched games (wildcard not escaped)';
  assert not exists (select 1 from hits where q = ''), 'B: an empty query returned games';

  insert into check_log (line) values ('B ok: lol, "LoL ", league -> League; r6 -> Siege; cod -> Call of Duty titles first; fn -> Fortnite; val -> Valorant; ow -> Overwatch 2; cs -> Counter-Strike 2; nba2k27 -> NBA 2K27; % and empty find nothing');
end;
$$;

-- ===========================================================================
-- C. A custom game cannot take an alias, and never outranks the catalog
-- ===========================================================================
do $$
declare
  v_raised boolean := false;
  v_league_pos int;
  v_custom_pos int;
begin
  begin
    insert into public.games (name, is_custom, aliases) values ('Check 0078 Custom', true, array['lol']);
  exception when check_violation then
    v_raised := true;
  end;
  assert v_raised, 'C: a custom game was stored with an alias';

  -- Somebody types "lol" as a custom game. League must still come first for "lol".
  insert into public.games (name, is_custom) values ('lol', true);
  perform pg_temp.act_as('rev');
  insert into hits (q, pos, name, is_custom)
  select 'lol-with-custom', (row_number() over ())::int, s.name, s.is_custom from public.search_games('lol', 25) s;
  reset role;
  select pos into v_league_pos from hits where q = 'lol-with-custom' and name = 'League of Legends';
  select pos into v_custom_pos from hits where q = 'lol-with-custom' and name = 'lol' and is_custom;
  assert v_league_pos = 1, format('C: League is at %s, not first, once a custom "lol" exists', v_league_pos);
  assert v_custom_pos > v_league_pos, 'C: the custom "lol" outranks League';

  insert into check_log (line) values (format('C ok: a custom game with an alias is refused; with a custom game named "lol" present, League is still first (custom at %s)', v_custom_pos));
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
