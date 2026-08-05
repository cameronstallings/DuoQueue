-- Track A — authorization and identity hardening. Five independent fixes, each
-- verified live in a rolled-back transaction before and after (evidence in
-- r-authz.md). Numbered sections below match the audit brief's own numbering.

-- =========================================================================
-- (1) CRITICAL — message tampering via messages_mark_read.
--
-- The policy's USING clause lets any non-sending match participant UPDATE a message
-- row to flip read_at, but it never had a WITH CHECK, and the 0004 comment's claim
-- that "column-level grant means even a crafted UPDATE can't touch content/sender_id/
-- is_flagged — only read_at" turned out to be false on the live project:
-- information_schema.column_privileges shows `authenticated` (and even `anon`) hold
-- full-table UPDATE/INSERT/DELETE/TRUNCATE on every column of messages, not just
-- read_at — Supabase's default privileges at table-creation time were never revoked,
-- and the later `grant update (read_at)` was purely additive on top, never
-- restrictive. A crafted PATCH could rewrite content, forge sender_id, or relocate a
-- message into a different match_id the caller belongs to.
--
-- A plain RLS `with check` cannot express "every other column must equal what it
-- already was" — WITH CHECK only sees the resulting NEW row, not OLD, and a
-- self-referencing subquery to fetch OLD from the same RLS-protected table recurses
-- ("infinite recursion detected in policy for relation messages", confirmed live)
-- rather than comparing anything. So this closes the hole two ways instead:
--   a) restore the grants to what the original comment always intended — only
--      read_at is writable, and only by authenticated (anon gets nothing at all);
--   b) add a BEFORE UPDATE trigger that pins every other column to its OLD value,
--      as a backstop that holds even if a future migration re-broadens the grant
--      the way this one just discovered had silently happened.
-- Verified live: attacker-as-recipient content/sender_id rewrite blocked, legitimate
-- read-receipt marking by the recipient still succeeds, sender-marks-own-message stays
-- blocked (pre-existing behavior, unchanged), and the trigger alone (independent of
-- the grant) still blocks tampering if UPDATE is experimentally re-granted.
-- =========================================================================

revoke all on public.messages from anon;
revoke insert, update, delete, truncate on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

create or replace function public.enforce_messages_read_only_update()
returns trigger
language plpgsql
as $$
begin
  if new.content is distinct from old.content
     or new.sender_id is distinct from old.sender_id
     or new.match_id is distinct from old.match_id
     or new.is_flagged is distinct from old.is_flagged
     or new.created_at is distinct from old.created_at
     or new.id is distinct from old.id
  then
    raise exception 'only read_at may be updated on messages';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_messages_read_only_update_trigger on public.messages;
create trigger enforce_messages_read_only_update_trigger
  before update on public.messages
  for each row execute function public.enforce_messages_read_only_update();

-- =========================================================================
-- (5) HIGH — separate admin suspension from the user's own pause toggle.
--
-- profiles.is_active is used for two unrelated things: the user's own "pause my
-- profile" switch (usePrivacyToggles.ts, which the authenticated column-grant on
-- is_active already lets them write), and trust-and-safety.md 4(a)'s prescribed
-- first response step for a suspended account ("set is_active = false... before
-- anything else"). Because both write the same column, a suspended user can just
-- flip the pause switch back on and instantly reappear everywhere. Add a distinct,
-- admin-only column (same non-client-writable pattern as is_banned/is_admin — simply
-- never added to the authenticated column-grant allowlist on profiles) and make it a
-- second, independent gate everywhere is_active is currently used to decide whether a
-- profile is visible to other users. The user's own is_active toggle keeps working
-- exactly as before; it just can no longer undo an admin suspension by itself.
--
-- Consumers enumerated by live introspection (not by grepping migration files, since
-- several objects were redefined more than once and only the *current* definition
-- matters): information_schema.routines/views filtered on `%is_active%` in the public
-- schema, cross-checked against pg_policies (no RLS policy anywhere references
-- is_active directly). That is exactly:
--   functions: get_admirers, get_deck, get_online_now, get_party_deck,
--     get_profiles_needing_swipe_refresh_notification, get_standouts
--   views: public_profiles, public_profile_media, public_profile_voice_intro,
--     public_profile_games, _shows, _platforms, _languages, _playstyles, _prompts,
--     _vibe, _schedule, _activity, public_linked_accounts, public_verified_stats
-- Every one of those gets "and is_admin_suspended = false" alongside its existing
-- is_active check below. (Not touched: get_admirers already lacked an is_banned
-- check before this migration — that's a separate, pre-existing gap outside this
-- track's scope, not introduced or widened here.)
-- =========================================================================

alter table public.profiles add column is_admin_suspended boolean not null default false;
alter table public.profiles add column admin_suspended_at timestamptz;
alter table public.profiles add column admin_suspension_reason text;

alter table public.profiles
  add constraint admin_suspension_reason_length
  check (admin_suspension_reason is null or char_length(admin_suspension_reason) <= 500) not valid;

-- Admin-only write path, same shape as set_profile_ban (0042) plus the audit-log call
-- every admin action added since 0047 gets. Distinct from a ban: suspension is the
-- lighter, often-temporary first response the T&S doc calls for, not a permanent flag.
create or replace function public.set_profile_suspension(p_profile_id uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set is_admin_suspended = p_suspended,
      admin_suspended_at = case when p_suspended then now() else null end,
      admin_suspension_reason = case when p_suspended then p_reason else null end
  where id = p_profile_id;

  perform public.log_admin_action(
    'set_profile_suspension',
    p_target_profile_id => p_profile_id,
    p_detail => jsonb_build_object('suspended', p_suspended, 'reason', p_reason)
  );
end;
$$;

grant execute on function public.set_profile_suspension(uuid, boolean, text) to authenticated;
revoke execute on function public.set_profile_suspension(uuid, boolean, text) from public, anon;

-- ---- functions --------------------------------------------------------

create or replace function public.get_admirers()
returns table (profile_id uuid, display_name text, age int, gender gender_enum, region region_enum, bio text, liked_at timestamptz)
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
      and p.is_admin_suspended = false
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
    and not exists (select 1 from public.swipes mine where mine.swiper_id = v_me and mine.target_id = s.swiper_id)
    and not public.is_blocked_pair(v_me, s.swiper_id)
  order by md5(s.swiper_id::text || v_local_day::text)
  limit 3;
end;
$$;

grant execute on function public.get_admirers() to authenticated;
revoke execute on function public.get_admirers() from public, anon;

create or replace function public.get_deck(p_limit integer default 20)
returns table (profile_id uuid, display_name text, age int, gender gender_enum, region region_enum, bio text, shared_games_count int, shared_shows_count int, score numeric)
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
      and p.is_admin_suspended = false
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

grant execute on function public.get_deck(integer) to authenticated;
revoke execute on function public.get_deck(integer) from public, anon;

create or replace function public.get_online_now(p_limit integer default 30)
returns table (profile_id uuid, display_name text, age int, gender gender_enum, region region_enum, bio text, shared_games_count int, shared_shows_count int, last_active_at timestamptz)
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
      and p.is_admin_suspended = false
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

grant execute on function public.get_online_now(integer) to authenticated;
revoke execute on function public.get_online_now(integer) from public, anon;

create or replace function public.get_party_deck(p_party_id uuid, p_limit integer default 20)
returns table (profile_id uuid, display_name text, age int, gender gender_enum, region region_enum, bio text, shared_games_count int, shared_shows_count int, score numeric)
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
      and p.is_admin_suspended = false
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

grant execute on function public.get_party_deck(uuid, integer) to authenticated;
revoke execute on function public.get_party_deck(uuid, integer) from public, anon;

create or replace function public.get_profiles_needing_swipe_refresh_notification()
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.is_active = true
    and p.is_admin_suspended = false
    and p.onboarding_completed = true
    and extract(hour from (now() at time zone coalesce(p.timezone, 'utc'))) = 0
    and not public.is_premium(p.id)
    and not exists (
      select 1 from public.swipe_refresh_notifications srn
      where srn.profile_id = p.id
        and srn.last_notified_day = (now() at time zone coalesce(p.timezone, 'utc'))::date
    );
$$;

-- =========================================================================
-- (4) HIGH — create_party / respond_party_invite never got the is_banned_user()
-- guard every sibling RPC received in 0042/0048. Added here, same idiom (checked
-- immediately after the auth check, before the rate limit) and same error string
-- ('account_banned') as get_deck et al. above.
-- =========================================================================

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
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  -- Forming a party is rare even for an active user - a handful a day at most.
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
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
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

-- back to (5): get_standouts, last of the six is_active-consuming functions.

create or replace function public.get_standouts(p_limit integer default 8)
returns table (profile_id uuid, display_name text, age int, gender gender_enum, region region_enum, bio text, shared_games_count int, shared_shows_count int, score numeric)
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
        and p.is_admin_suspended = false
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

grant execute on function public.get_standouts(integer) to authenticated;
revoke execute on function public.get_standouts(integer) from public, anon;

-- =========================================================================
-- (2) + (5) — the twelve public_profile_* discovery views, plus
-- public_linked_accounts and public_verified_stats. Two independent gaps closed in
-- the same CREATE OR REPLACE per view (both are "add one more predicate to the same
-- WHERE clause", easiest to verify together): (2) none of these fourteen views
-- checked is_banned, so a banned account's profile/photos/voice intro stayed fully
-- readable (and, since storage's profile_photos_select_approved/
-- voice_intros_select_approved policies join through public_profile_media/
-- public_profile_voice_intro, downloadable) to any ordinary stranger; (5) none of
-- them respected the new is_admin_suspended flag either, for the reasons in section
-- (5) above. CREATE OR REPLACE VIEW does not reliably guarantee ACL survives
-- untouched across this project's tooling, so SELECT is re-granted to authenticated
-- explicitly after each one and nothing else is re-granted — matching 0052's fix,
-- which must not be undone.
--
-- Bonus finding while doing this: public_linked_accounts and public_verified_stats
-- were the two views 0052's `like 'public_profile%'` name match missed entirely —
-- live grants still showed full INSERT/UPDATE/DELETE/TRUNCATE for both anon and
-- authenticated on both. Closed here the same way 0052 closed it for the other
-- twelve.
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
end;
$$;

-- =========================================================================
-- (3) CRITICAL — 18+ signup gate NULL bypass.
--
-- `v_dob !~ pattern` is SQL NULL (not TRUE) when v_dob is NULL, and plpgsql's
-- `IF NULL THEN` does not fire, so an omitted/null dob in signup metadata silently
-- produced a profiles row with dob = NULL instead of being rejected. Fix the guard to
-- treat NULL the same as malformed (matching the pattern same_age_band() already used
-- two sections later in 0031), and harden profile_must_be_18 plus the column itself so
-- a NULL dob can never satisfy the 18+ check regardless of how it got there. Zero
-- existing rows have a NULL dob (checked live before adding the NOT NULL), so this is
-- safe to apply directly.
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob text := new.raw_user_meta_data ->> 'dob';
  v_timezone text := new.raw_user_meta_data ->> 'timezone';
  v_parsed_dob date;
begin
  if v_dob is null or v_dob !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'A valid date of birth is required to create an account';
  end if;

  v_parsed_dob := v_dob::date;

  if v_parsed_dob > (current_date - interval '18 years')::date then
    raise exception 'You must be at least 18 to create an account';
  end if;

  insert into public.profiles (id, display_name, dob, timezone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    v_parsed_dob,
    case when public.is_valid_timezone(v_timezone) then v_timezone else null end
  );

  insert into public.preferences (profile_id) values (new.id);
  insert into public.notification_settings (profile_id) values (new.id);
  insert into public.profile_vibe (profile_id) values (new.id);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles alter column dob set not null;

alter table public.profiles drop constraint profile_must_be_18;
alter table public.profiles add constraint profile_must_be_18
  check (dob is not null and dob <= (current_date - interval '18 years')::date);
