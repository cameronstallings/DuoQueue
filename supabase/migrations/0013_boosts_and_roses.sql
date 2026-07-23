-- Boost / Roses: purchasable consumables on top of the subscription (Hinge's Boost +
-- Roses pattern). Credits are granted only by the RevenueCat webhook (service role),
-- never by the client directly — same "no client write grant, server-enforced" pattern
-- as swipes/daily_swipe_counters/subscriptions from earlier migrations.

create table public.consumable_credits (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  boosts int not null default 0 check (boosts >= 0),
  roses int not null default 0 check (roses >= 0),
  updated_at timestamptz not null default now()
);

alter table public.consumable_credits enable row level security;

create policy "consumable_credits_select_own" on public.consumable_credits
  for select using (profile_id = auth.uid());

grant select on public.consumable_credits to authenticated;
-- No insert/update/delete grant: balances only change via grant_consumable_credits
-- (webhook, service role) and activate_boost/send_rose (RPCs) below.

create table public.active_boosts (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  activated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (profile_id, activated_at)
);

alter table public.active_boosts enable row level security;
-- Intentionally no policies/grants for `authenticated` — only read by get_deck's
-- ranking below and written by activate_boost(), both SECURITY DEFINER.

create table public.processed_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.processed_webhook_events enable row level security;
-- No policies/grants at all — service-role only (bypasses RLS), used to make
-- grant_consumable_credits idempotent against RevenueCat's at-least-once webhook
-- delivery so a retried event can't double-grant credits.

-- =========================================================================
-- grant_consumable_credits: called only by the revenuecat-webhook Edge Function via
-- the service role, never by client code — execute is revoked from authenticated.
-- =========================================================================

create or replace function public.grant_consumable_credits(p_profile_id uuid, p_boosts int, p_roses int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.consumable_credits (profile_id, boosts, roses)
  values (p_profile_id, greatest(p_boosts, 0), greatest(p_roses, 0))
  on conflict (profile_id) do update
    set boosts = public.consumable_credits.boosts + excluded.boosts,
        roses = public.consumable_credits.roses + excluded.roses,
        updated_at = now();
end;
$$;

revoke execute on function public.grant_consumable_credits(uuid, int, int) from public, authenticated;
grant execute on function public.grant_consumable_credits(uuid, int, int) to service_role;

-- =========================================================================
-- get_consumable_credits: the caller's own balance (zeros if no row yet).
-- =========================================================================

create or replace function public.get_consumable_credits()
returns table (boosts int, roses int)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(cc.boosts, 0), coalesce(cc.roses, 0)
  from (select auth.uid() as me) me
  left join public.consumable_credits cc on cc.profile_id = me.me;
$$;

grant execute on function public.get_consumable_credits() to authenticated;

-- =========================================================================
-- activate_boost: spends one boost credit for a 30-minute visibility window.
-- =========================================================================

create or replace function public.activate_boost()
returns table (expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_boosts int;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select boosts into v_boosts from public.consumable_credits where profile_id = v_me for update;

  if coalesce(v_boosts, 0) <= 0 then
    raise exception 'no_boost_credits';
  end if;

  update public.consumable_credits set boosts = boosts - 1, updated_at = now() where profile_id = v_me;

  expires_at := now() + interval '30 minutes';
  insert into public.active_boosts (profile_id, expires_at) values (v_me, expires_at);
  return next;
end;
$$;

grant execute on function public.activate_boost() to authenticated;

-- =========================================================================
-- send_rose: spends one rose credit to like a specific profile — same swipe rules
-- (self/blocked/age-band) as a normal like, via perform_swipe.
-- =========================================================================

create or replace function public.send_rose(p_target_id uuid)
returns table (matched boolean, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_roses int;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select roses into v_roses from public.consumable_credits where profile_id = v_me for update;

  if coalesce(v_roses, 0) <= 0 then
    raise exception 'no_rose_credits';
  end if;

  update public.consumable_credits set roses = roses - 1, updated_at = now() where profile_id = v_me;

  return query select * from public.perform_swipe(p_target_id, 'like');
end;
$$;

grant execute on function public.send_rose(uuid) to authenticated;

-- =========================================================================
-- get_deck: same body as 0007_age_banding.sql, with an added ranking bonus for
-- profiles that currently have an active boost — the actual "increased visibility"
-- effect of Boost.
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
