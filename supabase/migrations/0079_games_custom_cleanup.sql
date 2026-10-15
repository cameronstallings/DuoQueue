-- 0079: DATA REWRITE, kept apart on purpose. Real titles that players typed as custom games
-- become catalog games in place; two empty junk customs are deleted.
--
-- Read live on 2026-10-14 (UTC times):
--
--   custom row            players  created           what it is
--   "Battlefield 6"          1     2 Oct 17:15       real title (released 10 Oct 2025), not in the catalog
--   "Call Of Duty MW 4"      2    10 Oct 07:13       Call of Duty: Modern Warfare 4 (announced; releases 23 Oct 2026)
--   "Wardogs"                2     3 Oct 04:36       real title (Steam Early Access since 10 Sept 2026)
--   "2k26"                   0     2 Oct 16:02       NBA 2K26, now a catalog row (0078); its creator never finished onboarding
--   "Warzone"                0    14 Oct 19:01       duplicate of the catalog's "Call of Duty: Warzone"; creator account already deleted
--   "Xbox"                   1    18 Aug 08:01       a platform, not a game. LEFT ALONE: it is one player's own pick, and
--                                                    the right fix (choosing Xbox as a platform) is theirs to make.
--
-- WHY PROMOTE IN PLACE instead of inserting catalog rows and remapping profile_games: the
-- custom row's id is what profile_games, preferences.filter_game_id and any shared-game count
-- already point at. Flipping is_custom (and clearing created_by, which no catalog row has)
-- keeps every one of those links exactly as it is, so no player's game list changes and no
-- row is rewritten except the game itself. The unique index on lower(name) is also why a
-- second "Battlefield 6" could not have been inserted next to the custom one.
--
-- The rename of "Call Of Duty MW 4" to "Call of Duty: Modern Warfare 4" is the one change a
-- player will SEE: their game is now spelled the way the catalog spells every other Call of
-- Duty. It runs only if no row already carries the official name.
--
-- Every statement matches by lower(name) and is_custom = true, never by an id, so it does the
-- same thing in every environment and nothing at all where those rows do not exist. Step 2
-- then makes sure the three titles exist everywhere as catalog rows.
--
-- The two deletes are guarded: only a custom row with ZERO profile_games rows and zero
-- verified_stats rows is deleted. preferences.filter_game_id is ON DELETE SET NULL.
--
-- REVERT, if ever needed: set is_custom = true on the three promoted rows (and rename the
-- Modern Warfare 4 row back); the two deleted rows had no players, so there is nothing to
-- restore for anyone.
--
-- Once a month, the query at the end of supabase/checks/0079_games_custom_cleanup.sql lists
-- the custom games created since the last look, which is how the catalog stays current.
--
-- Checks: supabase/checks/0079_games_custom_cleanup.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Promote real titles in place.
-- ---------------------------------------------------------------------------
update public.games
   set is_custom = false, created_by = null
 where is_custom = true
   and lower(name) = 'battlefield 6';

update public.games
   set is_custom = false, created_by = null
 where is_custom = true
   and lower(name) = 'wardogs';

update public.games
   set name = 'Call of Duty: Modern Warfare 4', is_custom = false, created_by = null
 where is_custom = true
   and lower(name) = 'call of duty mw 4'
   and not exists (
     select 1 from public.games g2 where lower(g2.name) = 'call of duty: modern warfare 4'
   );

-- ---------------------------------------------------------------------------
-- 2. Make sure the three exist as catalog rows everywhere (no-op on hosted after step 1).
-- ---------------------------------------------------------------------------
insert into public.games (name, is_custom)
values
  ('Battlefield 6', false),
  ('Call of Duty: Modern Warfare 4', false),
  ('Wardogs', false)
on conflict ((lower(name))) do nothing;

-- Their aliases (catalog rows only, per games_aliases_catalog_only).
update public.games g
   set aliases = a.aliases
  from (values
    ('battlefield 6',                  array['bf', 'bf6']),
    ('call of duty: modern warfare 4', array['cod', 'mw4'])
  ) as a(lower_name, aliases)
 where lower(g.name) = a.lower_name
   and g.is_custom = false
   and g.aliases is distinct from a.aliases;

-- ---------------------------------------------------------------------------
-- 3. Delete the two empty junk customs.
-- ---------------------------------------------------------------------------
delete from public.games g
 where g.is_custom = true
   and lower(g.name) in ('2k26', 'warzone')
   and not exists (select 1 from public.profile_games pg where pg.game_id = g.id)
   and not exists (select 1 from public.verified_stats vs where vs.game_id = g.id);
