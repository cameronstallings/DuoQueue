-- Schedule/timezone matching: a "usual play window" (local hours, wraps past
-- midnight when start > end) plus a ranking bonus in get_deck for candidates whose
-- window overlaps the viewer's, converted to a common UTC reference so two people
-- in different timezones are compared fairly. A perfect match who only plays at
-- 4am the viewer's time is otherwise useless, per the brief.

alter table public.profiles add column usual_play_start_hour smallint;
alter table public.profiles add column usual_play_end_hour smallint;
alter table public.profiles add constraint play_start_hour_range
  check (usual_play_start_hour is null or usual_play_start_hour between 0 and 23);
alter table public.profiles add constraint play_end_hour_range
  check (usual_play_end_hour is null or usual_play_end_hour between 0 and 23);

-- Returns how many of the 24 hours in a day both windows cover, after converting
-- each window's local hours to UTC using each profile's own timezone. `at time zone`
-- resolves DST correctly for "now" automatically (unlike a fixed offset constant).
create or replace function public.play_window_overlap_hours(
  a_start smallint, a_end smallint, a_tz text,
  b_start smallint, b_end smallint, b_tz text
) returns smallint
language plpgsql
stable
as $$
declare
  a_offset numeric;
  b_offset numeric;
  a_hours int[];
  b_hours int[];
  overlap_count int;
begin
  if a_start is null or a_end is null or b_start is null or b_end is null then
    return 0;
  end if;

  a_offset := extract(epoch from ((now() at time zone coalesce(a_tz, 'utc')) - (now() at time zone 'utc'))) / 3600;
  b_offset := extract(epoch from ((now() at time zone coalesce(b_tz, 'utc')) - (now() at time zone 'utc'))) / 3600;

  select array_agg((((h - a_offset)::int % 24) + 24) % 24) into a_hours
  from generate_series(0, 23) as h
  where (a_start <= a_end and h between a_start and a_end)
     or (a_start > a_end and (h >= a_start or h <= a_end));

  select array_agg((((h - b_offset)::int % 24) + 24) % 24) into b_hours
  from generate_series(0, 23) as h
  where (b_start <= b_end and h between b_start and b_end)
     or (b_start > b_end and (h >= b_start or h <= b_end));

  select count(*) into overlap_count from unnest(a_hours) au where au = any (b_hours);

  return coalesce(overlap_count, 0);
end;
$$;

grant execute on function public.play_window_overlap_hours(smallint, smallint, text, smallint, smallint, text) to authenticated;

-- profiles is select-own-only via RLS, so displaying someone else's play window needs
-- the same "public, column-limited view" pattern as public_profile_activity.
create view public.public_profile_schedule as
select p.id as profile_id, p.usual_play_start_hour, p.usual_play_end_hour
from public.profiles p
where p.is_active = true and p.onboarding_completed = true;

grant select on public.public_profile_schedule to authenticated;

-- get_deck: same body as 0014_more_premium_filters.sql, plus a capped bonus for
-- play-window overlap (weighted similarly to the existing region-match bonus).
create or replace function public.get_deck(p_limit int default 20)
returns table (
  profile_id uuid,
  display_name text,
  age int,
  gender gender_enum,
  region region_enum,
  bio text,
  shared_games_count int,
  shared_shows_count int,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $$
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
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  v_is_premium := public.is_premium(v_me);
  v_i_am_minor := public.is_minor(v_me);

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
      and p.onboarding_completed = true
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
$$;
