-- Phase 2: matching RPCs. Swipe quota, deck ranking, and match creation all live in
-- SECURITY DEFINER functions so they run under the function owner's privileges,
-- bypassing the deliberately-missing client grants on swipes/daily_swipe_counters/
-- matches from 0001_init.sql — these tables stay write-only-via-RPC.

create or replace function public.is_blocked_pair(user1 uuid, user2 uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = user1 and blocked_id = user2)
       or (blocker_id = user2 and blocked_id = user1)
  );
$$;

grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated;

create or replace function public.is_premium(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where profile_id = p_profile_id
      and status in ('active', 'trialing', 'grace_period')
  );
$$;

grant execute on function public.is_premium(uuid) to authenticated;

-- =========================================================================
-- perform_swipe: records a swipe, enforces the free-tier daily quota, and
-- creates a match on mutual likes. Idempotent on retry (a duplicate swipe for
-- the same pair reports the current match state instead of recharging quota).
-- =========================================================================

create or replace function public.perform_swipe(p_target_id uuid, p_action swipe_action_enum)
returns table (matched boolean, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swiper_id uuid := auth.uid();
  v_timezone text;
  v_local_day date;
  v_is_premium boolean;
  v_swipe_count int;
  v_existing_action swipe_action_enum;
  v_mutual_like boolean;
  v_user_a uuid;
  v_user_b uuid;
begin
  if v_swiper_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_swiper_id = p_target_id then
    raise exception 'Cannot swipe on yourself';
  end if;
  if public.is_blocked_pair(v_swiper_id, p_target_id) then
    raise exception 'Cannot swipe on a blocked user';
  end if;

  select action into v_existing_action
  from public.swipes
  where swiper_id = v_swiper_id and target_id = p_target_id;

  if v_existing_action is not null then
    select m.id into match_id
    from public.matches m
    where m.user_a_id = least(v_swiper_id, p_target_id)
      and m.user_b_id = greatest(v_swiper_id, p_target_id)
      and m.unmatched_at is null;

    matched := match_id is not null;
    return next;
    return;
  end if;

  v_is_premium := public.is_premium(v_swiper_id);

  if not v_is_premium then
    select timezone into v_timezone from public.profiles where id = v_swiper_id;
    v_local_day := (now() at time zone coalesce(v_timezone, 'utc'))::date;

    insert into public.daily_swipe_counters (profile_id, day, swipe_count)
    values (v_swiper_id, v_local_day, 0)
    on conflict (profile_id, day) do nothing;

    select swipe_count into v_swipe_count
    from public.daily_swipe_counters
    where profile_id = v_swiper_id and day = v_local_day
    for update;

    if v_swipe_count >= 25 then
      raise exception 'daily_swipe_limit_reached';
    end if;

    update public.daily_swipe_counters
    set swipe_count = swipe_count + 1
    where profile_id = v_swiper_id and day = v_local_day;
  end if;

  insert into public.swipes (swiper_id, target_id, action)
  values (v_swiper_id, p_target_id, p_action);

  matched := false;
  match_id := null;

  if p_action = 'like' then
    select exists (
      select 1 from public.swipes
      where swiper_id = p_target_id and target_id = v_swiper_id and action = 'like'
    ) into v_mutual_like;

    if v_mutual_like then
      v_user_a := least(v_swiper_id, p_target_id);
      v_user_b := greatest(v_swiper_id, p_target_id);

      insert into public.matches (user_a_id, user_b_id)
      values (v_user_a, v_user_b)
      on conflict (user_a_id, user_b_id) do update set unmatched_at = null, unmatched_by = null
      returning id into match_id;

      matched := true;
    end if;
  end if;

  return next;
end;
$$;

grant execute on function public.perform_swipe(uuid, swipe_action_enum) to authenticated;

-- =========================================================================
-- get_swipe_quota: lets the client show "N swipes left today" and preemptively
-- route to the paywall instead of waiting for perform_swipe to error.
-- =========================================================================

create or replace function public.get_swipe_quota()
returns table (swipes_used int, swipes_limit int, is_premium boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_timezone text;
  v_local_day date;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  is_premium := public.is_premium(v_me);
  select timezone into v_timezone from public.profiles where id = v_me;
  v_local_day := (now() at time zone coalesce(v_timezone, 'utc'))::date;

  select coalesce(swipe_count, 0) into swipes_used
  from public.daily_swipe_counters
  where profile_id = v_me and day = v_local_day;
  swipes_used := coalesce(swipes_used, 0);
  swipes_limit := case when is_premium then null else 25 end;

  return next;
end;
$$;

grant execute on function public.get_swipe_quota() to authenticated;

-- =========================================================================
-- get_deck: ranked, filtered candidate list. Basic filters (age, gender,
-- region, language) always apply; advanced filters (game, platform, skill,
-- playstyle) are silently ignored unless the caller is premium — enforced
-- here server-side, not left to the client to decide whether to send them.
-- Ranking weights: shared games highest, then shared shows, region match,
-- shared languages, and a small bonus per shared game with matching skill
-- level ("compatible skill level").
-- =========================================================================

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
  v_my_region region_enum;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  v_is_premium := public.is_premium(v_me);

  select pr.min_age, pr.max_age, pr.preferred_genders, pr.preferred_regions, pr.required_language,
         pr.filter_game_id, pr.filter_platform, pr.filter_skill_level, pr.filter_playstyle
  into v_min_age, v_max_age, v_preferred_genders, v_preferred_regions, v_required_language,
       v_filter_game_id, v_filter_platform, v_filter_skill_level, v_filter_playstyle
  from public.preferences pr
  where pr.profile_id = v_me;

  select p.region into v_my_region from public.profiles p where p.id = v_me;

  if not v_is_premium then
    v_filter_game_id := null;
    v_filter_platform := null;
    v_filter_skill_level := null;
    v_filter_playstyle := null;
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
      and p.onboarding_completed = true
      and not exists (
        select 1 from public.swipes s where s.swiper_id = v_me and s.target_id = p.id
      )
      and not public.is_blocked_pair(v_me, p.id)
      and extract(year from age(current_date, p.dob))::int
            between coalesce(v_min_age, 18) and coalesce(v_max_age, 99)
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
    )::numeric as score
  from candidates c
  left join shared_games sg on sg.profile_id = c.id
  left join shared_shows ss on ss.profile_id = c.id
  left join shared_languages sl on sl.profile_id = c.id
  order by score desc, c.last_active_at desc nulls last
  limit p_limit;
end;
$$;

grant execute on function public.get_deck(int) to authenticated;
