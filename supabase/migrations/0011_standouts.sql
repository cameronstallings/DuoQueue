-- Standouts: a small daily set of profiles picked outside the caller's usual
-- preference filters (gender/region/language/advanced filters are all ignored —
-- the age-band boundary still applies since that one is a safety rule enforced
-- everywhere, not a preference). The set is pinned for the caller's current UTC
-- day: the first call of the day computes and stores it, later calls just replay
-- the same rows in the same order.

create table public.daily_standouts (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  standout_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  position smallint not null check (position >= 0),
  primary key (profile_id, day, position),
  unique (profile_id, day, standout_id)
);

alter table public.daily_standouts enable row level security;
-- Intentionally no policies/grants for `authenticated` — internal to
-- get_standouts() below, same pattern as daily_swipe_counters.

create or replace function public.get_standouts(p_limit int default 8)
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
  v_today date := current_date;
  v_existing_count int;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

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
        and p.onboarding_completed = true
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
$$;

grant execute on function public.get_standouts(int) to authenticated;
