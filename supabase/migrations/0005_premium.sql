-- Phase 4: premium-only features. "See who swiped right on you" and Super Ping both
-- require an active subscription, checked server-side via is_premium() (0003_matching.sql)
-- rather than trusted from the client.

-- =========================================================================
-- get_admirers_count: safe for anyone to call — a teaser number for the
-- paywall ("3 people already liked you"), with no profile data attached.
-- =========================================================================

create or replace function public.get_admirers_count()
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_count int;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_count
  from public.swipes s
  where s.target_id = v_me
    and s.action = 'like'
    and not exists (select 1 from public.swipes mine where mine.swiper_id = v_me and mine.target_id = s.swiper_id)
    and not public.is_blocked_pair(v_me, s.swiper_id);

  return v_count;
end;
$$;

grant execute on function public.get_admirers_count() to authenticated;

-- =========================================================================
-- get_admirers: the actual profiles. Premium-only — a free caller gets an
-- empty set back rather than an error, matching the "advanced filters are
-- silently ignored for free users" pattern used elsewhere.
-- =========================================================================

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
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_premium(v_me) then
    return;
  end if;

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
end;
$$;

grant execute on function public.get_admirers() to authenticated;

-- =========================================================================
-- send_super_ping: premium-only, 1/day (per the caller's local day, same
-- convention as the swipe quota), and always records a "like" swipe via
-- perform_swipe so a mutual match is still detected the normal way.
-- =========================================================================

create or replace function public.send_super_ping(p_target_id uuid)
returns table (matched boolean, match_id uuid, ping_sent boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_timezone text;
  v_local_day date;
  v_ping_count int;
  v_swipe_result record;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_premium(v_me) then
    raise exception 'super_ping_requires_premium';
  end if;

  select timezone into v_timezone from public.profiles where id = v_me;
  v_local_day := (now() at time zone coalesce(v_timezone, 'utc'))::date;

  select count(*) into v_ping_count
  from public.super_pings
  where sender_id = v_me
    and (created_at at time zone coalesce(v_timezone, 'utc'))::date = v_local_day;

  if v_ping_count >= 1 then
    raise exception 'super_ping_limit_reached';
  end if;

  select * into v_swipe_result from public.perform_swipe(p_target_id, 'like');

  insert into public.super_pings (sender_id, receiver_id) values (v_me, p_target_id);

  matched := v_swipe_result.matched;
  match_id := v_swipe_result.match_id;
  ping_sent := true;
  return next;
end;
$$;

grant execute on function public.send_super_ping(uuid) to authenticated;
