-- App Review is about to hit an empty deck. This app has exactly one real user
-- (KittyKat), and Apple's Guideline 2.1 treats "tester signs in, sees nothing" as a
-- reasonable basis for rejecting a pre-launch social/matching app. The fix is a small
-- set of demo profiles that exist only for a flagged review account to see — never for
-- a real user. Apple treats fake profiles shown to genuine users as deceptive, and
-- dating-adjacent apps have been sued over exactly that, so the invisibility gating
-- built here is the whole point, not a nicety: a demo profile must be visible to a
-- demo-flagged viewer and invisible to everyone else, with zero exceptions.
--
-- This migration adds the flag and wires it into every place a profile can surface.
-- It does not create any demo data itself — that is a separate, removable step. The
-- flag alone, with every read path defaulting is_demo to false, is harmless until rows
-- with is_demo = true actually exist.
--
-- The rule, everywhere it's applied: a profile row is visible if
--   p.is_demo = false  OR  the viewer is themselves flagged is_demo.
-- "The viewer" is auth.uid(). A null auth.uid() (service role, dashboard, or any
-- other caller with no JWT sub) keeps full visibility, exactly as every other
-- visibility predicate in this schema already treats it — see 0035's note on why the
-- blocks NOT EXISTS check resolves to "visible" when auth.uid() is null, and 0053's
-- is_admin_user()/is_banned_user() calls which behave the same way. This migration
-- does not change that convention, it reuses it.
--
-- REMOVAL: once demo data is no longer needed, drop it with
--   delete from public.profiles where is_demo = true;
--   alter table public.profiles drop column is_demo;
--   drop function if exists public.is_demo_viewer();
-- then revert the WHERE-clause additions below (or just re-apply the pre-0059
-- versions of the touched functions/views — every one of them is a CREATE OR REPLACE
-- of an object that already existed, so nothing here is destructive to roll back).

-- =========================================================================
-- 1. The flag itself.
--
-- Deliberately given no UPDATE grant, the same protection 0031 put on is_admin and
-- is_banned after the table-wide UPDATE grant let any authenticated user flip their
-- own is_admin. profiles' table-wide UPDATE grant to authenticated was revoked in
-- 0031 and replaced with a column allow-list (display_name, bio, gender, region,
-- hide_last_active, is_active, onboarding_completed, usual_play_start_hour,
-- usual_play_end_hour, discord_username) that is_demo is not part of, so it inherits
-- no write access by default — this REVOKE just restates that explicitly, the same
-- belt-and-suspenders 0057 used for the TRUNCATE default. There is also no INSERT
-- policy on profiles at all (confirmed live via pg_policies), so a client can't row
-- itself into existence with is_demo = true either. The only way to set this column is
-- through the service-role key, which is exactly where the demo-seeding step belongs.
-- =========================================================================

alter table public.profiles add column is_demo boolean not null default false;

revoke update (is_demo) on public.profiles from authenticated;

-- =========================================================================
-- 2. is_demo_viewer() — "is the calling session itself a demo account".
--
-- Modeled directly on is_admin_user() (0001): zero arguments, reads only the
-- caller's own row via auth.uid(), SECURITY DEFINER so it works the same way inside a
-- view body as inside an RPC. Because it takes no id argument it can never be used to
-- probe anyone else's demo status, which is exactly why it's safe to grant EXECUTE to
-- authenticated where is_blocked_pair()/is_banned_user() (arbitrary-id arguments) are
-- not — see 0035's note on that distinction. is_admin_user() already proves this shape
-- works when referenced from inside a view/RLS-policy context (profiles_select_admin's
-- qual is literally `is_admin_user()`), so public_profile* views can call this the same
-- way without inlining the subquery twelve-plus times.
--
-- coalesce(..., false) here means "no matching row / not authenticated" reads as "not
-- a demo viewer" — the same conservative default is_admin_user() uses. That is right
-- for this function considered alone. It is deliberately NOT where the "null auth.uid()
-- = full visibility" rule lives; every call site below adds its own `auth.uid() is
-- null` (or, inside functions that already require authentication, skips the check
-- because v_me is already guaranteed non-null at that point).
-- =========================================================================

create or replace function public.is_demo_viewer()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce((select p.is_demo from public.profiles p where p.id = auth.uid()), false);
$function$;

revoke execute on function public.is_demo_viewer() from public, anon;
grant execute on function public.is_demo_viewer() to authenticated;

-- =========================================================================
-- 3. Discovery RPCs — get_deck, get_online_now, get_party_deck, get_standouts.
--
-- Live definitions pulled via pg_get_functiondef immediately before writing this
-- migration (several were modified by 0042/0048/0053, so this is not the 0001/0003/
-- 0011/0026 original body). Each already computes viewer-scoped flags once per call
-- (v_is_premium, v_i_am_minor) via a plain assignment right after the auth/ban checks;
-- v_viewer_is_demo is added the same way and the WHERE clause gains one predicate
-- alongside the existing is_active/is_admin_suspended/is_banned checks. auth.uid() is
-- already guaranteed non-null by the "Not authenticated" check at the top of every one
-- of these functions, so there is no separate null-auth.uid() branch needed here — v_me
-- being non-null is a precondition of reaching the flag computation at all.
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
  v_preferred_genders gender_enum[];
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

  select pr.min_age, pr.max_age, pr.preferred_genders, pr.preferred_regions, pr.required_language,
         pr.filter_game_id, pr.filter_platform, pr.filter_skill_level, pr.filter_playstyle,
         pr.filter_show_id, pr.filter_recently_active
  into v_min_age, v_max_age, v_preferred_genders, v_preferred_regions, v_required_language,
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
        v_preferred_genders is null or array_length(v_preferred_genders, 1) is null
        or p.gender = any (v_preferred_genders)
      )
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
  v_preferred_genders gender_enum[];
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

  select pr.min_age, pr.max_age, pr.preferred_genders, pr.preferred_regions, pr.required_language,
         pr.filter_game_id, pr.filter_platform, pr.filter_skill_level, pr.filter_playstyle
  into v_min_age, v_max_age, v_preferred_genders, v_preferred_regions, v_required_language,
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
        v_preferred_genders is null or array_length(v_preferred_genders, 1) is null
        or p.gender = any (v_preferred_genders)
      )
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

create or replace function public.get_party_deck(p_party_id uuid, p_limit integer DEFAULT 20)
 returns table(profile_id uuid, display_name text, age integer, gender gender_enum, region region_enum, bio text, shared_games_count integer, shared_shows_count integer, score numeric)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_viewer_is_demo boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('get_party_deck', 40, interval '1 minute');
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;

  v_viewer_is_demo := public.is_demo_viewer();

  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  return query
  with party_member_ids as (
    select pm.profile_id as member_profile_id from public.party_members pm where pm.party_id = p_party_id
  ),
  candidates as (
    select p.id, p.display_name, extract(year from age(current_date, p.dob))::int as c_age, p.gender, p.region, p.bio
    from public.profiles p
    where p.is_active = true
      and p.is_admin_suspended = false
      and p.onboarding_completed = true
      and p.is_banned = false
      and (p.is_demo = false or v_viewer_is_demo)
      and p.id not in (select member_profile_id from party_member_ids)
      and not exists (
        select 1 from public.party_swipes ps
        where ps.party_id = p_party_id and ps.member_id = v_me and ps.target_id = p.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = p.id and b.blocked_id in (select member_profile_id from party_member_ids))
           or (b.blocked_id = p.id and b.blocker_id in (select member_profile_id from party_member_ids))
      )
      and extract(year from age(current_date, p.dob))::int between 18 and 99
  ),
  shared_games as (
    select c.id as candidate_id, count(*)::int as shared_count
    from candidates c
    join public.profile_games theirs on theirs.profile_id = c.id
    join public.profile_games mine on mine.game_id = theirs.game_id
      and mine.profile_id in (select member_profile_id from party_member_ids)
    group by c.id
  ),
  shared_shows as (
    select c.id as candidate_id, count(*)::int as shared_count
    from candidates c
    join public.profile_shows theirs on theirs.profile_id = c.id
    join public.profile_shows mine on mine.show_id = theirs.show_id
      and mine.profile_id in (select member_profile_id from party_member_ids)
    group by c.id
  )
  select
    c.id, c.display_name, c.c_age, c.gender, c.region, c.bio,
    coalesce(sg.shared_count, 0), coalesce(ss.shared_count, 0),
    coalesce(sg.shared_count, 0)::numeric * 5 + coalesce(ss.shared_count, 0)::numeric
  from candidates c
  left join shared_games sg on sg.candidate_id = c.id
  left join shared_shows ss on ss.candidate_id = c.id
  order by coalesce(sg.shared_count, 0) desc
  limit p_limit;
end;
$function$;

revoke execute on function public.get_party_deck(uuid, integer) from public, anon;
grant execute on function public.get_party_deck(uuid, integer) to authenticated;

-- get_standouts writes a per-day pick into daily_standouts on first call, then always
-- reads that snapshot back for the rest of the day. Like the existing is_active/
-- is_admin_suspended/is_banned checks, the is_demo predicate only gates the candidate
-- pool at INSERT time, not the later read-back join — that already-established
-- inconsistency (a standout who goes inactive/banned intraday stays picked until the
-- next day) is unchanged here, and is_demo is deliberately treated the same way rather
-- than special-cased.
create or replace function public.get_standouts(p_limit integer DEFAULT 8)
 returns table(profile_id uuid, display_name text, age integer, gender gender_enum, region region_enum, bio text, shared_games_count integer, shared_shows_count integer, score numeric)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_today date := current_date;
  v_existing_count int;
  v_viewer_is_demo boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  -- staleTime is 1 hour client-side (useStandouts.ts), so even a handful of calls a
  -- minute means something is refetching far more often than the UI ever would.
  perform public.check_rate_limit('get_standouts', 20, interval '5 minutes');

  p_limit := least(greatest(coalesce(p_limit, 8), 1), 50);
  v_viewer_is_demo := public.is_demo_viewer();

  select count(*) into v_existing_count
  from public.daily_standouts ds
  where ds.profile_id = v_me and ds.day = v_today;

  if v_existing_count = 0 then
    insert into public.daily_standouts (profile_id, standout_id, day, position)
    select
      v_me,
      c.id,
      v_today,
      row_number() over (order by coalesce(sg.shared_count, 0) desc, random()) - 1
    from (
      select p.id
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
        and public.same_age_band(v_me, p.id)
    ) c
    left join (
      select theirs.profile_id, count(*)::int as shared_count
      from public.profile_games theirs
      join public.profile_games mine on mine.game_id = theirs.game_id and mine.profile_id = v_me
      group by theirs.profile_id
    ) sg on sg.profile_id = c.id
    order by coalesce(sg.shared_count, 0) desc, random()
    limit p_limit;
  end if;

  return query
  select
    p.id,
    p.display_name,
    extract(year from age(current_date, p.dob))::int,
    p.gender,
    p.region,
    p.bio,
    coalesce(sg.shared_count, 0),
    coalesce(ss.shared_count, 0),
    0::numeric
  from public.daily_standouts ds
  join public.profiles p on p.id = ds.standout_id
  left join (
    select theirs.profile_id, count(*)::int as shared_count
    from public.profile_games theirs
    join public.profile_games mine on mine.game_id = theirs.game_id and mine.profile_id = v_me
    group by theirs.profile_id
  ) sg on sg.profile_id = p.id
  left join (
    select theirs.profile_id, count(*)::int as shared_count
    from public.profile_shows theirs
    join public.profile_shows mine on mine.show_id = theirs.show_id and mine.profile_id = v_me
    group by theirs.profile_id
  ) ss on ss.profile_id = p.id
  where ds.profile_id = v_me and ds.day = v_today
  order by ds.position;
end;
$function$;

revoke execute on function public.get_standouts(integer) from public, anon;
grant execute on function public.get_standouts(integer) to authenticated;

-- =========================================================================
-- 4. Admirers and matches — get_admirers, get_admirers_count, get_matches_summary.
--
-- Named explicitly in scope ("admirers/requests, matches"). get_admirers already
-- filters is_active/is_admin_suspended (but never is_banned — pre-existing, not
-- touched here); is_demo is added alongside those on both its premium and free-tier
-- branches. get_admirers_count, unlike get_admirers, never joined profiles at all —
-- it counted matching swipe rows with no profile-status filtering whatsoever, so a
-- demo admirer would inflate the badge count even though get_admirers' own list (once
-- gated) would never show them. A join is added so the count stays consistent with the
-- list it's a count of; nothing else about its filtering changes. get_matches_summary's
-- matches CTE has never filtered on profile status at all (a match with a later-banned
-- user still shows, by design, so the conversation history isn't erased) — is_demo is
-- still added to the final select's join, because unlike ban/inactive status a demo
-- match should never exist for a non-demo viewer in the first place (Track 2 seeds
-- demo matches only for the flagged demo account), so this is pure defense in depth,
-- matching "matches" being named as an in-scope surface.
-- =========================================================================

create or replace function public.get_admirers()
 returns table(profile_id uuid, display_name text, age integer, gender gender_enum, region region_enum, bio text, liked_at timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_timezone text;
  v_local_day date;
  v_viewer_is_demo boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  v_viewer_is_demo := public.is_demo_viewer();

  if public.is_premium(v_me) then
    return query
    select
      p.id,
      p.display_name,
      extract(year from age(current_date, p.dob))::int,
      p.gender,
      p.region,
      p.bio,
      s.created_at
    from public.swipes s
    join public.profiles p on p.id = s.swiper_id
    where s.target_id = v_me
      and s.action = 'like'
      and p.is_active = true
      and p.is_admin_suspended = false
      and (p.is_demo = false or v_viewer_is_demo)
      and not exists (select 1 from public.swipes mine where mine.swiper_id = v_me and mine.target_id = s.swiper_id)
      and not public.is_blocked_pair(v_me, s.swiper_id)
    order by s.created_at desc;
    return;
  end if;

  select p.timezone into v_timezone from public.profiles p where p.id = v_me;
  v_local_day := (now() at time zone coalesce(v_timezone, 'utc'))::date;

  return query
  select
    p.id,
    p.display_name,
    extract(year from age(current_date, p.dob))::int,
    p.gender,
    p.region,
    p.bio,
    s.created_at
  from public.swipes s
  join public.profiles p on p.id = s.swiper_id
  where s.target_id = v_me
    and s.action = 'like'
    and p.is_active = true
    and p.is_admin_suspended = false
    and (p.is_demo = false or v_viewer_is_demo)
    and not exists (select 1 from public.swipes mine where mine.swiper_id = v_me and mine.target_id = s.swiper_id)
    and not public.is_blocked_pair(v_me, s.swiper_id)
  order by md5(s.swiper_id::text || v_local_day::text)
  limit 3;
end;
$function$;

revoke execute on function public.get_admirers() from public, anon;
grant execute on function public.get_admirers() to authenticated;

create or replace function public.get_admirers_count()
 returns integer
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_count int;
  v_viewer_is_demo boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  v_viewer_is_demo := public.is_demo_viewer();

  select count(*) into v_count
  from public.swipes s
  join public.profiles p on p.id = s.swiper_id
  where s.target_id = v_me
    and s.action = 'like'
    and (p.is_demo = false or v_viewer_is_demo)
    and not exists (select 1 from public.swipes mine where mine.swiper_id = v_me and mine.target_id = s.swiper_id)
    and not public.is_blocked_pair(v_me, s.swiper_id);

  return v_count;
end;
$function$;

revoke execute on function public.get_admirers_count() from public, anon;
grant execute on function public.get_admirers_count() to authenticated;

create or replace function public.get_matches_summary()
 returns table(match_id uuid, other_profile_id uuid, other_display_name text, other_photo_path text, last_message text, last_message_at timestamp with time zone, last_message_sender_id uuid, unread_count integer, is_locked boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_is_premium boolean;
  v_viewer_is_demo boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  v_is_premium := public.is_premium(v_me);
  v_viewer_is_demo := public.is_demo_viewer();

  return query
  with my_matches as (
    select
      m.id,
      case when m.user_a_id = v_me then m.user_b_id else m.user_a_id end as other_id,
      m.matched_at
    from public.matches m
    where (m.user_a_id = v_me or m.user_b_id = v_me) and m.unmatched_at is null
  ),
  last_msgs as (
    select distinct on (msg.match_id) msg.match_id, msg.content, msg.created_at, msg.sender_id
    from public.messages msg
    where msg.match_id in (select id from my_matches)
    order by msg.match_id, msg.created_at desc
  ),
  unread as (
    select msg.match_id, count(*) as cnt
    from public.messages msg
    where msg.match_id in (select id from my_matches)
      and msg.sender_id <> v_me
      and msg.read_at is null
    group by msg.match_id
  ),
  ranked as (
    select
      mm.id,
      greatest(mm.matched_at, coalesce(lm.created_at, mm.matched_at)) as activity
    from my_matches mm
    left join last_msgs lm on lm.match_id = mm.id
  ),
  unlocked_ids as (
    select id from ranked order by activity desc limit 5
  )
  select
    mm.id,
    mm.other_id,
    p.display_name,
    (
      select pmedia.storage_path from public.profile_media pmedia
      where pmedia.profile_id = mm.other_id
        and pmedia.moderation_status = 'approved'
        and pmedia.photo_role = 'profile'
    ),
    lm.content,
    lm.created_at,
    lm.sender_id,
    coalesce(u.cnt, 0)::int,
    not (v_is_premium or mm.id in (select id from unlocked_ids))
  from my_matches mm
  join public.profiles p on p.id = mm.other_id
  left join last_msgs lm on lm.match_id = mm.id
  left join unread u on u.match_id = mm.id
  where (p.is_demo = false or v_viewer_is_demo)
  order by greatest(mm.matched_at, coalesce(lm.created_at, mm.matched_at)) desc;
end;
$function$;

revoke execute on function public.get_matches_summary() from public, anon;
grant execute on function public.get_matches_summary() to authenticated;

-- =========================================================================
-- 5. The public_profile* views, plus public_linked_accounts and public_verified_stats.
--
-- 0035 defines the twelve public_profile* views; 0053 added is_admin_suspended/
-- is_banned to all twelve AND to two more views outside that name pattern —
-- public_linked_accounts and public_verified_stats — which carry the identical
-- is_active/is_admin_suspended/onboarding_completed/is_banned/blocks predicate (0053's
-- own comment notes these two were "the two views 0052's `like 'public_profile%'` name
-- match missed entirely"). Since they mark the exact same "should this profile be
-- visible" decision, they get the same is_demo predicate here — leaving them out would
-- repeat 0052's original oversight for a strictly worse reason.
--
-- Each gets one added predicate: `(is_demo = false or auth.uid() is null or
-- public.is_demo_viewer())`, following the null-auth.uid()-means-full-visibility
-- convention already established by the blocks NOT EXISTS check directly below it in
-- every one of these views. public_verified_stats is also readable by anon (confirmed
-- live, predates this migration, not introduced or changed here) — anon calls also
-- have a null auth.uid(), so they fall through the same "auth.uid() is null" branch the
-- existing blocks check already falls through for anon on that view today. That is a
-- pre-existing property of granting anon SELECT there, not a new gap opened here.
--
-- CREATE OR REPLACE VIEW is expected to preserve each view's ACL (0035's own comment
-- says so, and 0053's re-grant loop for these same fourteen views was written as
-- defensive belt-and-suspenders, not because a loss was observed). This migration is
-- not willing to assume that, so it re-runs the identical fixup 0053 used: revoke the
-- write privileges 0052/0053 already closed, and re-grant only SELECT to authenticated
-- (and, for public_verified_stats specifically, to anon as well, to preserve the one
-- grant that differs from the rest). Nothing else is touched.
-- =========================================================================

create or replace view public.public_profiles as
select
  id,
  display_name,
  extract(year from age(current_date::timestamptz, dob::timestamptz))::int as age,
  gender,
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

create or replace view public.public_profile_media as
select pm.id, pm.profile_id, pm.storage_path, pm.photo_role, pm."position"
from public.profile_media pm
join public.profiles p on p.id = pm.profile_id
where pm.moderation_status = 'approved'
  and p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_voice_intro as
select pvi.profile_id, pvi.storage_path, pvi.duration_seconds
from public.profile_voice_intro pvi
join public.profiles p on p.id = pvi.profile_id
where pvi.moderation_status = 'approved'
  and p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_games as
select pg.profile_id, pg.game_id, g.name as game_name, pg.skill_level, pg.rank_text, pg.priority
from public.profile_games pg
join public.games g on g.id = pg.game_id
join public.profiles p on p.id = pg.profile_id
where p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_shows as
select ps.profile_id, ps.show_id, s.name as show_name, s.category, ps.priority
from public.profile_shows ps
join public.shows s on s.id = ps.show_id
join public.profiles p on p.id = ps.profile_id
where p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_platforms as
select pp.profile_id, pp.platform
from public.profile_platforms pp
join public.profiles p on p.id = pp.profile_id
where p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_languages as
select pl.profile_id, pl.language_code
from public.profile_languages pl
join public.profiles p on p.id = pl.profile_id
where p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_playstyles as
select pps.profile_id, pps.tag
from public.profile_playstyles pps
join public.profiles p on p.id = pps.profile_id
where p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_prompts as
select pp.profile_id, pp."position", pr.question, pp.answer
from public.profile_prompts pp
join public.prompts pr on pr.id = pp.prompt_id
join public.profiles p on p.id = pp.profile_id
where p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_vibe as
select pv.profile_id, pv.intensity, pv.comms_style, pv.coaching_pref, pv.tilt_handling
from public.profile_vibe pv
join public.profiles p on p.id = pv.profile_id
where p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_schedule as
select id as profile_id, usual_play_start_hour, usual_play_end_hour
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

create or replace view public.public_profile_activity as
select
  id as profile_id,
  case when hide_last_active then false
       else (last_active_at is not null and last_active_at > now() - interval '24:00:00')
  end as is_recently_active
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

create or replace view public.public_linked_accounts as
select la.profile_id, la.provider, la.display_name, la.rank_tier
from public.linked_accounts la
join public.profiles p on p.id = la.profile_id
where p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_verified_stats as
select vs.profile_id, vs.provider, vs.game_id, g.name as game_name, vs.stat_kind, vs.stat_value, vs.fetched_at
from public.verified_stats vs
left join public.games g on g.id = vs.game_id
join public.profiles p on p.id = vs.profile_id
where p.is_active = true
  and p.is_admin_suspended = false
  and p.onboarding_completed = true
  and p.is_banned = false
  and (p.is_demo = false or auth.uid() is null or public.is_demo_viewer())
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

do $$
declare
  v_view text;
begin
  foreach v_view in array array[
    'public_profiles', 'public_profile_media', 'public_profile_voice_intro',
    'public_profile_games', 'public_profile_shows', 'public_profile_platforms',
    'public_profile_languages', 'public_profile_playstyles', 'public_profile_prompts',
    'public_profile_vibe', 'public_profile_schedule', 'public_profile_activity',
    'public_linked_accounts', 'public_verified_stats'
  ]
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon, authenticated',
      v_view
    );
    execute format('grant select on public.%I to authenticated', v_view);
  end loop;

  -- public_verified_stats is the one view in this set that anon can also read
  -- (pre-existing, confirmed live before this migration, not changed by it) — restore
  -- that grant too since the loop above only asserts authenticated.
  execute 'grant select on public.public_verified_stats to anon';
end;
$$;
