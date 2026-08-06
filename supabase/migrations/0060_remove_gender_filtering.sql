-- 0060: delete gender-based filtering, because the App Review notes say it doesn't exist.
--
-- The submission notes tell Apple "there is no gender-based filtering anywhere in the
-- app." That was true of every screen and false of the database. No client code reads or
-- writes preferences.preferred_genders and there has never been a UI to set it, but
-- get_deck and get_online_now both still ended their candidate WHERE clause with
--
--   v_preferred_genders is null or array_length(v_preferred_genders, 1) is null
--   or p.gender = any (v_preferred_genders)
--
-- and preferences kept the table-wide `grant select, insert, update, delete ... to
-- authenticated` 0001 handed out, never narrowed to a column allow-list the way profiles'
-- UPDATE grant was in 0031. So one request from an ordinary account, against its own row,
-- straight through the preferences_all_own policy:
--
--   PATCH /rest/v1/preferences?profile_id=eq.<self>   { "preferred_genders": ["female"] }
--
-- turns every later get_deck and get_online_now call into a gender-filtered feed, for as
-- long as the row says so. "There is no UI for it" is not the same claim as "the app
-- cannot do it", and what Apple was told is about the app.
--
-- That gap is the whole reason this migration exists rather than an edit to the review
-- notes. A reviewer poking at the REST API is not a hypothetical for a matching app in
-- this category, and a 2.3.1 finding — the metadata says one thing, the binary's backend
-- does another — is a much worse outcome than the filter was ever worth. The feature is
-- dead code with a live back door; the fix is to remove the capability, so that the
-- sentence is true by construction and stays true no matter what anyone PATCHes.
--
-- THE TRAP, and the reason the order below is not cosmetic: Postgres does not parse a
-- plpgsql body when you alter a table, so `alter table ... drop column preferred_genders`
-- succeeds happily while get_deck still selects it. The migration goes green, nothing
-- warns, and the deck starts throwing `column pr.preferred_genders does not exist` at
-- runtime on the first swipe — a total discovery outage that only shows up in the app.
-- Functions are redefined first, the column goes last. Same reason the two function
-- bodies below are copied verbatim from 0059 with only the gender lines cut: this is the
-- live matching path, 0059's is_demo gating and 0048's rate limits and 0053's
-- is_admin_suspended check all live in these bodies, and a "cleanup" pass over any of it
-- would be an untested change to the one code path App Review is guaranteed to exercise.
-- Every other filter (region, language, age band, the premium-only game/platform/skill/
-- playstyle/show/recently-active set), the boost scoring, the ordering, the grants and
-- the security settings are byte-for-byte what 0059 left.
--
-- THE SECOND DOOR, and the reason section 3 exists: removing the preference was not
-- enough on its own. `public_profiles` selected profiles.gender, and PostgREST turns
-- every column a view exposes into a filter operator. The view sets no security_invoker,
-- so it reads profiles with its owner's rights and sails past the profiles_select_own
-- RLS policy that otherwise pins a user to their own row. That made
--
--   GET /rest/v1/public_profiles?gender=eq.female&select=id,display_name,age,region,bio
--
-- a one-request gender-filtered roster of the entire discovery pool, carrying the same
-- fields a deck card shows, with no write and no RPC first. The harvested ids feed
-- straight into perform_swipe, which checks banned/self/blocked/age-band and never that
-- the target came out of a deck — a complete gender-filtered discovery-and-match loop
-- that never calls get_deck or get_online_now at all. Strictly easier than the
-- preferred_genders route this migration was written for. Section 3 closes it.
--
-- Deliberately NOT touched:
--   * get_party_deck, get_standouts, get_admirers — checked, none of them ever had the
--     gender predicate (0011's own comment notes standouts ignores preference filters
--     entirely), so there is nothing to remove and no reason to rewrite them. They keep
--     returning gender in their result rows, which is fine: those are server-ranked sets
--     the caller cannot add a gender predicate to.
--   * profiles.gender itself. Users state their own gender and it shows on their card;
--     displaying it is not filtering by it, and it is what the 0031 column allow-list
--     already lets a user edit about themselves. Removing the column would mean tearing
--     out onboarding, the profile card and gender_enum, which is a different and much
--     larger change than the claim requires. What section 3 removes is the ability to
--     ask the server for profiles *by* gender, not the ability to see one.
--   * preferences.preferred_regions and every other column on that table.
--
-- There is no REMOVAL/rollback section here, unlike 0059's. Putting this back would
-- re-introduce exactly the capability the review notes deny.

-- =========================================================================
-- 1. get_deck — 0059's body, minus the v_preferred_genders declaration, its column in
--    the preferences fetch (and the matching INTO target), and the filter predicate.
--    Nothing else differs.
-- =========================================================================

create or replace function public.get_deck(p_limit integer DEFAULT 20)
 returns table(profile_id uuid, display_name text, age integer, gender gender_enum, region region_enum, bio text, shared_games_count integer, shared_shows_count integer, score numeric)
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
    )::numeric as score
  from candidates c
  left join shared_games sg on sg.profile_id = c.id
  left join shared_shows ss on ss.profile_id = c.id
  left join shared_languages sl on sl.profile_id = c.id
  left join boosted b on b.profile_id = c.id
  order by score desc, c.last_active_at desc nulls last
  limit p_limit;
end;
$function$;

revoke execute on function public.get_deck(integer) from public, anon;
grant execute on function public.get_deck(integer) to authenticated;

-- =========================================================================
-- 2. get_online_now — same three deletions, same "nothing else changes" rule.
-- =========================================================================

create or replace function public.get_online_now(p_limit integer DEFAULT 30)
 returns table(profile_id uuid, display_name text, age integer, gender gender_enum, region region_enum, bio text, shared_games_count integer, shared_shows_count integer, last_active_at timestamp with time zone)
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
  v_i_am_minor boolean;
  v_effective_min_age smallint;
  v_effective_max_age smallint;
  v_viewer_is_demo boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('get_online_now', 20, interval '1 minute');

  p_limit := least(greatest(coalesce(p_limit, 30), 1), 50);

  v_is_premium := public.is_premium(v_me);
  v_i_am_minor := public.is_minor(v_me);
  v_viewer_is_demo := public.is_demo_viewer();

  select pr.min_age, pr.max_age, pr.preferred_regions, pr.required_language,
         pr.filter_game_id, pr.filter_platform, pr.filter_skill_level, pr.filter_playstyle
  into v_min_age, v_max_age, v_preferred_regions, v_required_language,
       v_filter_game_id, v_filter_platform, v_filter_skill_level, v_filter_playstyle
  from public.preferences pr
  where pr.profile_id = v_me;

  if not v_is_premium then
    v_filter_game_id := null;
    v_filter_platform := null;
    v_filter_skill_level := null;
    v_filter_playstyle := null;
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
      p.last_active_at
    from public.profiles p
    where p.id <> v_me
      and p.is_active = true
      and p.is_admin_suspended = false
      and p.onboarding_completed = true
      and p.is_banned = false
      and (p.is_demo = false or v_viewer_is_demo)
      and p.is_looking_now = true
      and p.looking_now_expires_at > now()
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
  ),
  shared_games as (
    select c.id as profile_id, count(*)::int as shared_count
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
    c.last_active_at
  from candidates c
  left join shared_games sg on sg.profile_id = c.id
  left join shared_shows ss on ss.profile_id = c.id
  order by c.last_active_at desc nulls last
  limit p_limit;
end;
$function$;

revoke execute on function public.get_online_now(integer) from public, anon;
grant execute on function public.get_online_now(integer) to authenticated;

-- =========================================================================
-- 3. public_profiles stops returning gender, and get_profile_card takes over the one
--    read that needed it.
--
-- A column PostgREST cannot see is a column PostgREST cannot filter on, so the fix is to
-- take gender out of the view rather than to police how it is queried. That costs one
-- caller: apps/mobile/src/features/profile/useProfileCard.ts selects
-- `id, display_name, age, gender, region, bio` from this view to render a matched user's
-- profile card. get_profile_card below gives it the same row back through a SECURITY
-- DEFINER function, where the caller supplies an id and nothing else — there is no
-- WHERE for them to inject a gender predicate into. Gender stays visible one profile at
-- a time and in the server-ranked decks, and bulk enumeration by gender stops existing.
-- (useParty.ts:35 is this view's only other caller and selects id/display_name/age; it
-- needs no change.)
--
-- CREATE OR REPLACE VIEW cannot drop a column — it can only append — so this has to be a
-- real DROP and CREATE, and that is where the care is needed:
--
--   * Supabase's stock bootstrap leaves `alter default privileges in schema public grant
--     all on tables to anon, authenticated, service_role` in place. A freshly created
--     view in public therefore comes back with ALL privileges granted to anon and
--     authenticated — which would silently undo 0031's `revoke select ... from anon`
--     AND reopen 0052/0053's hole, since this view is auto-updatable and a write grant
--     on it means `PATCH /rest/v1/public_profiles?id=eq.<anyone>` rewrites someone
--     else's display_name and bio. The revoke/grant block below is not decoration; it is
--     the whole reason a DROP is more dangerous here than a REPLACE.
--   * The view is recreated by the same role that owns it and owns public.profiles, so
--     it keeps reading the base table with owner rights. That bypass is load-bearing:
--     profiles_select_own (0001:71) would otherwise reduce this view to the caller's own
--     row and break both the profile card and party member lists.
--
-- Nothing in the schema depends on public_profiles (no view, function, policy or
-- constraint references it — only comments do), so the DROP is deliberately not CASCADE:
-- if that ever stops being true, this should fail loudly rather than quietly delete
-- whatever grew on top of it.
-- =========================================================================

drop view if exists public.public_profiles;

create view public.public_profiles as
select
  id,
  display_name,
  extract(year from age(current_date::timestamptz, dob::timestamptz))::int as age,
  region,
  bio,
  created_at
from public.profiles p
where is_active = true
  and is_admin_suspended = false
  and onboarding_completed = true
  and is_banned = false
  and (is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

-- Restores exactly the ACL 0031/0052/0053/0059 converged on, against a view that was
-- just recreated from scratch with default privileges. anon loses everything (0031),
-- authenticated keeps SELECT and nothing else (0052/0053/0059).
revoke all on public.public_profiles from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.public_profiles from authenticated;
grant select on public.public_profiles to authenticated;

-- The single-row replacement for the one card read that still needs gender. Mirrors the
-- view's visibility rules exactly — active, not suspended, onboarded, not banned, demo
-- profiles only for demo viewers, and blocked either direction is invisible — minus the
-- view's `auth.uid() is null` escape hatch, which exists there only because anon could
-- once read it. Here the null check is an outright rejection. STABLE + SECURITY DEFINER
-- follows get_reputation (0055).
--
-- No rate limit, deliberately: this replaces an unmetered view read on the profile-detail
-- path, and adding a first-ever limit to that path days before submission is a bigger
-- risk than it retires. It does leave a caller able to walk ids from public_profiles and
-- ask for one card at a time; that is the caller sorting results they fetched, not the
-- server answering "give me the women," which is the claim that matters.
create or replace function public.get_profile_card(p_profile_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  age integer,
  gender gender_enum,
  region region_enum,
  bio text
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    p.id,
    p.display_name,
    extract(year from age(current_date::timestamptz, p.dob::timestamptz))::int,
    p.gender,
    p.region,
    p.bio
  from public.profiles p
  where auth.uid() is not null
    and p.id = p_profile_id
    and p.is_active = true
    and p.is_admin_suspended = false
    and p.onboarding_completed = true
    and p.is_banned = false
    and (p.is_demo = false or public.is_demo_viewer())
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    );
$function$;

revoke execute on function public.get_profile_card(uuid) from public, anon;
grant execute on function public.get_profile_card(uuid) to authenticated;

-- =========================================================================
-- 4. The column. Last, for the reason in the header.
--
-- Nothing else in the schema depends on it: no index, constraint, view, RLS policy or
-- trigger references preferred_genders, and the only two function bodies that did are
-- the two rewritten above. Dropping it is what makes the claim structural rather than
-- procedural — with the column gone there is no value for a future get_deck edit to read
-- and no field for an API client to set, so this cannot quietly come back the way it
-- quietly stayed. Existing values are discarded with the column; they were never
-- reachable from the app and, on a project with one real user, there are none.
--
-- `if exists` because this is the only statement in the file that is not idempotent
-- otherwise, and the apply path can strand it: scripts/db/apply-migration.ps1 records
-- the version in schema_migrations in a SEPARATE request AFTER the transaction commits
-- (lines 56-57), so an interrupted run leaves the schema changed and the version
-- unrecorded, and the retry aborts on `column "preferred_genders" ... does not exist`
-- with everything else in the file having re-run cleanly.
-- =========================================================================

alter table public.preferences drop column if exists preferred_genders;
