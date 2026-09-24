-- Checks for supabase/migrations/0069_league_rank_duo.sql. Design section 8.1.
--
-- WHY supabase/checks/ AND NOT supabase/tests/: `supabase test db` runs everything under
-- supabase/tests/ through pg_prove as pgTAP, and a plain assert script there reads as a failed
-- plan to whoever runs that command next. This is a plain script: plpgsql `assert` inside `do`
-- blocks, one transaction, rolled back at the end, nothing left behind.
--
-- HOW TO RUN IT
--
--   After 0069 is committed, run this file alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0069_league_rank_duo.sql
--
--   Before 0069 is committed, run it TOGETHER with the migration in one rolled-back
--   transaction: a scratch file holding `begin;`, the migration(s), this file's body (everything
--   between its first `begin;` and its last `rollback;`), then `rollback;`. On 2026-09-23 that
--   was done with 0067, 0068 and 0069 chained, since that is the order they will be applied in.
--
--   A failing check raises (assert_failure, or the named exception) and the run prints
--   "QUERY FAILED" with the message; nothing is committed either way. A passing run prints the
--   log the last statement selects: one line per section, the census, and the review
--   account's deck for each get_deck call. The Management API returns only the last result set,
--   which is why the log is a table rather than a series of selects.
--
-- WHAT IT TOUCHES (all rolled back): the review account's own rows (profile_games, swipes,
-- preferences, region), three demo personas' League rows and regions (Dae, Devon, Marcus),
-- every active_boosts row, and one custom games row inserted as the review account. It calls
-- get_deck four times as the review account, under get_deck's 40-per-minute limit. The
-- ACCESS EXCLUSIVE lock 0069 takes on profile_games is held for the whole transaction when the
-- two run together, so run it at a quiet hour.
--
-- Divisions are bare integer literals throughout, which works because the helpers take
-- integer (0069 section 3).

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);

-- A plpgsql assert is a no-op when plpgsql.check_asserts is off, and then every check below
-- would pass without checking anything. Refuse to run in that state.
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

-- ===========================================================================
-- A. Pure functions (as postgres)
-- ===========================================================================

-- A1. Riot's rows: at least one true and one false per row.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('iron', 4, 'silver', 1, true),
      ('iron', 1, 'gold', 4, false),
      ('bronze', 2, 'iron', 4, true),
      ('bronze', 1, 'gold', 4, false),
      ('silver', 4, 'gold', 1, true),
      ('silver', 1, 'platinum', 4, false),
      ('gold', 2, 'silver', 4, true),
      ('gold', 2, 'platinum', 1, true),
      ('gold', 4, 'bronze', 1, false),
      ('gold', 1, 'emerald', 4, false),
      ('platinum', 3, 'gold', 4, true),
      ('platinum', 1, 'emerald', 1, true),
      ('platinum', 1, 'diamond', 4, false),
      ('emerald', 2, 'diamond', 3, true),
      ('emerald', 1, 'platinum', 4, true),
      ('emerald', 4, 'gold', 1, false),
      ('diamond', 4, 'emerald', 2, true),
      ('diamond', 2, 'diamond', 4, true),
      ('diamond', 4, 'diamond', 1, false),
      ('diamond', 1, 'diamond', 1, true),
      ('diamond', 1, 'emerald', 1, false)
    ) v(a_tier, a_div, b_tier, b_div, expected)
  loop
    assert public.lol_solo_duo_eligible(r.a_tier, r.a_div, r.b_tier, r.b_div) is not distinct from r.expected,
      format('A1: %s %s x %s %s should be %s', r.a_tier, r.a_div, r.b_tier, r.b_div, r.expected);
  end loop;
  insert into check_log (line) values ('A1 ok: 21 Riot-row cases');
end;
$$;

-- A2. Unknown pairs are null. A3. Apex pairs Riot refuses are false.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('unranked', null::int, 'gold', 2),
      (null, null, 'gold', 2),
      ('master', null, 'master', null),
      ('master', null, 'diamond', 1),
      -- the eight table-disagreement pairs (design 1.4)
      ('emerald', 4, 'diamond', 4),
      ('emerald', 4, 'diamond', 3),
      ('emerald', 3, 'diamond', 4),
      ('emerald', 3, 'diamond', 3),
      ('emerald', 2, 'diamond', 2),
      ('emerald', 1, 'diamond', 2),
      ('diamond', 3, 'diamond', 1),
      ('diamond', 2, 'diamond', 1)
    ) v(a_tier, a_div, b_tier, b_div)
  loop
    assert public.lol_solo_duo_eligible(r.a_tier, r.a_div, r.b_tier, r.b_div) is null,
      format('A2: %s %s x %s %s should be null', r.a_tier, r.a_div, r.b_tier, r.b_div);
    assert public.lol_solo_duo_eligible(r.b_tier, r.b_div, r.a_tier, r.a_div) is null,
      format('A2: %s %s x %s %s should be null', r.b_tier, r.b_div, r.a_tier, r.a_div);
  end loop;

  for r in
    select * from (values
      ('master', null::int, 'diamond', 2),
      ('grandmaster', null, 'grandmaster', null),
      ('challenger', null, 'master', null),
      ('grandmaster', null, 'iron', 4)
    ) v(a_tier, a_div, b_tier, b_div)
  loop
    assert public.lol_solo_duo_eligible(r.a_tier, r.a_div, r.b_tier, r.b_div) is false,
      format('A3: %s %s x %s %s should be false', r.a_tier, r.a_div, r.b_tier, r.b_div);
  end loop;
  insert into check_log (line) values ('A2 ok: 12 null pairs, both orders. A3 ok: 4 apex false pairs');
end;
$$;

-- A4. Checksum over the 32 choices. A5. Symmetry.
do $$
declare
  v_choices int;
  v_true int;
  v_false int;
  v_null int;
  v_asym int;
begin
  create temp table lol_choices (tier text, division int) on commit drop;
  insert into lol_choices values
    ('iron', 4), ('iron', 3), ('iron', 2), ('iron', 1),
    ('bronze', 4), ('bronze', 3), ('bronze', 2), ('bronze', 1),
    ('silver', 4), ('silver', 3), ('silver', 2), ('silver', 1),
    ('gold', 4), ('gold', 3), ('gold', 2), ('gold', 1),
    ('platinum', 4), ('platinum', 3), ('platinum', 2), ('platinum', 1),
    ('emerald', 4), ('emerald', 3), ('emerald', 2), ('emerald', 1),
    ('diamond', 4), ('diamond', 3), ('diamond', 2), ('diamond', 1),
    ('master', null), ('grandmaster', null), ('challenger', null), ('unranked', null);

  select count(*) into v_choices from lol_choices;
  assert v_choices = 32, format('A4: expected 32 choices, got %s', v_choices);

  select count(*) filter (where e is true),
         count(*) filter (where e is false),
         count(*) filter (where e is null)
    into v_true, v_false, v_null
    from (
      select public.lol_solo_duo_eligible(a.tier, a.division, b.tier, b.division) as e
      from lol_choices a cross join lol_choices b
    ) x;
  assert v_true = 306 and v_false = 636 and v_null = 82,
    format('A4: checksum should be 306 / 636 / 82, got %s / %s / %s', v_true, v_false, v_null);

  select count(*) into v_asym
    from lol_choices a cross join lol_choices b
   where public.lol_solo_duo_eligible(a.tier, a.division, b.tier, b.division)
         is distinct from public.lol_solo_duo_eligible(b.tier, b.division, a.tier, a.division);
  assert v_asym = 0, format('A5: %s asymmetric pairs', v_asym);

  insert into check_log (line)
    values (format('A4 ok: 1,024 pairs = %s true, %s false, %s null. A5 ok: symmetric', v_true, v_false, v_null));
end;
$$;

-- A6. Parser. Every call returns exactly one row, (null, null) included.
do $$
declare
  r record;
  v_tier text;
  v_div smallint;
  v_rows int;
begin
  for r in
    select * from (values
      ('Iron 1', 'iron', 1),
      ('Iron 3', 'iron', 3),
      ('Diamond II', 'diamond', 2),
      ('plat 2', 'platinum', 2),
      ('GOLD iv', 'gold', 4),
      ('gold4', 'gold', 4),
      ('  Silver   I ', 'silver', 1),
      ('Master', 'master', null::int),
      ('Master I', 'master', null),
      ('gm', 'grandmaster', null),
      ('Grand Master', 'grandmaster', null),
      ('Unranked', 'unranked', null),
      ('Diamond', null, null),
      ('Gold V', null, null),
      ('Immortal 1', null, null),
      ('Master 400 LP', null, null),
      ('', null, null),
      (null, null, null)
    ) v(txt, tier, division)
  loop
    select count(*) into v_rows from public.lol_parse_rank_text(r.txt);
    assert v_rows = 1, format('A6: %L returned %s rows', r.txt, v_rows);

    select p.tier, p.division into v_tier, v_div from public.lol_parse_rank_text(r.txt) p;
    assert v_tier is not distinct from r.tier and v_div is not distinct from r.division,
      format('A6: %L parsed to (%s, %s), expected (%s, %s)', r.txt, v_tier, v_div, r.tier, r.division);
  end loop;
  insert into check_log (line) values ('A6 ok: 12 accepted, 6 rejected, one row each');
end;
$$;

-- A7. Labels.
do $$
begin
  assert public.lol_rank_label('gold', 2) = 'Gold II', 'A7: gold 2';
  assert public.lol_rank_label('iron', 4) = 'Iron IV', 'A7: iron 4';
  assert public.lol_rank_label('master', null) = 'Master', 'A7: master';
  assert public.lol_rank_label('grandmaster', null) = 'Grandmaster', 'A7: grandmaster';
  assert public.lol_rank_label('unranked', null) = 'Unranked', 'A7: unranked';
  assert public.lol_rank_label('gold', null) is null, 'A7: gold with no division';
  insert into check_log (line) values ('A7 ok: labels');
end;
$$;

-- ===========================================================================
-- B. Constraints and trigger (as postgres, on the review account's rows)
-- ===========================================================================

do $$
declare
  v_rev uuid;
  v_league uuid := public.lol_game_id();
  v_other uuid;
  v_row record;
  v_hint text;
  v_bad record;
begin
  select u.id into v_rev from auth.users u where u.email = 'review@duoqueue.io';
  if v_rev is null then
    raise exception 'B: review@duoqueue.io not found; sections B and D need it';
  end if;
  if v_league is null then
    raise exception 'B: lol_game_id() is null; the League row is missing or unmarked';
  end if;

  select pg.game_id into v_other
    from public.profile_games pg
   where pg.profile_id = v_rev and pg.game_id <> v_league
   order by pg.priority
   limit 1;
  if v_other is null then
    raise exception 'B: the review account has no non-League game to test against';
  end if;

  delete from public.profile_games where profile_id = v_rev and game_id = v_league;

  -- B8. Invalid pairs on the League row fail lol_division_matches_tier / lol_tier_valid (23514).
  for v_bad in
    select * from (values ('gold', null::int), ('master', 1), ('silver', 5), ('Gold', 2)) v(tier, division)
  loop
    begin
      insert into public.profile_games (profile_id, game_id, skill_level, lol_tier, lol_division)
      values (v_rev, v_league, 'casual', v_bad.tier, v_bad.division);
      raise exception 'B8: (%, %) was accepted on the League row', v_bad.tier, v_bad.division;
    exception when check_violation then
      null;
    end;
  end loop;

  -- B9. A tier on a non-League row raises lol_rank_not_league, with its sentence as the hint.
  begin
    update public.profile_games set lol_tier = 'gold', lol_division = 2
     where profile_id = v_rev and game_id = v_other;
    raise exception 'B9: a tier was accepted on a non-League row';
  exception when raise_exception then
    if sqlerrm <> 'lol_rank_not_league' then
      raise;
    end if;
    get stacked diagnostics v_hint = pg_exception_hint;
    assert v_hint = 'A League of Legends rank can only be set on the League of Legends game.',
      format('B9: unexpected hint %L', v_hint);
  end;

  -- B10. Text only, parseable: structured rank and canonical label.
  insert into public.profile_games (profile_id, game_id, skill_level, rank_text)
  values (v_rev, v_league, 'casual', 'plat 2');
  select * into v_row from public.profile_games where profile_id = v_rev and game_id = v_league;
  assert v_row.lol_tier = 'platinum' and v_row.lol_division = 2 and v_row.rank_text = 'Platinum II',
    format('B10: got (%s, %s, %L)', v_row.lol_tier, v_row.lol_division, v_row.rank_text);
  delete from public.profile_games where profile_id = v_rev and game_id = v_league;

  -- B11. Structured rank wins over whatever text came with it.
  insert into public.profile_games (profile_id, game_id, skill_level, rank_text, lol_tier, lol_division)
  values (v_rev, v_league, 'casual', 'whatever', 'gold', 2);
  select * into v_row from public.profile_games where profile_id = v_rev and game_id = v_league;
  assert v_row.rank_text = 'Gold II', format('B11: got %L', v_row.rank_text);
  delete from public.profile_games where profile_id = v_rev and game_id = v_league;

  -- B12. Unparseable text is kept, with no tier.
  insert into public.profile_games (profile_id, game_id, skill_level, rank_text)
  values (v_rev, v_league, 'casual', 'hardstuck');
  select * into v_row from public.profile_games where profile_id = v_rev and game_id = v_league;
  assert v_row.lol_tier is null and v_row.lol_division is null and v_row.rank_text = 'hardstuck',
    format('B12: got (%s, %s, %L)', v_row.lol_tier, v_row.lol_division, v_row.rank_text);
  delete from public.profile_games where profile_id = v_rev and game_id = v_league;

  -- B13. A text-only UPDATE re-derives the structured rank from the newer text.
  insert into public.profile_games (profile_id, game_id, skill_level, lol_tier, lol_division)
  values (v_rev, v_league, 'casual', 'gold', 2);
  update public.profile_games set rank_text = 'Silver I' where profile_id = v_rev and game_id = v_league;
  select * into v_row from public.profile_games where profile_id = v_rev and game_id = v_league;
  assert v_row.lol_tier = 'silver' and v_row.lol_division = 1 and v_row.rank_text = 'Silver I',
    format('B13: got (%s, %s, %L)', v_row.lol_tier, v_row.lol_division, v_row.rank_text);

  -- B14. A tier-only UPDATE rewrites the label.
  update public.profile_games set lol_tier = 'emerald', lol_division = 4
   where profile_id = v_rev and game_id = v_league;
  select * into v_row from public.profile_games where profile_id = v_rev and game_id = v_league;
  assert v_row.rank_text = 'Emerald IV', format('B14: got %L', v_row.rank_text);
  delete from public.profile_games where profile_id = v_rev and game_id = v_league;

  -- B15. A non-League row's text is never parsed or normalized.
  update public.profile_games set rank_text = 'Gold II' where profile_id = v_rev and game_id = v_other;
  select * into v_row from public.profile_games where profile_id = v_rev and game_id = v_other;
  assert v_row.lol_tier is null and v_row.lol_division is null and v_row.rank_text = 'Gold II',
    format('B15: got (%s, %s, %L)', v_row.lol_tier, v_row.lol_division, v_row.rank_text);
  update public.profile_games set rank_text = 'plat 2' where profile_id = v_rev and game_id = v_other;
  select * into v_row from public.profile_games where profile_id = v_rev and game_id = v_other;
  assert v_row.lol_tier is null and v_row.rank_text = 'plat 2', format('B15: got %L', v_row.rank_text);

  -- B17. Clearing works (both null stays both null), and the trap the client rule exists for:
  -- re-sending a canonical label with no tier re-creates the rank.
  insert into public.profile_games (profile_id, game_id, skill_level, rank_text, lol_tier, lol_division)
  values (v_rev, v_league, 'casual', null, null, null);
  select * into v_row from public.profile_games where profile_id = v_rev and game_id = v_league;
  assert v_row.lol_tier is null and v_row.lol_division is null and v_row.rank_text is null,
    format('B17: got (%s, %s, %L)', v_row.lol_tier, v_row.lol_division, v_row.rank_text);
  delete from public.profile_games where profile_id = v_rev and game_id = v_league;

  insert into public.profile_games (profile_id, game_id, skill_level, rank_text, lol_tier, lol_division)
  values (v_rev, v_league, 'casual', 'Gold II', null, null);
  select * into v_row from public.profile_games where profile_id = v_rev and game_id = v_league;
  assert v_row.lol_tier = 'gold' and v_row.lol_division = 2,
    format('B17: a re-sent "Gold II" gave (%s, %s)', v_row.lol_tier, v_row.lol_division);
  delete from public.profile_games where profile_id = v_rev and game_id = v_league;

  insert into check_log (line) values ('B8-B15, B17 ok: constraints, lol_rank_not_league (and its hint), parse, label, text-only update, clearing');
end;
$$;

-- B16. Backfill census: every League rank that parses is structured, and every structured one
-- carries its canonical label. Expected on hosted 2026-09-23, right after 0069: 3 structured,
-- 0 left as free text.
do $$
declare
  v_league uuid := public.lol_game_id();
  v_structured int;
  v_text_only int;
  v_unstructured_parseable int;
  v_noncanonical int;
begin
  select count(*) filter (where pg.lol_tier is not null),
         count(*) filter (where pg.lol_tier is null and pg.rank_text is not null)
    into v_structured, v_text_only
    from public.profile_games pg where pg.game_id = v_league;

  select count(*) into v_unstructured_parseable
    from public.profile_games pg
    cross join lateral public.lol_parse_rank_text(pg.rank_text) p
   where pg.game_id = v_league and pg.lol_tier is null and p.tier is not null;
  assert v_unstructured_parseable = 0,
    format('B16: %s League rows have a parseable rank_text but no tier', v_unstructured_parseable);

  select count(*) into v_noncanonical
    from public.profile_games pg
   where pg.game_id = v_league and pg.lol_tier is not null
     and pg.rank_text is distinct from public.lol_rank_label(pg.lol_tier, pg.lol_division);
  assert v_noncanonical = 0, format('B16: %s structured League rows carry a non-canonical label', v_noncanonical);

  select count(*) into v_noncanonical
    from public.profile_games pg
   where pg.game_id is distinct from v_league and (pg.lol_tier is not null or pg.lol_division is not null);
  assert v_noncanonical = 0, format('B16: %s non-League rows carry a League rank', v_noncanonical);

  insert into check_log (line)
    values (format('B16 ok: League rows structured = %s, left as free text = %s, parseable-but-unstructured = 0', v_structured, v_text_only));
end;
$$;

-- ===========================================================================
-- C. Grants
-- ===========================================================================

-- C18. No client role can execute any helper or the trigger function.
-- C19. get_deck's ACL is exactly the pre-0069 live ACL (compared as a set, since aclitem order
--      depends on grant history, not on who holds what).
do $$
declare
  v_fn text;
  v_role text;
  v_acl text[];
  v_argnames text[];
begin
  foreach v_fn in array array[
    'public.lol_rank_ordinal(text,integer)',
    'public.lol_rank_label(text,integer)',
    'public.lol_parse_rank_text(text)',
    'public.lol_solo_duo_eligible(text,integer,text,integer)',
    'public.lol_game_id()',
    'public.sync_profile_game_lol_rank()'
  ] loop
    foreach v_role in array array['anon', 'authenticated'] loop
      assert not has_function_privilege(v_role, v_fn, 'execute'),
        format('C18: %s can execute %s', v_role, v_fn);
    end loop;
  end loop;

  select array_agg(a::text order by a::text) into v_acl
    from pg_proc p cross join lateral unnest(p.proacl) a
   where p.oid = 'public.get_deck(integer)'::regprocedure;
  assert v_acl = array['authenticated=X/postgres', 'postgres=X/postgres', 'service_role=X/postgres'],
    format('C19: get_deck ACL is %s', v_acl);
  assert not has_function_privilege('anon', 'public.get_deck(integer)', 'execute'), 'C19: anon can execute get_deck';
  assert has_function_privilege('authenticated', 'public.get_deck(integer)', 'execute'), 'C19: authenticated cannot execute get_deck';

  select p.proargnames into v_argnames from pg_proc p where p.oid = 'public.get_deck(integer)'::regprocedure;
  assert v_argnames[array_length(v_argnames, 1)] = 'lol_duo_eligible',
    format('C19: get_deck''s last output column is %s', v_argnames[array_length(v_argnames, 1)]);

  insert into check_log (line)
    values (format('C18 ok: 6 functions, no anon/authenticated EXECUTE. C19 ok: get_deck ACL %s, lol_duo_eligible last', v_acl));
end;
$$;

-- C20. games INSERT: authenticated holds exactly (name, is_custom, created_by); anon nothing.
do $$
declare
  v_cols text[];
  v_anon int;
begin
  select array_agg(cp.column_name::text order by cp.column_name) into v_cols
    from information_schema.column_privileges cp
   where cp.table_schema = 'public' and cp.table_name = 'games'
     and cp.grantee = 'authenticated' and cp.privilege_type = 'INSERT';
  assert v_cols = array['created_by', 'is_custom', 'name'], format('C20: authenticated INSERT columns %s', v_cols);

  select count(*) into v_anon
    from information_schema.column_privileges cp
   where cp.table_schema = 'public' and cp.table_name = 'games'
     and cp.grantee = 'anon' and cp.privilege_type = 'INSERT';
  assert v_anon = 0, format('C20: anon holds INSERT on %s games columns', v_anon);
end;
$$;

-- ...and proven by use, as the review account: the exact insert the app makes succeeds
-- (createCustomCatalogEntry: insert({ name, is_custom, created_by }).select("id, name"), i.e.
-- INSERT ... RETURNING id, name), and the same insert naming riot_queue is refused (42501).
select set_config(
  'request.jwt.claims',
  (select json_build_object('sub', u.id, 'role', 'authenticated')::text from auth.users u where u.email = 'review@duoqueue.io'),
  true
);
set local role authenticated;

insert into public.games (name, is_custom, created_by) values ('0069 check game', true, auth.uid())
returning id, name;

do $$
begin
  begin
    insert into public.games (name, is_custom, created_by, riot_queue)
    values ('0069 check game 2', true, auth.uid(), null);
    raise exception 'C20: an insert naming riot_queue was allowed';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

do $$
begin
  assert exists (
    select 1 from public.games g
    join auth.users u on u.id = g.created_by
    where g.name = '0069 check game' and g.is_custom and u.email = 'review@duoqueue.io'
  ), 'C20: the app''s own custom-game insert did not land';
  insert into check_log (line) values ('C20 ok: INSERT on games is exactly (created_by, is_custom, name); app insert works as the reviewer; riot_queue refused with 42501');
end;
$$;

-- C21. public_profile_games is untouched: anon no SELECT, authenticated SELECT only, and 0067's
-- age-gate wrap still in place when 0067 is applied.
do $$
declare
  v_wrapped boolean;
begin
  assert not has_table_privilege('anon', 'public.public_profile_games', 'select'), 'C21: anon can select';
  assert has_table_privilege('authenticated', 'public.public_profile_games', 'select'), 'C21: authenticated cannot select';
  assert not has_table_privilege('authenticated', 'public.public_profile_games', 'insert'), 'C21: authenticated can insert';
  assert not has_table_privilege('authenticated', 'public.public_profile_games', 'update'), 'C21: authenticated can update';
  assert not has_table_privilege('authenticated', 'public.public_profile_games', 'delete'), 'C21: authenticated can delete';

  if to_regprocedure('public.viewer_age_verified()') is not null then
    v_wrapped := position('viewer_age_verified' in pg_get_viewdef('public.public_profile_games'::regclass)) > 0;
    assert v_wrapped, 'C21: public_profile_games lost its viewer_age_verified() wrap';
    insert into check_log (line) values ('C21 ok: public_profile_games grants unchanged; 0067 wrap present');
  else
    insert into check_log (line) values ('C21 ok: public_profile_games grants unchanged; 0067 not applied, wrap not checked');
  end if;
end;
$$;

-- ===========================================================================
-- D. get_deck as the review account (the DB skill pattern)
-- ===========================================================================
--
-- Setup as postgres. The reviewer's swipes and every active boost are removed and its
-- preference filters nulled, so no persona is missing for a reason unrelated to 0069. The
-- reviewer gets Gold II in na_east. P1 (Dae) is set to Silver I in na_west: eligible both ways
-- with Gold II. P2 (Devon) is set to Emerald IV in na_east: not eligible. P3 (Marcus) has no
-- League row. All three are demo personas the review account sees.

create temp table deck_ids (role text primary key, id uuid not null);

create temp table deck_rows (
  run text not null,
  profile_id uuid,
  display_name text,
  age integer,
  gender gender_enum,
  region region_enum,
  bio text,
  shared_games_count integer,
  shared_shows_count integer,
  score numeric,
  lol_duo_eligible boolean,
  pos bigint
);
grant insert, select on deck_rows to authenticated;

do $$
declare
  v_rev uuid;
  v_league uuid := public.lol_game_id();
  v_p1 uuid;
  v_p2 uuid;
  v_p3 uuid;
begin
  select u.id into v_rev from auth.users u where u.email = 'review@duoqueue.io';
  select p.id into v_p1 from public.profiles p where p.is_demo and p.display_name = 'Dae';
  select p.id into v_p2 from public.profiles p where p.is_demo and p.display_name = 'Devon';
  select p.id into v_p3 from public.profiles p where p.is_demo and p.display_name = 'Marcus';
  if v_rev is null or v_p1 is null or v_p2 is null or v_p3 is null then
    raise exception 'D: setup could not find the review account or Dae / Devon / Marcus';
  end if;

  delete from public.swipes where swiper_id = v_rev;
  delete from public.active_boosts;
  update public.preferences
     set preferred_regions = null, required_language = null, filter_game_id = null,
         filter_platform = null, filter_skill_level = null, filter_playstyle = null,
         filter_show_id = null, filter_recently_active = false
   where profile_id = v_rev;

  update public.profiles set region = 'na_east' where id = v_rev;
  insert into public.profile_games (profile_id, game_id, skill_level, lol_tier, lol_division, priority)
  values (v_rev, v_league, 'competitive', 'gold', 2, 0)
  on conflict (profile_id, game_id) do update set lol_tier = excluded.lol_tier, lol_division = excluded.lol_division;

  update public.profiles set region = 'na_west' where id = v_p1;
  insert into public.profile_games (profile_id, game_id, skill_level, lol_tier, lol_division, priority)
  values (v_p1, v_league, 'ranked_grinder', 'silver', 1, 0)
  on conflict (profile_id, game_id) do update set lol_tier = excluded.lol_tier, lol_division = excluded.lol_division;

  update public.profiles set region = 'na_east' where id = v_p2;
  insert into public.profile_games (profile_id, game_id, skill_level, lol_tier, lol_division, priority)
  values (v_p2, v_league, 'casual', 'emerald', 4, 9)
  on conflict (profile_id, game_id) do update set lol_tier = excluded.lol_tier, lol_division = excluded.lol_division;

  delete from public.profile_games where profile_id = v_p3 and game_id = v_league;

  insert into deck_ids values ('rev', v_rev), ('p1', v_p1), ('p2', v_p2), ('p3', v_p3);
end;
$$;

select set_config(
  'request.jwt.claims',
  (select json_build_object('sub', d.id, 'role', 'authenticated')::text from deck_ids d where d.role = 'rev'),
  true
);

-- D22. First call: the reviewer is Gold II.
set local role authenticated;
insert into deck_rows select 'a', g.* from public.get_deck(50) with ordinality g;
reset role;

do $$
declare
  v_p1 uuid := (select id from deck_ids where role = 'p1');
  v_p2 uuid := (select id from deck_ids where role = 'p2');
  v_p3 uuid := (select id from deck_ids where role = 'p3');
  v_count int;
begin
  select count(*) into v_count from deck_rows where run = 'a';
  if v_count >= 50 then
    raise exception 'pool larger than the limit: set comparison in D23 is not valid';
  end if;
  assert v_count > 0, 'D22: the review account''s deck is empty';

  assert (select d.lol_duo_eligible from deck_rows d where d.run = 'a' and d.profile_id = v_p1) is true,
    'D22: P1 (Silver I, na_west) should be eligible with Gold II';
  assert (select count(*) from deck_rows d where d.run = 'a' and d.profile_id = v_p2 and d.lol_duo_eligible is false) = 1,
    'D22: P2 (Emerald IV) should be present and false';
  assert (select count(*) from deck_rows d where d.run = 'a' and d.profile_id = v_p3 and d.lol_duo_eligible is null) = 1,
    'D22: P3 (no League row) should be present and null';
  assert coalesce((select max(d.pos) from deck_rows d where d.run = 'a' and d.lol_duo_eligible is true), 0)
         < coalesce((select min(d.pos) from deck_rows d where d.run = 'a' and d.lol_duo_eligible is not true), 1000000),
    'D22: an eligible row sits below a non-eligible one';
  insert into check_log (line) values (format('D22 ok: %s cards, P1 true, P2 false and present, P3 null and present, true rows first', v_count));
end;
$$;

-- D23. Without the reviewer's League row: same set of people, no labels, today's score order.
do $$
begin
  delete from public.profile_games
   where profile_id = (select id from deck_ids where role = 'rev') and game_id = public.lol_game_id();
end;
$$;

set local role authenticated;
insert into deck_rows select 'b', g.* from public.get_deck(50) with ordinality g;
reset role;

do $$
declare
  v_diff int;
begin
  select count(*) into v_diff from (
    (select profile_id from deck_rows where run = 'a' except select profile_id from deck_rows where run = 'b')
    union all
    (select profile_id from deck_rows where run = 'b' except select profile_id from deck_rows where run = 'a')
  ) x;
  assert v_diff = 0, format('D23: eligibility changed who is in the deck (%s ids differ)', v_diff);
  assert not exists (select 1 from deck_rows where run = 'b' and lol_duo_eligible is not null),
    'D23: a label appeared with no viewer rank';
  assert not exists (
    select 1 from deck_rows x join deck_rows y on y.run = 'b' and y.pos = x.pos + 1
    where x.run = 'b' and y.score > x.score
  ), 'D23: score increases down the deck';
  insert into check_log (line) values ('D23 ok: same set of ids as D22, every label null, score non-increasing');
end;
$$;

-- D24. Restore the reviewer's rank, move P1 to eu: P1 becomes null (NA pairs only).
do $$
declare
  v_rev uuid := (select id from deck_ids where role = 'rev');
begin
  insert into public.profile_games (profile_id, game_id, skill_level, lol_tier, lol_division, priority)
  values (v_rev, public.lol_game_id(), 'competitive', 'gold', 2, 0);
  update public.profiles set region = 'eu' where id = (select id from deck_ids where role = 'p1');
end;
$$;

set local role authenticated;
insert into deck_rows select 'c', g.* from public.get_deck(50) with ordinality g;
reset role;

do $$
begin
  assert (select count(*) from deck_rows d
          where d.run = 'c' and d.profile_id = (select id from deck_ids where role = 'p1')
            and d.lol_duo_eligible is null) = 1,
    'D24: P1 in eu should be present and null';
  insert into check_log (line) values ('D24 ok: P1 moved to eu is null');
end;
$$;

-- D25. A live Power-Up on P2 puts P2 first even though P2 is not eligible.
insert into public.active_boosts (profile_id, activated_at, expires_at)
select d.id, now(), now() + interval '30 minutes' from deck_ids d where d.role = 'p2';

set local role authenticated;
insert into deck_rows select 'd', g.* from public.get_deck(50) with ordinality g;
reset role;

do $$
begin
  assert (select d.pos from deck_rows d
          where d.run = 'd' and d.profile_id = (select id from deck_ids where role = 'p2')) = 1,
    'D25: a boosted, ineligible P2 is not first';
  insert into check_log (line) values ('D25 ok: boosted P2 is card 1 although not eligible');
end;
$$;

-- The deck order for the record (real accounts are not named).
insert into check_log (line)
select format('deck %s #%s  %s  %s  score %s  can duo: %s',
              d.run, d.pos,
              case when p.is_demo then d.display_name else '(real account)' end,
              d.region, d.score, coalesce(d.lol_duo_eligible::text, 'null'))
  from deck_rows d
  join public.profiles p on p.id = d.profile_id
 where d.run in ('a', 'b')
 order by d.run, d.pos;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
