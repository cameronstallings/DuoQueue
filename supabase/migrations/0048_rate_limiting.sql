-- Rate limiting, part (b): PostgREST RPCs. Generalizes 0042 section (f)'s per-sender
-- message limiter into ONE reusable primitive and applies it to the RPCs an attacker
-- could actually abuse: full-user-base scrapes (0042 section (b) already clamped
-- p_limit on the deck readers to 50 rows/call, but nothing stopped calling them once a
-- second forever), swipe/like/consumable-spend actions, party creation/invite
-- response, and report/block submission. See 0042's own header for why (f) counted
-- straight off messages/party_messages instead of a bucket table: no sliding window
-- fits a single per-day counter shape the way daily_swipe_counters does. That reasoning
-- doesn't generalize past messages, though — most of the actions below have no table of
-- their own to count off (activate_boost, respond_party_invite) or the per-action table
-- already gets deleted/rewritten by the action itself (party_swipes upserts on
-- conflict, so "count recent rows" would undercount a rapid re-swipe). A generic
-- (profile_id, bucket, created_at) hits table sidesteps both problems at the cost of
-- one extra small table.
--
-- check_rate_limit() is deliberately NOT parameterized by profile id — it always reads
-- auth.uid() itself, so nothing calling it (and nothing calling *those* callers) can
-- point it at another user's bucket. Every RPC below already requires auth.uid() to be
-- non-null before it reaches the check, so the "auth.uid() is null -> skip" branch only
-- ever fires for the trigger call sites lower in this file, where it exists purely to
-- let service-role/dashboard writes on reports/blocks through unthrottled (matches the
-- privileged-bypass reasoning 0043's header already gives for storage policies, and
-- 0042/0035's for the public_* views).
--
-- check_rate_limit_service() is a second, deliberately separate entry point for Edge
-- Functions (part (c), see supabase/functions/_shared/rate-limit.ts): those run in
-- Deno, not inside a Postgres transaction with auth.uid() already set, and they resolve
-- caller identity themselves via a verified JWT (userClient.auth.getUser()) before ever
-- reaching Postgres. It takes an explicit p_profile_id instead of reading auth.uid(),
-- which would be unsafe to expose to `authenticated` (a client could pass anyone's id)
-- -- so it is granted to service_role only, making the service-role key the only thing
-- that can ever supply an id, and Edge Functions never forward a client-controlled
-- header/body field into that parameter (see the Edge Function diffs below — the id
-- always comes from getUser() or, for link-steam-callback, from the profile id
-- consume_steam_link_state() resolves from its one-time state token).
--
-- Every limit below is picked to sit well above anything a real user's fingers or a
-- normal client retry loop can produce, with the reasoning stated per bucket. A limit
-- that fires on legitimate use is worse than no limit at all.

create table public.rate_limit_hits (
  -- bigint identity, not the uuid-pk convention the rest of this schema uses: this
  -- table is written on nearly every authenticated request in the app, and a bigint
  -- sequence avoids both gen_random_uuid()'s per-row entropy cost and the index
  -- fragmentation a random uuid pk would cause on a hot, append-only table. Nothing
  -- ever references this id by value (no foreign keys point at it) so it costs nothing
  -- to deviate here.
  id bigint generated always as identity primary key,
  profile_id uuid not null,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_profile_bucket_created_at_idx
  on public.rate_limit_hits (profile_id, bucket, created_at);

alter table public.rate_limit_hits enable row level security;
-- Intentionally no policies/grants for `authenticated` — same pattern as active_boosts
-- and processed_webhook_events (0013): only ever touched by the two SECURITY DEFINER
-- functions below, never read or written directly by a client.

create or replace function public.check_rate_limit(p_bucket text, p_limit int, p_window interval)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_count int;
begin
  if v_me is null then
    return;
  end if;

  -- Bounded, indexed prune scoped to exactly the row this call is about to count, so a
  -- hot bucket's row count doesn't grow unbounded between cron sweeps without taking a
  -- table-wide lock. rate_limit_hits_cleanup_hourly below is the backstop for buckets
  -- that go cold (a caller stops hitting a bucket entirely, so this per-call prune
  -- never runs for it again).
  delete from public.rate_limit_hits
  where profile_id = v_me and bucket = p_bucket and created_at <= now() - p_window;

  select count(*) into v_count
  from public.rate_limit_hits
  where profile_id = v_me and bucket = p_bucket and created_at > now() - p_window;

  if v_count >= p_limit then
    raise exception 'rate_limit_exceeded:%', p_bucket;
  end if;

  insert into public.rate_limit_hits (profile_id, bucket) values (v_me, p_bucket);
end;
$$;

revoke execute on function public.check_rate_limit(text, int, interval) from public, anon, authenticated;

create or replace function public.check_rate_limit_service(
  p_profile_id uuid, p_bucket text, p_limit int, p_window interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_profile_id is null then
    raise exception 'p_profile_id is required';
  end if;

  delete from public.rate_limit_hits
  where profile_id = p_profile_id and bucket = p_bucket and created_at <= now() - p_window;

  select count(*) into v_count
  from public.rate_limit_hits
  where profile_id = p_profile_id and bucket = p_bucket and created_at > now() - p_window;

  if v_count >= p_limit then
    raise exception 'rate_limit_exceeded:%', p_bucket;
  end if;

  insert into public.rate_limit_hits (profile_id, bucket) values (p_profile_id, p_bucket);
end;
$$;

revoke execute on function public.check_rate_limit_service(uuid, text, int, interval) from public, anon, authenticated;
grant execute on function public.check_rate_limit_service(uuid, text, int, interval) to service_role;

-- Cleanup backstop. Every window used below is <= 1 hour, so anything older than 2
-- hours is dead weight regardless of which bucket it belongs to. Offset 15 minutes past
-- the hour so it doesn't contend with the two existing jobs at :00 and :00/:30
-- (daily-swipes-refreshed-hourly, reengagement-nudges-half-hourly).
select cron.schedule(
  'rate_limit_hits_cleanup_hourly',
  '15 * * * *',
  $$delete from public.rate_limit_hits where created_at < now() - interval '2 hours'$$
);

-- ---------------------------------------------------------------------------
-- Deck-style readers. 0042 section (b) already clamped p_limit to <=50 rows/call —
-- this bounds call *frequency* instead, the axis that clamp didn't touch. Limits are
-- read off each screen's actual refetch behavior (apps/mobile/src/features/swipe,
-- online-now, party): get_online_now polls every 30s (2/min baseline) while a screen
-- is open; get_deck/get_party_deck refetch on mount/focus (staleTime 0) rather than on
-- an interval; get_standouts is cached client-side for an hour. Each limit below is
-- at least 10x the busiest realistic session.
-- ---------------------------------------------------------------------------

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
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('get_deck', 40, interval '1 minute');

  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

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
      and p.is_banned = false
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

grant execute on function public.get_deck(int) to authenticated;
revoke execute on function public.get_deck(int) from public, anon;

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
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  -- staleTime is 1 hour client-side (useStandouts.ts), so even a handful of calls a
  -- minute means something is refetching far more often than the UI ever would.
  perform public.check_rate_limit('get_standouts', 20, interval '5 minutes');

  p_limit := least(greatest(coalesce(p_limit, 8), 1), 50);

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
        and p.is_banned = false
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
revoke execute on function public.get_standouts(int) from public, anon;

create or replace function public.get_online_now(p_limit int default 30)
returns table (
  profile_id uuid,
  display_name text,
  age int,
  gender gender_enum,
  region region_enum,
  bio text,
  shared_games_count int,
  shared_shows_count int,
  last_active_at timestamptz
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
  v_i_am_minor boolean;
  v_effective_min_age smallint;
  v_effective_max_age smallint;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  -- Client polls this one every 30s while the screen is open (REFETCH_INTERVAL_MS,
  -- useOnlineNow.ts) = 2/min baseline; 20/min is 10x that.
  perform public.check_rate_limit('get_online_now', 20, interval '1 minute');

  p_limit := least(greatest(coalesce(p_limit, 30), 1), 50);

  v_is_premium := public.is_premium(v_me);
  v_i_am_minor := public.is_minor(v_me);

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
      and p.onboarding_completed = true
      and p.is_banned = false
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
$$;

grant execute on function public.get_online_now(int) to authenticated;
revoke execute on function public.get_online_now(int) from public, anon;

create or replace function public.get_party_deck(p_party_id uuid, p_limit int default 20)
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
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  -- Bucketed on the caller alone (not per-party): a member of several parties shares
  -- one budget across all of them, which is still generous for how few parties a real
  -- user is ever in at once.
  perform public.check_rate_limit('get_party_deck', 40, interval '1 minute');
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;

  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  return query
  with party_member_ids as (
    select pm.profile_id as member_profile_id from public.party_members pm where pm.party_id = p_party_id
  ),
  candidates as (
    select p.id, p.display_name, extract(year from age(current_date, p.dob))::int as c_age, p.gender, p.region, p.bio
    from public.profiles p
    where p.is_active = true
      and p.onboarding_completed = true
      and p.is_banned = false
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
$$;

grant execute on function public.get_party_deck(uuid, int) to authenticated;
revoke execute on function public.get_party_deck(uuid, int) from public, anon;

-- ---------------------------------------------------------------------------
-- Swipe/like/consumable-spend actions. perform_swipe already gates non-premium
-- callers at 25/day via daily_swipe_counters, but a premium account (or a Boost/Rose
-- credit holder) has no server-side cap on call *rate* at all today — this closes
-- that. send_super_ping/send_rose/activate_boost are additionally gated by their own
-- resource checks (1/day, credit balance, credit balance) so a real user can never get
-- near these limits either way; the limit here exists to stop the *check itself* from
-- being hammered, not to constrain legitimate spend.
-- ---------------------------------------------------------------------------

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
  if public.is_banned_user(v_swiper_id) then
    raise exception 'account_banned';
  end if;
  -- 1/sec sustained, well above the fastest realistic flick-swiping. The free-tier
  -- 25/day cap below already binds tighter for non-premium callers; this exists for
  -- premium/unlimited swipers, who currently have no server-side rate cap at all.
  perform public.check_rate_limit('perform_swipe', 60, interval '1 minute');
  if v_swiper_id = p_target_id then
    raise exception 'Cannot swipe on yourself';
  end if;
  if public.is_blocked_pair(v_swiper_id, p_target_id) then
    raise exception 'Cannot swipe on a blocked user';
  end if;
  if not public.same_age_band(v_swiper_id, p_target_id) then
    raise exception 'Cannot interact across age groups';
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
revoke execute on function public.perform_swipe(uuid, swipe_action_enum) from public, anon;

create or replace function public.perform_party_swipe(p_party_id uuid, p_target_id uuid, p_action swipe_action_enum)
returns table (invited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_member_count int;
  v_like_count int;
  v_blocked boolean;
  v_cross_band boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('perform_party_swipe', 60, interval '1 minute');
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;
  if v_me = p_target_id then
    raise exception 'Cannot swipe on yourself';
  end if;

  -- The target must be clear of *every* member, not just the caller: an invite drops
  -- the target into a chat with all of them.
  select exists (
    select 1 from public.party_members pm
    where pm.party_id = p_party_id
      and public.is_blocked_pair(pm.profile_id, p_target_id)
  ) into v_blocked;
  if v_blocked then
    raise exception 'Cannot swipe on a blocked user';
  end if;

  select exists (
    select 1 from public.party_members pm
    where pm.party_id = p_party_id
      and coalesce(public.same_age_band(pm.profile_id, p_target_id), false) = false
  ) into v_cross_band;
  if v_cross_band then
    raise exception 'Cannot interact across age groups';
  end if;

  insert into public.party_swipes (party_id, member_id, target_id, action)
  values (p_party_id, v_me, p_target_id, p_action)
  on conflict (party_id, member_id, target_id) do update set action = excluded.action, created_at = now();

  invited := false;

  if p_action = 'like' then
    select count(*) into v_member_count from public.party_members where party_id = p_party_id;
    select count(*) into v_like_count
    from public.party_swipes ps
    where ps.party_id = p_party_id and ps.target_id = p_target_id and ps.action = 'like'
      and ps.member_id in (select profile_id from public.party_members where party_id = p_party_id);

    if v_member_count > 0 and v_like_count >= v_member_count then
      insert into public.party_invites (party_id, target_id) values (p_party_id, p_target_id)
      on conflict (party_id, target_id) do nothing;
      invited := true;
    end if;
  end if;

  return next;
end;
$$;

grant execute on function public.perform_party_swipe(uuid, uuid, swipe_action_enum) to authenticated;
revoke execute on function public.perform_party_swipe(uuid, uuid, swipe_action_enum) from public, anon;

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
  -- Real usage is <= 1/day (enforced below via super_pings); this only stops the
  -- 1/day check itself from being hammered.
  perform public.check_rate_limit('send_super_ping', 10, interval '1 minute');

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
revoke execute on function public.send_super_ping(uuid) from public, anon;

create or replace function public.send_rose(p_target_id uuid)
returns table (matched boolean, match_id uuid, used_free_rose boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_roses int;
  v_last_free_rose_at timestamptz;
  v_free_available boolean;
  v_swipe_result record;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  -- Real usage is <= 1 free rose/day plus however many purchased credits a caller
  -- holds; this only stops the credit check itself from being hammered.
  perform public.check_rate_limit('send_rose', 10, interval '1 minute');

  insert into public.consumable_credits (profile_id) values (v_me)
  on conflict (profile_id) do nothing;

  select roses, last_free_rose_at into v_roses, v_last_free_rose_at
  from public.consumable_credits
  where profile_id = v_me
  for update;

  v_free_available := v_last_free_rose_at is null or now() - v_last_free_rose_at >= interval '24 hours';

  if v_free_available then
    update public.consumable_credits set last_free_rose_at = now(), updated_at = now() where profile_id = v_me;
    used_free_rose := true;
  elsif coalesce(v_roses, 0) > 0 then
    update public.consumable_credits set roses = roses - 1, updated_at = now() where profile_id = v_me;
    used_free_rose := false;
  else
    raise exception 'rose_on_cooldown';
  end if;

  select * into v_swipe_result from public.perform_swipe(p_target_id, 'like');
  matched := v_swipe_result.matched;
  match_id := v_swipe_result.match_id;
  return next;
end;
$$;

grant execute on function public.send_rose(uuid) to authenticated;
revoke execute on function public.send_rose(uuid) from public, anon;

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
  -- A boost lasts 30 minutes and costs a purchased credit; nobody legitimately
  -- activates more than a couple per minute even mashing the button.
  perform public.check_rate_limit('activate_boost', 5, interval '1 minute');

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
revoke execute on function public.activate_boost() from public, anon;

-- ---------------------------------------------------------------------------
-- Party creation and invite response.
-- ---------------------------------------------------------------------------

create or replace function public.create_party(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_party_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  -- Forming a party is rare even for an active user — a handful a day at most.
  perform public.check_rate_limit('create_party', 10, interval '1 hour');

  select case when user_a_id = v_me then user_b_id when user_b_id = v_me then user_a_id end
  into v_other
  from public.matches
  where id = p_match_id and unmatched_at is null;

  if v_other is null then
    raise exception 'Not a participant in an active match';
  end if;

  select pa.id into v_party_id
  from public.parties pa
  where pa.created_by = v_me
    and (select count(*) from public.party_members pm where pm.party_id = pa.id) = 2
    and exists (
      select 1 from public.party_members pm
      where pm.party_id = pa.id and pm.profile_id = v_other
    )
  order by pa.created_at desc
  limit 1;

  if v_party_id is not null then
    return v_party_id;
  end if;

  insert into public.parties (created_by) values (v_me) returning id into v_party_id;
  insert into public.party_members (party_id, profile_id) values (v_party_id, v_me), (v_party_id, v_other);

  return v_party_id;
end;
$$;

grant execute on function public.create_party(uuid) to authenticated;
revoke execute on function public.create_party(uuid) from public, anon;

create or replace function public.respond_party_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_party_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  perform public.check_rate_limit('respond_party_invite', 20, interval '1 hour');

  select party_id into v_party_id
  from public.party_invites
  where id = p_invite_id and target_id = v_me and status = 'pending';

  if v_party_id is null then
    raise exception 'No pending invite';
  end if;

  if p_accept then
    insert into public.party_members (party_id, profile_id) values (v_party_id, v_me)
    on conflict do nothing;
    update public.party_invites set status = 'accepted' where id = p_invite_id;
  else
    update public.party_invites set status = 'declined' where id = p_invite_id;
  end if;
end;
$$;

grant execute on function public.respond_party_invite(uuid, boolean) to authenticated;
revoke execute on function public.respond_party_invite(uuid, boolean) from public, anon;

-- ---------------------------------------------------------------------------
-- Report submission and account-facing writes that could be spammed. Both `reports`
-- and `blocks` only ever get written through a direct client INSERT under RLS
-- (reports_insert_own / blocks_insert_own, 0001_init.sql) — neither has an RPC of its
-- own — so a BEFORE INSERT trigger is the only place to put this, same reasoning
-- 0042 section (f) gives for messages/party_messages. Both triggers call
-- check_rate_limit() with no explicit id, so a service-role write (there are none in
-- the app today, but the admin tooling reads these tables) passes through unthrottled
-- via the auth.uid() is null branch, matching every other privileged-bypass check in
-- this schema.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_report_submit_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Real reporting is bursty but rare even for someone actively cleaning up a bad
  -- actor across several matches/parties in one sitting.
  perform public.check_rate_limit('submit_report', 20, interval '1 hour');
  return new;
end;
$$;

revoke execute on function public.enforce_report_submit_rate_limit() from public, anon, authenticated;

drop trigger if exists enforce_report_submit_rate_limit_trigger on public.reports;
create trigger enforce_report_submit_rate_limit_trigger
  before insert on public.reports
  for each row execute function public.enforce_report_submit_rate_limit();

create or replace function public.enforce_block_create_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_rate_limit('create_block', 30, interval '1 hour');
  return new;
end;
$$;

revoke execute on function public.enforce_block_create_rate_limit() from public, anon, authenticated;

drop trigger if exists enforce_block_create_rate_limit_trigger on public.blocks;
create trigger enforce_block_create_rate_limit_trigger
  before insert on public.blocks
  for each row execute function public.enforce_block_create_rate_limit();
