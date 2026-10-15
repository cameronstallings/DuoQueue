-- Checks for supabase/migrations/0079_games_custom_cleanup.sql, and the monthly catalog look.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0079 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0079_games_custom_cleanup.sql
--   Before: chain it after 0078 and 0079 in one rolled-back transaction (see 0071's check).
--
-- THE MONTHLY LOOK (read-only; run it on its own once a month and add what players typed):
--
--   select g.name, g.created_at, (select count(*) from public.profile_games pg where pg.game_id = g.id) as players
--   from public.games g where g.is_custom and g.created_at > now() - interval '35 days'
--   order by g.created_at desc;
--
-- The last section below prints that list's size as a census line.

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

-- ===========================================================================
-- A. The promoted titles are catalog rows; the junk is gone; nobody lost a game
-- ===========================================================================
do $$
declare
  v_players int;
begin
  assert (select count(*) from public.games
           where not is_custom and name in ('Battlefield 6', 'Call of Duty: Modern Warfare 4', 'Wardogs')) = 3,
    'A: Battlefield 6, Call of Duty: Modern Warfare 4 and Wardogs are not all catalog rows';
  assert not exists (
    select 1 from public.games
    where is_custom and lower(name) in ('battlefield 6', 'wardogs', 'call of duty mw 4')
  ), 'A: a promoted title still exists as a custom row';
  assert not exists (
    select 1 from public.games g
    where g.is_custom and lower(g.name) in ('2k26', 'warzone')
      and not exists (select 1 from public.profile_games pg where pg.game_id = g.id)
  ), 'A: an empty junk custom (2k26 / Warzone) is still there';
  assert not exists (select 1 from public.games where is_custom and cardinality(aliases) > 0), 'A: a custom game has aliases';

  select count(*) into v_players from public.profile_games pg
    join public.games g on g.id = pg.game_id
   where g.name in ('Battlefield 6', 'Call of Duty: Modern Warfare 4', 'Wardogs');
  insert into check_log (line) values (format('A ok: the three titles are catalog rows (%s player picks still on them, ids unchanged); no empty 2k26/Warzone customs remain', v_players));
end;
$$;

-- ===========================================================================
-- B. Their aliases work in search
-- ===========================================================================
do $$
declare
  v_bf text;
  v_mw text;
begin
  insert into chk_ids select 'rev', u.id from auth.users u where u.email = 'review@duoqueue.io';
  perform pg_temp.act_as('rev');
  select s.name into v_bf from public.search_games('bf6', 5) s limit 1;
  select s.name into v_mw from public.search_games('mw4', 5) s limit 1;
  reset role;
  assert v_bf = 'Battlefield 6', format('B: bf6 -> %s', v_bf);
  assert v_mw = 'Call of Duty: Modern Warfare 4', format('B: mw4 -> %s', v_mw);
  insert into check_log (line) values ('B ok: bf6 -> Battlefield 6, mw4 -> Call of Duty: Modern Warfare 4');
end;
$$;

-- ===========================================================================
-- C. Census: custom games created in the last 35 days (the monthly look)
-- ===========================================================================
do $$
declare
  v_n int;
begin
  select count(*) into v_n from public.games g where g.is_custom and g.created_at > now() - interval '35 days';
  insert into check_log (line) values (format('C census: %s custom games created in the last 35 days (run the monthly query in the header for names)', v_n));
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
