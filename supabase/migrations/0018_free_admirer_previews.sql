-- Free users now see a daily preview of 3 admirers instead of an empty list.
-- Premium still sees everyone. The free trio is picked deterministically from a
-- hash seeded by the caller's local date, so it rotates each day even when no
-- new likes arrive — "come back tomorrow to see 3 more" — while staying stable
-- across refetches within the same day.

create or replace function public.get_admirers()
returns table (
  profile_id uuid,
  display_name text,
  age int,
  gender gender_enum,
  region region_enum,
  bio text,
  liked_at timestamptz
)
language plpgsql
stable
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
    and not exists (select 1 from public.swipes mine where mine.swiper_id = v_me and mine.target_id = s.swiper_id)
    and not public.is_blocked_pair(v_me, s.swiper_id)
  order by md5(s.swiper_id::text || v_local_day::text)
  limit 3;
end;
$$;
