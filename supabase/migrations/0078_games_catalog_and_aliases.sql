-- 0078: this year's games in the catalog, and search that understands "lol".
--
-- WHY. Read live on 2026-10-14. public.games has 556 catalog rows seeded on 22 July, and the
-- annual titles stop at the 2024 editions (NBA 2K24, FIFA 24 / EA Sports FC 24, Madden NFL 24),
-- Call of Duty at Black Ops 6 and Battlefield at 2042. Since launch players have typed
-- "Battlefield 6", "Call Of Duty MW 4", "Wardogs" and "2k26" as custom games (the "2k26" player
-- quit right after). And search is a plain name ILIKE ordered A to Z, so "lol", "r6", "cod",
-- "fn" and "bf6" find nothing, "ow" does not find Overwatch 2, and "val" lists Valorant 9th.
-- A custom "lol" would have no League rank picker, so it could never get "Can duo".
--
-- WHAT THIS FILE DOES (catalog additions and a new column only; the data rewrites of existing
-- custom games are in 0079, on their own, so they can be read and reverted on their own):
--
--   1. games.aliases text[] NOT NULL DEFAULT '{}': lowercase short names a player might type.
--      CATALOG ROWS ONLY (games_aliases_catalog_only). A client cannot write it anyway:
--      authenticated has column-level INSERT on games (name, is_custom, created_by) only, and
--      no UPDATE policy exists, so a new column gets no client write path. The constraint and
--      search_games' own "aliases of catalog rows only" rule are belt and braces: a custom game
--      someone names "lol" must never answer to the League alias.
--
--   2. New catalog rows, names checked on 2026-10-14 against the publishers' own announcements
--      and launch coverage: NBA 2K26 and NBA 2K27 (2K27 released 4 Sept 2026), EA Sports FC 26
--      and EA Sports FC 27 (25 Sept 2026), Madden NFL 26 and Madden NFL 27 (13 Aug 2026),
--      Call of Duty: Black Ops 7, ARC Raiders. Both the current and the previous annual edition
--      go in: on 2 Oct, a month after 2K27 launched, a player still typed "2k26".
--      Battlefield 6, Call of Duty: Modern Warfare 4 (releases 23 Oct 2026) and Wardogs (Steam
--      Early Access since 10 Sept 2026) already exist as custom rows with players on them;
--      0079 promotes those rows in place rather than adding duplicates.
--      `on conflict ((lower(name))) do nothing` against the unique games_name_lower_idx, so a
--      title that already exists (custom or not) in some environment is left alone.
--
--   3. search_games(p_query, p_limit): name OR alias, best match first. The 1.0.2 build calls
--      it; 1.0.1 keeps its own ILIKE and is unaffected by any of this except that it can now
--      find the new titles by name.
--      Order: exact (name or alias) > name or alias starts with it > a word in the name starts
--      with it > contains it (also with spaces and punctuation ignored, so "callofduty" and
--      "nba2k27" work); then catalog before custom; then how many players picked the game;
--      then name. Returns (id, name, is_custom). LIKE wildcards in the query are escaped.
--      SECURITY DEFINER so the popularity count sees every profile_games row (it returns a
--      sort order, never a count or a person). Execute: authenticated only.
--
-- Checks: supabase/checks/0078_games_catalog_and_aliases.sql (also the monthly "which custom
-- games were created" query).

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. The column.
-- ---------------------------------------------------------------------------
alter table public.games add column if not exists aliases text[] not null default '{}';

alter table public.games drop constraint if exists games_aliases_catalog_only;
alter table public.games
  add constraint games_aliases_catalog_only
  check (is_custom = false or cardinality(aliases) = 0);

-- ---------------------------------------------------------------------------
-- 2. New catalog titles.
-- ---------------------------------------------------------------------------
insert into public.games (name, is_custom)
values
  ('NBA 2K26', false),
  ('NBA 2K27', false),
  ('EA Sports FC 26', false),
  ('EA Sports FC 27', false),
  ('Madden NFL 26', false),
  ('Madden NFL 27', false),
  ('Call of Duty: Black Ops 7', false),
  ('ARC Raiders', false)
on conflict ((lower(name))) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Aliases for catalog rows. Matched by lower(name) and is_custom = false, so a name that
--    does not exist in some environment is simply skipped.
-- ---------------------------------------------------------------------------
update public.games g
   set aliases = a.aliases
  from (values
    ('league of legends',                array['lol', 'league']),
    ('teamfight tactics',                array['tft']),
    ('valorant',                         array['val', 'valo']),
    ('rainbow six siege',                array['r6', 'r6s', 'siege', 'rainbow six']),
    ('fortnite',                         array['fn']),
    ('rocket league',                    array['rl']),
    ('overwatch 2',                      array['ow', 'ow2', 'overwatch']),
    ('counter-strike 2',                 array['cs', 'cs2', 'csgo', 'counter strike']),
    ('apex legends',                     array['apex']),
    ('call of duty: warzone',            array['cod', 'wz']),
    ('call of duty: black ops 6',        array['cod', 'bo6']),
    ('call of duty: black ops 7',        array['cod', 'bo7']),
    ('call of duty: modern warfare iii', array['cod', 'mw3']),
    ('call of duty: mobile',             array['cod', 'codm']),
    ('battlefield 2042',                 array['bf', 'bf2042']),
    ('grand theft auto v',               array['gta', 'gta 5', 'gta v', 'gtav']),
    ('grand theft auto online',          array['gta', 'gta online', 'gtao']),
    ('nba 2k27',                         array['2k', '2k27', 'nba 2k']),
    ('nba 2k26',                         array['2k', '2k26', 'nba 2k']),
    ('nba 2k24',                         array['2k24']),
    ('ea sports fc 27',                  array['fc', 'fc27', 'fc 27', 'fifa']),
    ('ea sports fc 26',                  array['fc', 'fc26', 'fc 26', 'fifa']),
    ('fifa 24 / ea sports fc 24',        array['fc24', 'fifa 24']),
    ('madden nfl 27',                    array['madden', 'madden 27']),
    ('madden nfl 26',                    array['madden', 'madden 26']),
    ('dota 2',                           array['dota']),
    ('pubg: battlegrounds',              array['pubg']),
    ('pubg mobile',                      array['pubg', 'pubgm']),
    ('marvel rivals',                    array['rivals']),
    ('helldivers 2',                     array['hd2', 'helldivers']),
    ('destiny 2',                        array['d2']),
    ('minecraft',                        array['mc']),
    ('monster hunter wilds',             array['mh', 'mh wilds']),
    ('monster hunter world',             array['mh', 'mhw']),
    ('monster hunter rise',              array['mh', 'mhr']),
    ('wwe 2k24',                         array['wwe']),
    ('mlb the show 24',                  array['mlb']),
    ('nhl 24',                           array['nhl']),
    ('arc raiders',                      array['arc'])
  ) as a(lower_name, aliases)
 where lower(g.name) = a.lower_name
   and g.is_custom = false
   and g.aliases is distinct from a.aliases;

-- ---------------------------------------------------------------------------
-- 4. search_games
-- ---------------------------------------------------------------------------
create or replace function public.search_games(p_query text, p_limit integer default 25)
returns table (id uuid, name text, is_custom boolean)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_q text;
  v_like text;
  v_compact text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_q := lower(regexp_replace(btrim(coalesce(p_query, '')), '\s+', ' ', 'g'));
  if char_length(v_q) < 1 or char_length(v_q) > 80 then
    return;
  end if;
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 50);

  -- LIKE's default escape character is the backslash.
  v_like := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  v_compact := regexp_replace(v_q, '[^a-z0-9]', '', 'g');

  return query
  with pop as (
    select pg.game_id, count(*) as players
    from public.profile_games pg
    group by pg.game_id
  ),
  scored as (
    select
      g.id,
      g.name,
      g.is_custom,
      lower(g.name) as lname,
      case when g.is_custom then '{}'::text[] else g.aliases end as al
    from public.games g
  ),
  ranked as (
    select
      s.id,
      s.name,
      s.is_custom,
      case
        when s.lname = v_q or v_q = any (s.al) then 0
        when s.lname like v_like || '%'
          or exists (select 1 from unnest(s.al) a where a like v_like || '%') then 1
        when (' ' || regexp_replace(s.lname, '[^a-z0-9]+', ' ', 'g')) like '% ' || v_like || '%' then 2
        when s.lname like '%' || v_like || '%' then 3
        when char_length(v_compact) >= 2
          and regexp_replace(s.lname, '[^a-z0-9]', '', 'g') like '%' || v_compact || '%' then 3
        else null
      end as match_rank
    from scored s
  )
  select r.id, r.name, r.is_custom
  from ranked r
  left join pop on pop.game_id = r.id
  where r.match_rank is not null
  order by r.match_rank, r.is_custom, coalesce(pop.players, 0) desc, r.name
  limit p_limit;
end;
$fn$;

revoke execute on function public.search_games(text, integer) from public, anon, authenticated;
grant execute on function public.search_games(text, integer) to authenticated;
