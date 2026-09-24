-- 0069: League of Legends Solo/Duo rank, and Riot's duo table in the deck order.
--
-- Design: docs/superpowers/specs/2026-09-23-league-rank-duo-design.md (adversarially reviewed
-- 2026-09-23; its "Review notes" section overrides the body where they differ).
--
-- ============================================================================
-- WHAT THIS DOES, IN ONE SCREEN
-- ============================================================================
--
--   1. League players store a Ranked Solo/Duo rank as two nullable columns on the League row
--      of profile_games (lol_tier, lol_division). Every other game keeps free-text rank_text.
--   2. A trigger keeps rank_text equal to the canonical label ("Gold II") whenever a structured
--      rank exists, so every existing reader, including the shipped build 10 client, keeps
--      working, and a build 10 save of "plat 2" is parsed into a structured rank.
--   3. lol_solo_duo_eligible(...) encodes Riot's published duo table and answers true, false or
--      null (unknown). There is no score, no MMR and no rank distance.
--   4. get_deck gains one trailing output column, lol_duo_eligible, and one ORDER BY key:
--      live Power-Ups first (a paid promise), then eligible pairs, then today's score. The
--      WHERE clause is untouched, so nobody is filtered out and the deck cannot empty
--      because of this.
--
-- ============================================================================
-- SOURCES, AND THE ONE RULE EVERYTHING HERE IS BUILT AROUND
-- ============================================================================
--
--   Riot Support, "Ranked Tiers, Divisions, and Queues" (the duo table):
--     https://support.riotgames.com/en-us/league-of-legends/gameplay/ranked-tiers-divisions-and-queues
--     Page displays "May 7, 2026"; content re-read row by row 2026-09-23. Its Master row
--     (duo within 400 LP) matches Patch 26.15, so the displayed date is unreliable and the
--     content is current. RE-CHECK THE PAGE BEFORE EACH RELEASE THAT TOUCHES THIS; the table
--     lives in exactly two places, lol_solo_duo_eligible below and
--     packages/shared-types/src/lol-rank.ts.
--   Patch 26.15 notes (Master duo returns, Grandmaster/Challenger duo removed):
--     https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-15-notes/
--     Published 2026-07-28, live 2026-07-29.
--   Riot Developer Policies, General, checked 2026-09-23:
--     https://developer.riotgames.com/policies/general
--     "Products cannot create alternatives for official skill ranking systems such as the
--     ranked ladder." MMR and ELO calculators are named as examples.
--
-- So: Riot's tiers and Riot's duo table only. The ordinal inside lol_rank_ordinal is an index
-- into Riot's rows and nothing else. It is never stored, never shown, never compared as a skill
-- number, and it is revoked from every client role like every other helper here.
--
-- The conservative reading: a pair is labeled only when BOTH players' Riot rows allow it.
-- Riot's rows disagree with each other for eight unordered pairs (Emerald IV/III with Diamond
-- IV/III, Emerald II/I with Diamond II, Diamond III/II with Diamond I); those are null, never
-- true. A "Can duo with you" that the League client then refuses is the failure that matters;
-- a missing label costs nothing. Master pairs depend on LP, which DuoQueue does not collect,
-- so Master with Master or Diamond I is null and every other Master pair is false.
-- Grandmaster and Challenger are false with everyone. Unranked is null with everyone. Pairs
-- outside NA (na_east / na_west on both sides) are null, because profiles.region is not a
-- League server.
--
-- Checksum, shared with packages/shared-types/src/lol-rank.test.ts and
-- supabase/checks/0069_league_rank_duo.sql: over the 32 choices (28 divisional ranks, Master,
-- Grandmaster, Challenger, Unranked) the 1,024 ordered pairs split 306 true, 636 false, 82 null,
-- and the relation is symmetric.
--
-- ============================================================================
-- WHAT IS DELIBERATELY NOT TOUCHED
-- ============================================================================
--
--   * public_profile_games and the other 13 public views. rank_text already carries the label,
--     and a flat `create or replace view` would drop 0067's viewer_age_verified() wrap (0067
--     section 6, "THE PRICE"). lol_tier and lol_division are in no view and reach no other user.
--   * get_deck's WHERE clause, and therefore deck_gate_hard, deck_gate_preferences,
--     get_deck_pool_size and get_new_player_alert_batch. 0062's rule ("IF YOU CHANGE get_deck's
--     WHERE CLAUSE, CHANGE THESE TWO FUNCTIONS") is NOT triggered: only ORDER BY and one output
--     column change below. Do not "helpfully" edit those functions to match.
--   * get_standouts, get_online_now, get_party_deck, get_profile_card. Unchanged; their rows
--     carry no eligibility and the client shows no label on them.
--   * No applied migration is edited. 0039's name-matched League marker was a no-op on a fresh
--     local `supabase db reset` (the catalog is empty when migrations run); section 1's upsert
--     closes that gap here instead of touching 0039 or seed.sql.
--   * No dependency on 0067 or 0068. Apply in number order anyway. get_deck below keeps its
--     is_minor() call, which is the obligation 0067 section 5 places on it.
--
-- get_deck is rebuilt from the LIVE definition. Read 2026-09-23 (read-only): md5(prosrc) of the
-- live get_deck(integer) is de4158bd67faded3865df843b5ff2fd2, byte-identical to 0060's body on
-- disk; its ACL is {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}; no
-- pg_depend row references it and no other function body in public mentions it; profile_games
-- has no triggers. The live League row is 29dd006a-6f06-45f9-a5b2-30fb91b3f71a,
-- is_custom = false, riot_queue = 'RANKED_SOLO_5x5'. Its three League ranks were "Iron 1",
-- "Iron 3" and "Diamond II", all of which parse.
--
-- ============================================================================
-- REMOVAL
-- ============================================================================
--
-- Recreate get_deck from 0060's body (drop and create, since the return type changes back)
-- with the ACL above; drop trigger profile_games_lol_rank_sync; drop the six functions
-- (lol_rank_ordinal, lol_rank_label, lol_parse_rank_text, lol_solo_duo_eligible, lol_game_id,
-- sync_profile_game_lol_rank); drop constraints lol_tier_valid and lol_division_matches_tier;
-- drop columns lol_tier and lol_division. rank_text already holds the labels, so no data is
-- lost. BUT once the build that sends lol_tier / lol_division is in users' hands, dropping the
-- columns breaks it: its Edit screen selects them and both writers send them, and PostgREST
-- rejects an unknown column. After that point, removal means keeping the columns and the
-- trigger (which keeps rank_text canonical) and reverting only get_deck.
--
-- History: if 0067/0068 slip and this goes first, apply it with apply-migration.ps1 -Commit
-- (it records the version itself). A later `supabase db push` of 0067/0068 then needs
-- --include-all; apply-migration.ps1 does not care.
--
-- LOCKS: `alter table ... add column` takes an ACCESS EXCLUSIVE lock on profile_games. The
-- runner wraps this file in begin/commit, so the lock_timeout below holds for the whole file:
-- if a long read is in the way the migration fails fast and is simply re-run, instead of
-- every deck, profile and save request queueing behind it. A dry run holds the same lock for
-- its whole transaction, so run dry runs at a quiet hour too.
--
-- NOTICES: raise notice output is not printed by run-sql.ps1 or apply-migration.ps1 (the
-- Management API returns result rows only). The census in section 5 is a courtesy for the SQL
-- editor; the check that counts is item 16 of supabase/checks/0069_league_rank_duo.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. The League catalog row, and who may write riot_queue.
-- ---------------------------------------------------------------------------
--
-- Make the League row exist and carry its marker in EVERY environment. On a fresh local
-- `supabase db reset`, 0039's name-matched UPDATE ran against an empty catalog and seed.sql
-- then inserted League without riot_queue, so the marker was missing locally. Upserting here
-- fixes that: seed.sql's `on conflict (lower(name)) do nothing` then leaves this row alone.
-- On hosted the row already carries the marker, so the WHERE below makes this no write at all.
insert into public.games as g (name, is_custom, riot_queue)
values ('League of Legends', false, 'RANKED_SOLO_5x5')
on conflict ((lower(name))) do update
  set riot_queue = excluded.riot_queue
  where g.is_custom = false
    and g.riot_queue is distinct from excluded.riot_queue;

do $$
begin
  if (select count(*) from public.games
      where riot_queue = 'RANKED_SOLO_5x5' and is_custom = false) <> 1 then
    raise exception '0069 refuses to run: expected exactly one non-custom games row with riot_queue RANKED_SOLO_5x5.';
  end if;
end;
$$;

-- games INSERT was table-wide (0001), so any signed-in user could insert a custom game
-- carrying riot_queue or steam_app_id. On hosted the unique index (0042) already blocks a
-- second RANKED_SOLO_5x5, but the League identity this feature keys on should not rest on
-- "somebody got there first". Read live 2026-09-23 before this: authenticated held INSERT on
-- all eight columns (riot_queue, steam_app_id and igdb_id included) and anon held table-wide
-- INSERT too (inert only because games_insert_custom needs created_by = auth.uid()).
--
-- The only client insert (useCatalogSearch.ts createCustomCatalogEntry) names exactly these
-- three columns, in build 10 as well as now: `insert({ name, is_custom, created_by })`.
-- PostgREST names only the payload's keys in its INSERT column list, and id / created_at use
-- their defaults, which need no insert privilege. The `.select("id, name")` after it rides on
-- SELECT, which stays table-wide. Nothing else inserts into games from a client, an Edge
-- Function or an invoker function; scripts and seed.sql run as postgres or service_role.
--
-- Revoking the table-level privilege also revokes the column privileges it implied. This
-- hardening is separable from the feature: drop these two statements if it should ship alone.
revoke insert on public.games from anon, authenticated;
grant insert (name, is_custom, created_by) on public.games to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Columns and constraints.
-- ---------------------------------------------------------------------------
--
-- Text + CHECK rather than a Postgres enum: Riot added Emerald in 2023, and adding an enum
-- value mid-list cannot be used in the transaction that adds it (the 0036/0037 split). A CHECK
-- is changed by dropping and re-adding one constraint. The ordering an enum would give is not
-- needed; lol_rank_ordinal computes it.
--
-- NEITHER CHECK MAY CALL ONE OF THE HELPERS BELOW. A CHECK runs as the writing role (0057's
-- note on has_disallowed_control_chars), and the helpers are revoked from authenticated, so
-- such a CHECK would make every client save of a game fail. Both are plain CASE / IN.
--
-- No new index: get_deck reads the League row by (profile_id, game_id), which
-- unique_profile_game already indexes. The table-wide grants on profile_games (0001) and its
-- per-operation own-row policies (0029) cover the new columns as they stand.
alter table public.profile_games
  add column if not exists lol_tier text,
  add column if not exists lol_division smallint;

alter table public.profile_games drop constraint if exists lol_tier_valid;
alter table public.profile_games add constraint lol_tier_valid check (
  lol_tier is null or lol_tier in (
    'unranked', 'iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond',
    'master', 'grandmaster', 'challenger')
);

-- Written as a CASE so every branch is a definite true/false and a NULL can never satisfy it
-- by accident (the 0031 section 7 lesson).
alter table public.profile_games drop constraint if exists lol_division_matches_tier;
alter table public.profile_games add constraint lol_division_matches_tier check (
  case
    when lol_tier is null then lol_division is null
    when lol_tier in ('iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond')
      then lol_division is not null and lol_division between 1 and 4
    else lol_division is null
  end
);

comment on column public.profile_games.lol_tier is
  'League of Legends Ranked Solo/Duo tier, League row only (the sync trigger raises lol_rank_not_league elsewhere). unranked, iron .. challenger. See 0069.';
comment on column public.profile_games.lol_division is
  '1..4 meaning I..IV for iron .. diamond; null for unranked, master, grandmaster, challenger. See 0069.';

-- ---------------------------------------------------------------------------
-- 3. Pure helpers.
-- ---------------------------------------------------------------------------
--
-- language sql, immutable (lol_game_id is stable), parallel safe, set search_path = public
-- (the advisor flags a mutable search_path; the inlining that costs does not matter at this
-- scale). None is SECURITY DEFINER. Every one is revoked from public, anon and authenticated:
-- their only callers are SECURITY DEFINER code owned by postgres (get_deck, the sync trigger),
-- which calls them as the owner. The client never calls them; it has the TypeScript mirror.
--
-- DIVISION PARAMETERS ARE integer, NOT smallint. The column stays smallint, and smallint widens
-- to integer implicitly. The reverse does not: a bare literal such as 2 is typed integer, and
-- integer -> smallint is only an assignment cast, so lol_rank_label('gold', 2) against a
-- smallint parameter would fail with "function does not exist".
--
-- RE-RUN TRAP: create or replace cannot change a function's argument or result types. If a
-- helper's signature ever changes after this is applied, the next migration must drop it first.

create or replace function public.lol_rank_ordinal(p_tier text, p_division integer)
returns integer
language sql
immutable
parallel safe
set search_path = public
as $fn$
  select case
    when p_tier in ('iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond')
         and p_division between 1 and 4
      then (array_position(array['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond'], p_tier) - 1) * 4
           + (4 - p_division)
    when p_tier = 'master'      and p_division is null then 28
    when p_tier = 'grandmaster' and p_division is null then 29
    when p_tier = 'challenger'  and p_division is null then 30
  end;   -- 'unranked', null, or malformed -> null
$fn$;

revoke execute on function public.lol_rank_ordinal(text, integer) from public, anon, authenticated;
comment on function public.lol_rank_ordinal(text, integer) is
  'Index into Riot''s Solo/Duo duo table (Iron IV = 0 .. Diamond I = 27, Master 28, Grandmaster 29, Challenger 30; Unranked or malformed null). Never stored, shown or compared as a skill number (Riot Developer Policies, checked 2026-09-23). Source: https://support.riotgames.com/en-us/league-of-legends/gameplay/ranked-tiers-divisions-and-queues (checked 2026-09-23). See 0069.';

create or replace function public.lol_rank_label(p_tier text, p_division integer)
returns text
language sql
immutable
parallel safe
set search_path = public
as $fn$
  select case
    when p_tier = 'unranked' and p_division is null then 'Unranked'
    when public.lol_rank_ordinal(p_tier, p_division) is null then null
    when p_division is null then initcap(p_tier)                       -- Master, Grandmaster, Challenger
    else initcap(p_tier) || ' ' || (array['I', 'II', 'III', 'IV'])[p_division]
  end;
$fn$;

revoke execute on function public.lol_rank_label(text, integer) from public, anon, authenticated;
comment on function public.lol_rank_label(text, integer) is
  'Canonical League rank label ("Gold II", "Master", "Unranked"), or null for an incomplete or malformed rank. Mirrors formatLolRank in packages/shared-types/src/lol-rank.ts. Tiers per https://support.riotgames.com/en-us/league-of-legends/gameplay/ranked-tiers-divisions-and-queues (checked 2026-09-23). See 0069.';

-- One regex, identical in SQL and TypeScript (parseLolRankText). The pattern is anchored at both
-- ends, so every accepted string has exactly one parse, which is why Postgres's leftmost-longest
-- matching and JavaScript's backtracking give the same groups.
--
-- Accepts only: a divisional tier WITH a division; Master/Grandmaster/Challenger with no
-- division or with I/1 (Riot's API reports apex ranks as "I"), returned with division null;
-- unranked with no division. Anything else is (null, null): "Diamond" (no division), "Gold V",
-- "Immortal 1", "Master 400 LP", '', null. A partial parse is no parse.
--
-- It always returns exactly one row, (null, null) included, because the trigger selects INTO
-- from it. The OUT division stays smallint because the trigger selects it into the smallint
-- column.
create or replace function public.lol_parse_rank_text(p_text text, out tier text, out division smallint)
returns record
language sql
immutable
parallel safe
set search_path = public
as $fn$
  with normalized as (
    select lower(btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'))) as s
  ),
  matched as (
    select regexp_match(
             n.s,
             '^(iron|bronze|silver|gold|plat|platinum|emerald|diamond|master|masters|grandmaster|grand master|gm|challenger|unranked) ?(iv|iii|ii|i|4|3|2|1)?$'
           ) as m
    from normalized n
  ),
  tokens as (
    select
      case m[1]
        when 'plat' then 'platinum'
        when 'masters' then 'master'
        when 'grand master' then 'grandmaster'
        when 'gm' then 'grandmaster'
        else m[1]
      end as t,
      case m[2]
        when 'i' then 1 when '1' then 1
        when 'ii' then 2 when '2' then 2
        when 'iii' then 3 when '3' then 3
        when 'iv' then 4 when '4' then 4
      end as d
    from matched
    where m is not null
  ),
  parsed as (
    select
      tk.t as tier,
      case
        when tk.t in ('iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond') then tk.d::smallint
      end as division
    from tokens tk
    where (tk.t in ('iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond') and tk.d is not null)
       or (tk.t in ('master', 'grandmaster', 'challenger') and (tk.d is null or tk.d = 1))
       or (tk.t = 'unranked' and tk.d is null)
  )
  select parsed.tier, parsed.division
  from (select 1) one
  left join parsed on true;
$fn$;

revoke execute on function public.lol_parse_rank_text(text) from public, anon, authenticated;
comment on function public.lol_parse_rank_text(text) is
  'Parses free text ("plat 2", "Iron 1", "Master") into a League tier/division, or (null, null). Always exactly one row. Mirrors parseLolRankText in packages/shared-types/src/lol-rank.ts; same regex. Tiers per https://support.riotgames.com/en-us/league-of-legends/gameplay/ranked-tiers-divisions-and-queues (checked 2026-09-23). See 0069.';

create or replace function public.lol_solo_duo_eligible(
  p_a_tier text, p_a_division integer, p_b_tier text, p_b_division integer)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $fn$
  with o as (
    select public.lol_rank_ordinal(p_a_tier, p_a_division) as a,
           public.lol_rank_ordinal(p_b_tier, p_b_division) as b
  ), r as (
    -- Riot's row for each player as an inclusive ordinal range over Iron IV (0) .. Diamond I (27).
    -- Source and date: this file's header. Master and above are decided before these are read.
    --   Iron, Bronze        0..7    Iron to Silver              0..11
    --   Silver              8..11   Iron to Gold                0..15
    --   Gold               12..15   Silver to Platinum          8..19
    --   Platinum           16..19   Gold to Emerald            12..23
    --   Emerald            20..23   Platinum to Diamond III    16..25
    --   Diamond IV..II     24..26   Emerald II to Diamond II   22..26
    --   Diamond I              27   Diamond III to Diamond I   25..27  (+ Master under 200 LP)
    select a, b,
      case when a <= 11 then 0 when a <= 15 then 8 when a <= 19 then 12
           when a <= 23 then 16 when a <= 26 then 22 else 25 end as a_lo,
      case when a <= 7 then 11 when a <= 11 then 15 when a <= 15 then 19
           when a <= 19 then 23 when a <= 23 then 25 when a <= 26 then 26 else 27 end as a_hi,
      case when b <= 11 then 0 when b <= 15 then 8 when b <= 19 then 12
           when b <= 23 then 16 when b <= 26 then 22 else 25 end as b_lo,
      case when b <= 7 then 11 when b <= 11 then 15 when b <= 15 then 19
           when b <= 19 then 23 when b <= 23 then 25 when b <= 26 then 26 else 27 end as b_hi
    from o
  )
  select case
    when a is null or b is null then null                    -- Unranked or not given
    when a >= 29 or b >= 29 then false                       -- Grandmaster / Challenger: no duo
    when a = 28 or b = 28 then
      case when least(a, b) >= 27 then null else false end   -- Master: depends on LP we do not collect
    when b between a_lo and a_hi and a between b_lo and b_hi then true
    when b between a_lo and a_hi or  a between b_lo and b_hi then null  -- Riot's rows disagree
    else false
  end
  from r;
$fn$;

revoke execute on function public.lol_solo_duo_eligible(text, integer, text, integer) from public, anon, authenticated;
comment on function public.lol_solo_duo_eligible(text, integer, text, integer) is
  'Riot''s published League Ranked Solo/Duo duo table: true only when BOTH players'' rows allow the pair, null when unknown (Unranked, Master LP pairs, rows that disagree), false otherwise. No score, no MMR. Source: https://support.riotgames.com/en-us/league-of-legends/gameplay/ranked-tiers-divisions-and-queues and Patch 26.15 notes, checked 2026-09-23. Mirrors lolSoloDuoEligible in packages/shared-types/src/lol-rank.ts. See 0069.';

-- Identified by its Riot queue marker, never by name. Unique by games_riot_queue_idx (0042).
create or replace function public.lol_game_id()
returns uuid
language sql
stable
parallel safe
set search_path = public
as $fn$
  select g.id from public.games g
  where g.riot_queue = 'RANKED_SOLO_5x5' and g.is_custom = false;
$fn$;

revoke execute on function public.lol_game_id() from public, anon, authenticated;
comment on function public.lol_game_id() is
  'The League of Legends catalog row: games.riot_queue = RANKED_SOLO_5x5 and not custom. Never matched by name. See 0069.';

-- ---------------------------------------------------------------------------
-- 4. The sync trigger.
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER is what lets it call the helpers after they are revoked from authenticated
-- (a client insert fires it as authenticated). It reads games and nothing else, and only
-- rewrites the row being written.
--
-- lol_rank_not_league means a client bug: the app never sends a tier on a non-League row.
-- Onboarding and Edit details both show a P0001's hint (src/lib/userMessage.ts), so if it ever
-- happens it reads as a sentence, not as the token.
create or replace function public.sync_profile_game_lol_rank()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Not the League row: a structured rank is an error, and rank_text is left exactly as typed.
  if new.game_id is distinct from public.lol_game_id() then
    if new.lol_tier is not null or new.lol_division is not null then
      raise exception 'lol_rank_not_league'
        using hint = 'A League of Legends rank can only be set on the League of Legends game.';
    end if;
    return new;
  end if;

  -- A text-only UPDATE (a direct PATCH naming rank_text alone): the text is the newer
  -- statement, so the structured rank is re-derived from it rather than overwriting it.
  -- (Both shipped save paths delete and re-insert, so they arrive as INSERTs, below.)
  if tg_op = 'UPDATE'
     and new.rank_text is distinct from old.rank_text
     and new.lol_tier is not distinct from old.lol_tier
     and new.lol_division is not distinct from old.lol_division then
    new.lol_tier := null;
    new.lol_division := null;
  end if;

  -- No structured rank given: try the text. This is the path build 10 takes on every save,
  -- and the path the backfill below takes.
  if new.lol_tier is null and new.rank_text is not null then
    select p.tier, p.division into new.lol_tier, new.lol_division
    from public.lol_parse_rank_text(new.rank_text) p;
  end if;

  -- Structured rank wins: rank_text becomes the canonical label, for every old reader.
  -- An invalid tier/division pair yields a null label here and then fails
  -- lol_division_matches_tier, loudly, with 23514.
  if new.lol_tier is not null then
    new.rank_text := public.lol_rank_label(new.lol_tier, new.lol_division);
  end if;

  return new;
end;
$fn$;

drop trigger if exists profile_games_lol_rank_sync on public.profile_games;
create trigger profile_games_lol_rank_sync
  before insert or update on public.profile_games
  for each row execute function public.sync_profile_game_lol_rank();

-- EXECUTE is checked at CREATE TRIGGER time, not at fire time (0063's note), so this stops
-- direct calls without stopping the trigger.
revoke execute on function public.sync_profile_game_lol_rank() from public, anon, authenticated;
comment on function public.sync_profile_game_lol_rank() is
  'BEFORE INSERT OR UPDATE on profile_games: League row only, keeps lol_tier/lol_division and rank_text in agreement (structured rank wins; text is parsed when no tier is given); raises lol_rank_not_league on any other game. See 0069.';

-- ---------------------------------------------------------------------------
-- 5. Backfill, through the same trigger live writes use.
-- ---------------------------------------------------------------------------
--
-- Only the League row, and only where lol_tier is null and rank_text is not null. Parsed rows
-- get a structured rank and rank_text normalized to the label ("Iron 1" becomes "Iron I");
-- unparsed rows keep their text and get no tier (the client shows its legacy note and treats
-- them as unranked for eligibility). Non-League rows are never read or written, including ones
-- that look like League ranks. Nothing is deleted.
--
-- Expected on hosted, 2026-09-23: 3 structured, 0 left as free text.
do $$
declare
  v_league uuid := public.lol_game_id();
  v_structured int;
  v_text_only int;
begin
  -- A no-op write routes every existing League rank through the trigger.
  update public.profile_games
     set rank_text = rank_text
   where game_id = v_league and lol_tier is null and rank_text is not null;

  select count(*) filter (where lol_tier is not null),
         count(*) filter (where lol_tier is null and rank_text is not null)
    into v_structured, v_text_only
    from public.profile_games where game_id = v_league;

  raise notice '0069: League rows with a structured rank: %. League rows left as free text: %.',
    v_structured, v_text_only;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. get_deck: drop and recreate with one extra output column.
-- ---------------------------------------------------------------------------
--
-- Adding an output column changes the return type, which create or replace cannot do. The drop
-- and create are in one transaction, so no caller ever sees the function missing. DROP without
-- CASCADE on purpose: nothing depends on get_deck today (read 2026-09-23), and a surprise
-- dependency should fail loudly rather than be dropped with it (0060's rule for its view drop).
--
-- The body is 0060's (identical to live, see the header) with exactly these edits and nothing
-- else: four declarations after v_viewer_is_demo; the League lookups after the viewer's
-- profile read; one trailing select column; one left join and one lateral in the final FROM;
-- the ORDER BY. The auth and ban preamble, check_rate_limit('get_deck', 40, ...), the p_limit
-- clamp, is_premium, is_minor (0067 depends on this call), is_demo_viewer, the preferences
-- fetch, the premium nulling, the age band, every WHERE predicate, the four CTEs and the score
-- formula are byte for byte 0060's.
--
-- ORDER BY:
--   1. (b.profile_id is not null) desc  -- a live Power-Up keeps its promise, "near the top of
--      other people's decks" (paywall.tsx, (tabs)/index.tsx). Boosted rows already carry +1000
--      score; the explicit first key keeps eligibility from ever outranking a paid boost.
--   2. (d.duo is true) desc             -- then pairs Riot's table lets duo in Solo/Duo
--   3. score desc                       -- then today's order, unchanged
--   4. c.last_active_at desc nulls last
--
-- Why this cannot empty the deck: only ORDER BY changed, so the candidate set, and therefore
-- get_deck_pool_size and the empty-deck messaging, are identical to before. The client's
-- "deck is finished" signal (deckQueue.ts mergeDeckPage) is order-independent: a page adds
-- nobody new only when every unswiped candidate is already queued, whatever order they come
-- back in.
--
-- No new failure path: the CHECKs in section 2 guarantee every stored pair is one the helpers
-- accept; lol_game_id() returning null (League row missing or unmarked) makes every duo null
-- and the deck unchanged; and the left join is on the (profile_id, game_id) unique key, so it
-- cannot duplicate a candidate.
--
-- Names: in a `returns table` plpgsql function every output column is a variable, so every
-- column reference below is qualified (c.region, lol.lol_tier, d.duo). The output column is
-- lol_duo_eligible and the function is lol_solo_duo_eligible, on purpose; do not rename either
-- to match. `score desc` works only because it is a bare output name in ORDER BY (as in 0060);
-- do not wrap it in an expression.

drop function if exists public.get_deck(integer);

create function public.get_deck(p_limit integer DEFAULT 20)
 returns table(profile_id uuid, display_name text, age integer, gender gender_enum, region region_enum, bio text, shared_games_count integer, shared_shows_count integer, score numeric, lol_duo_eligible boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_is_premium boolean;
  v_min_age smallint;
  v_max_age smallint;
  v_preferred_regions region_enum[];
  v_required_language text;
  v_filter_game_id uuid;
  v_filter_platform platform_enum;
  v_filter_skill_level skill_level_enum;
  v_filter_playstyle playstyle_tag_enum;
  v_filter_show_id uuid;
  v_filter_recently_active boolean;
  v_my_region region_enum;
  v_my_timezone text;
  v_my_play_start smallint;
  v_my_play_end smallint;
  v_i_am_minor boolean;
  v_effective_min_age smallint;
  v_effective_max_age smallint;
  v_viewer_is_demo boolean;
  v_lol_game_id uuid;
  v_my_lol_tier text;
  v_my_lol_division smallint;
  v_my_region_is_na boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('get_deck', 40, interval '1 minute');

  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  v_is_premium := public.is_premium(v_me);
  v_i_am_minor := public.is_minor(v_me);
  v_viewer_is_demo := public.is_demo_viewer();

  select pr.min_age, pr.max_age, pr.preferred_regions, pr.required_language,
         pr.filter_game_id, pr.filter_platform, pr.filter_skill_level, pr.filter_playstyle,
         pr.filter_show_id, pr.filter_recently_active
  into v_min_age, v_max_age, v_preferred_regions, v_required_language,
       v_filter_game_id, v_filter_platform, v_filter_skill_level, v_filter_playstyle,
       v_filter_show_id, v_filter_recently_active
  from public.preferences pr
  where pr.profile_id = v_me;

  select p.region, p.timezone, p.usual_play_start_hour, p.usual_play_end_hour
  into v_my_region, v_my_timezone, v_my_play_start, v_my_play_end
  from public.profiles p where p.id = v_me;

  -- 0069: the viewer's own League rank, for the lol_duo_eligible column only. No row leaves
  -- both null, and a null rank makes every pair null (never labeled, never filtered).
  v_lol_game_id := public.lol_game_id();
  v_my_region_is_na := v_my_region in ('na_east', 'na_west');
  select pg.lol_tier, pg.lol_division
    into v_my_lol_tier, v_my_lol_division
    from public.profile_games pg
   where pg.profile_id = v_me and pg.game_id = v_lol_game_id;

  if not v_is_premium then
    v_filter_game_id := null;
    v_filter_platform := null;
    v_filter_skill_level := null;
    v_filter_playstyle := null;
    v_filter_show_id := null;
    v_filter_recently_active := false;
  end if;

  if v_i_am_minor then
    v_effective_min_age := 15;
    v_effective_max_age := 17;
  else
    v_effective_min_age := greatest(coalesce(v_min_age, 18), 18);
    v_effective_max_age := coalesce(v_max_age, 99);
  end if;

  return query
  with candidates as (
    select
      p.id,
      p.display_name,
      extract(year from age(current_date, p.dob))::int as c_age,
      p.gender,
      p.region,
      p.bio,
      p.last_active_at,
      p.timezone,
      p.usual_play_start_hour,
      p.usual_play_end_hour
    from public.profiles p
    where p.id <> v_me
      and p.is_active = true
      and p.is_admin_suspended = false
      and p.onboarding_completed = true
      and p.is_banned = false
      and (p.is_demo = false or v_viewer_is_demo)
      and not exists (
        select 1 from public.swipes s where s.swiper_id = v_me and s.target_id = p.id
      )
      and not public.is_blocked_pair(v_me, p.id)
      and extract(year from age(current_date, p.dob))::int
            between v_effective_min_age and v_effective_max_age
      and (
        v_preferred_regions is null or array_length(v_preferred_regions, 1) is null
        or p.region = any (v_preferred_regions)
      )
      and (
        v_required_language is null or exists (
          select 1 from public.profile_languages pl
          where pl.profile_id = p.id and pl.language_code = v_required_language
        )
      )
      and (
        v_filter_platform is null or exists (
          select 1 from public.profile_platforms pp
          where pp.profile_id = p.id and pp.platform = v_filter_platform
        )
      )
      and (
        v_filter_game_id is null or exists (
          select 1 from public.profile_games pg
          where pg.profile_id = p.id and pg.game_id = v_filter_game_id
        )
      )
      and (
        v_filter_skill_level is null or exists (
          select 1 from public.profile_games pg
          where pg.profile_id = p.id and pg.skill_level = v_filter_skill_level
        )
      )
      and (
        v_filter_playstyle is null or exists (
          select 1 from public.profile_playstyles pps
          where pps.profile_id = p.id and pps.tag = v_filter_playstyle
        )
      )
      and (
        v_filter_show_id is null or exists (
          select 1 from public.profile_shows psh
          where psh.profile_id = p.id and psh.show_id = v_filter_show_id
        )
      )
      and (
        not v_filter_recently_active
        or (p.last_active_at is not null and p.last_active_at > now() - interval '24 hours')
      )
  ),
  shared_games as (
    select
      c.id as profile_id,
      count(*)::int as shared_count,
      count(*) filter (where mine.skill_level = theirs.skill_level)::int as skill_match_count
    from candidates c
    join public.profile_games theirs on theirs.profile_id = c.id
    join public.profile_games mine on mine.game_id = theirs.game_id and mine.profile_id = v_me
    group by c.id
  ),
  shared_shows as (
    select c.id as profile_id, count(*)::int as shared_count
    from candidates c
    join public.profile_shows theirs on theirs.profile_id = c.id
    join public.profile_shows mine on mine.show_id = theirs.show_id and mine.profile_id = v_me
    group by c.id
  ),
  shared_languages as (
    select c.id as profile_id, count(*)::int as shared_count
    from candidates c
    join public.profile_languages theirs on theirs.profile_id = c.id
    join public.profile_languages mine on mine.language_code = theirs.language_code and mine.profile_id = v_me
    group by c.id
  ),
  boosted as (
    select distinct ab.profile_id from public.active_boosts ab where ab.expires_at > now()
  )
  select
    c.id,
    c.display_name,
    c.c_age,
    c.gender,
    c.region,
    c.bio,
    coalesce(sg.shared_count, 0),
    coalesce(ss.shared_count, 0),
    (
      coalesce(sg.shared_count, 0) * 10
      + coalesce(sg.skill_match_count, 0) * 2
      + coalesce(ss.shared_count, 0) * 5
      + coalesce(sl.shared_count, 0) * 2
      + case when c.region = v_my_region then 3 else 0 end
      + least(
          public.play_window_overlap_hours(
            v_my_play_start, v_my_play_end, v_my_timezone,
            c.usual_play_start_hour, c.usual_play_end_hour, c.timezone
          ), 6
        )
      + case when b.profile_id is not null then 1000 else 0 end
    )::numeric as score,
    d.duo
  from candidates c
  left join shared_games sg on sg.profile_id = c.id
  left join shared_shows ss on ss.profile_id = c.id
  left join shared_languages sl on sl.profile_id = c.id
  left join boosted b on b.profile_id = c.id
  left join public.profile_games lol
         on lol.profile_id = c.id and lol.game_id = v_lol_game_id
  cross join lateral (
    select case
      when v_my_region_is_na and c.region in ('na_east', 'na_west')
        then public.lol_solo_duo_eligible(v_my_lol_tier, v_my_lol_division,
                                          lol.lol_tier, lol.lol_division)
    end as duo
  ) d
  order by
    (b.profile_id is not null) desc,
    (d.duo is true) desc,
    score desc,
    c.last_active_at desc nulls last
  limit p_limit;
end;
$function$;

-- Restores the live ACL exactly, {postgres=X, authenticated=X, service_role=X} (read
-- 2026-09-23). service_role would come back through Supabase's default privileges anyway;
-- stating it makes the after-state match the before-state on paper, which is what item 19 of
-- the SQL checks compares.
revoke execute on function public.get_deck(integer) from public, anon, authenticated;
grant execute on function public.get_deck(integer) to authenticated, service_role;

comment on function public.get_deck(integer) is
  'The swipe deck. 0069: one trailing column, lol_duo_eligible (Riot''s Solo/Duo duo table for this pair, NA pairs only; null when unknown), and eligible pairs ordered first after live Power-Ups, then by score. Ordering only: eligibility never filters, so the candidate set and get_deck_pool_size are unchanged.';

-- Delivered at commit. Until PostgREST reloads, its cached metadata still names
-- get_deck(p_limit), the SQL it sends does not reference the function's OID, and the extra
-- output column simply rides along, so there is no window where the RPC fails.
notify pgrst, 'reload schema';
