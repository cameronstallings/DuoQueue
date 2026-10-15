-- 0071: the deck leads with people who can actually play with you, and hides accounts that
-- will never answer.
--
-- WHY. Read off the live database on 2026-10-14 (audit in the 15 Oct planning session):
--
--   * Likes land on people who never come back. Every one of the 86 unanswered likes since
--     launch went to someone who never swiped or messaged again, and 51 of them sat on six
--     accounts that last swiped in August or never swiped at all. None of the six had a push
--     token, so nothing could ever bring them back to answer.
--   * Region barely counts. An exact region match is worth +3 and a shared game +10, so for an
--     NA East viewer an EU or SA card (score 10 to 12) outranks every NA East card (score 5),
--     and NA East vs NA West counts as "different" although they queue on one League server.
--   * last_active_at is null for 24 of 29 real profiles (the client heartbeat never left the
--     phone until the OTA fix), so the last tiebreak put two July/August accounts above people
--     who swiped yesterday.
--   * Nothing put a player who already liked you in front of you, although a liked player who
--     does answer likes back about 70% of the time.
--
-- Cameron's decisions (15 Oct 2026) that this file implements:
--
--   1. DECK ORDER: same server group first, then players who already liked you AND share a
--      game AND your server group, then recently active players, then the existing keys.
--   2. HIDE DORMANT ACCOUNTS: a profile with no swipe, message, heartbeat (last_active_at) or
--      onboarding in 21+ days AND no push token is left out of decks, the pool count and the
--      alert batches. It comes back on its next activity: a swipe, a message, a heartbeat or
--      registering a push token. Nothing is written to the profile; dormancy is computed.
--
-- ============================================================================
-- THE SHIPPED-CLIENT CONTRACT (App Store 1.0.1 calls these and cannot be patched)
-- ============================================================================
--
-- get_deck(integer), get_deck_pool_size() and get_party_deck(uuid, integer) keep their exact
-- signatures, RETURNS shapes and ACLs (`create or replace` keeps the ACL). Each is rebuilt
-- from its LIVE definition (pg_get_functiondef, 2026-10-14), so 0048's rate limits, 0053's
-- is_admin_suspended check, 0059's demo gate, 0067's is_minor() call and 0069's lol_duo
-- column all carry over unchanged. The only edits:
--
--   get_deck         one WHERE line (dormant), one computed column (last_seen) and the
--                    ORDER BY. The score column's value is unchanged.
--   deck_gate_hard   one line (dormant). 0062's rule, "IF YOU CHANGE get_deck's WHERE CLAUSE,
--                    CHANGE THESE TWO FUNCTIONS IN THE SAME MIGRATION", is honoured here: the
--                    new predicate is not a preference, so it belongs in the hard gate only.
--                    get_deck_pool_size and get_new_player_alert_batch both go through
--                    deck_gate_hard, so they pick it up without being edited.
--   get_party_deck   one line (dormant). A party deck is a deck, and a party like on a dormant
--                    account is an invite nobody will ever answer.
--
-- get_standouts gets the same dormant line in 0081, where it is rebuilt anyway for its rate
-- limit.
--
-- ============================================================================
-- THE NEW ORDER, KEY BY KEY
-- ============================================================================
--
--   1. live Power-Up                                   (unchanged: a paid promise)
--   2. same server group                                (new)
--   3. already liked me AND shares a game AND same group (new)
--   4. seen in the last 14 days                         (new)
--   5. Riot duo-eligible (NA League pairs only)         (unchanged, 0069)
--   6. score                                            (unchanged)
--   7. last seen, newest first                          (was last_active_at alone)
--
-- "Server group" is server_group(region): na_east and na_west are one group ('na'), every
-- other region is its own. Region is self-reported location, not a Riot server, so in the
-- deck it is an ORDER key and never a filter: nobody disappears from a deck because of it.
-- The alert pushes (0072) treat it as a hard requirement, because a push that points at a
-- player you cannot queue with spends the one person-push a day on a dead end.
--
-- The liker key requires a shared game AND the same group on purpose. The audit's first draft
-- put every liker first, and its verifier showed what that does: for a new NA East player the
-- only two likers were an SA and an Asia account with no shared game, and they would have
-- jumped above all seven NA East players who share a game. A liker who cannot play with you is
-- just another card.
--
-- Nothing on the card says "this person liked you" (the return columns are unchanged). The
-- free daily trio in get_admirers already shows who liked you, so this does not undercut the
-- paid "everyone who wants to duo" list in practice. Cameron's call, made 15 Oct.
--
-- "Last seen" is the latest of last_active_at, onboarding_completed_at, the newest swipe the
-- player MADE and the newest message they SENT. It reads real activity, so it is right before
-- the heartbeat OTA reaches phones, and a player who just finished onboarding and has not
-- swiped yet is "recently active" (otherwise the new-player alert's "they are in your deck
-- now" would point at the bottom of the deck).
--
-- ============================================================================
-- DORMANT, PRECISELY
-- ============================================================================
--
--   is_dormant_profile(p) = NOT is_demo
--                           AND no push_tokens row
--                           AND greatest(last seen, profiles.created_at) < now() - 21 days
--
-- created_at is in the greatest() as a floor so an account younger than 21 days is never
-- dormant, whatever else is missing. A push token alone keeps an account visible, because a
-- token means the person can be told about a like and come back to answer it.
--
-- DEMO PROFILES ARE NEVER DORMANT, and this is load-bearing. The seeded personas App Review
-- swipes through (0059: visible only to demo viewers) have no push tokens and have done nothing
-- since August, so without the is_demo exception every one of them would vanish from the
-- review account's deck and App Review would open 1.0.2 on an empty deck. Real players never
-- see demo profiles, so the exception cannot put a dormant account in front of anyone real.
--
-- Census on 2026-10-14: 0 real (non-demo) onboarded accounts are dormant today. The six
-- accounts the audit named are either now is_demo (the four pre-launch ones, flagged earlier
-- today) or onboarded on 2 Oct; three of those 2 Oct accounts (no token, no activity since)
-- cross the 21-day line on 23 Oct and drop out of decks then, by themselves.
--
-- ============================================================================
-- GRANTS
-- ============================================================================
--
-- The three helpers are revoked from public, anon AND authenticated: Supabase's default
-- privileges grant EXECUTE to anon, authenticated and service_role at creation, and revoking
-- from PUBLIC alone does not remove a role's own grant (the 0013 mistake 0041 cleaned up).
-- They are only ever called from inside SECURITY DEFINER functions, which run as the owner.
--
-- Checks: supabase/checks/0071_deck_order_and_dormant_accounts.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

-- One League server for both NA regions; every other region is its own group. Pure, so
-- immutable. NULL in, NULL out, and every caller wraps the comparison in coalesce(..., false).
create or replace function public.server_group(p_region public.region_enum)
returns text
language sql
immutable
set search_path = public
as $fn$
  select case
    when p_region in ('na_east', 'na_west') then 'na'
    else p_region::text
  end;
$fn$;

revoke execute on function public.server_group(public.region_enum) from public, anon, authenticated;

-- Serves profile_last_seen_at's "newest swipe this player made". swipes_swiper_id_idx exists,
-- but max(created_at) per swiper wants the second column. swipes is small (about a thousand
-- rows), so the SHARE lock this build takes is held for milliseconds.
create index if not exists swipes_swiper_id_created_at_idx
  on public.swipes (swiper_id, created_at desc);

-- The latest sign of life: heartbeat, onboarding, a swipe they made, a message they sent.
-- greatest() ignores NULLs, so this is NULL only when there is no signal at all. SECURITY
-- DEFINER because swipes and messages are RLS-scoped to their own rows.
create or replace function public.profile_last_seen_at(p_profile_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $fn$
  select greatest(
    p.last_active_at,
    p.onboarding_completed_at,
    (select max(s.created_at) from public.swipes s where s.swiper_id = p.id),
    (select max(m.created_at) from public.messages m where m.sender_id = p.id)
  )
  from public.profiles p
  where p.id = p_profile_id;
$fn$;

revoke execute on function public.profile_last_seen_at(uuid) from public, anon, authenticated;

create or replace function public.is_dormant_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select p.is_demo = false
     and not exists (select 1 from public.push_tokens t where t.profile_id = p.id)
     and coalesce(greatest(public.profile_last_seen_at(p.id), p.created_at), '-infinity'::timestamptz)
           < now() - interval '21 days'
  from public.profiles p
  where p.id = p_profile_id;
$fn$;

revoke execute on function public.is_dormant_profile(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. deck_gate_hard: + not dormant (the mirror of get_deck's new WHERE line)
-- ---------------------------------------------------------------------------
create or replace function public.deck_gate_hard(p_viewer uuid, p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from public.profiles c
    join public.profiles v on v.id = p_viewer
    where c.id = p_candidate
      and c.id <> v.id
      and c.is_active = true
      and c.is_admin_suspended = false
      and c.onboarding_completed = true
      and c.is_banned = false
      and (c.is_demo = false or v.is_demo = true)
      and public.same_age_band(v.id, c.id)
      and not public.is_blocked_pair(v.id, c.id)
      and not exists (
        select 1 from public.swipes s
        where s.swiper_id = v.id and s.target_id = c.id
      )
      -- 0071: no push token and nothing in 21 days. Mirrors get_deck.
      and not public.is_dormant_profile(c.id)
  );
$fn$;

revoke execute on function public.deck_gate_hard(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_deck: dormant out, and the new ORDER BY. Rebuilt from the live definition.
-- ---------------------------------------------------------------------------
create or replace function public.get_deck(p_limit integer default 20)
returns table (
  profile_id uuid,
  display_name text,
  age integer,
  gender public.gender_enum,
  region public.region_enum,
  bio text,
  shared_games_count integer,
  shared_shows_count integer,
  score numeric,
  lol_duo_eligible boolean
)
language plpgsql
security definer
set search_path = public
as $fn$
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
  v_lol_game_id uuid;
  v_my_lol_tier text;
  v_my_lol_division smallint;
  v_my_region_is_na boolean;
  v_my_group text;
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

  -- 0071: the viewer's server group, for the ORDER BY only.
  v_my_group := public.server_group(v_my_region);

  -- 0069: the viewer's own League rank, for the lol_duo_eligible column only. No row leaves
  -- both null, and a null rank makes every pair null (never labeled, never filtered).
  v_lol_game_id := public.lol_game_id();
  v_my_region_is_na := v_my_region in ('na_east', 'na_west');
  select pg.lol_tier, pg.lol_division
    into v_my_lol_tier, v_my_lol_division
    from public.profile_games pg
   where pg.profile_id = v_me and pg.game_id = v_lol_game_id;

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
      p.usual_play_end_hour,
      -- 0071: real activity, not just the heartbeat column.
      public.profile_last_seen_at(p.id) as last_seen
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
      -- 0071: no push token and nothing in 21 days. Mirrored in deck_gate_hard.
      and not public.is_dormant_profile(p.id)
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
    )::numeric as score,
    d.duo
  from candidates c
  left join shared_games sg on sg.profile_id = c.id
  left join shared_shows ss on ss.profile_id = c.id
  left join shared_languages sl on sl.profile_id = c.id
  left join boosted b on b.profile_id = c.id
  left join public.profile_games lol
         on lol.profile_id = c.id and lol.game_id = v_lol_game_id
  cross join lateral (
    select case
      when v_my_region_is_na and c.region in ('na_east', 'na_west')
        then public.lol_solo_duo_eligible(v_my_lol_tier, v_my_lol_division,
                                          lol.lol_tier, lol.lol_division)
    end as duo
  ) d
  -- 0071: the two new ordering facts, computed once per card.
  cross join lateral (
    select
      coalesce(public.server_group(c.region) = v_my_group, false) as same_group,
      exists (
        select 1 from public.swipes lk
        where lk.swiper_id = c.id and lk.target_id = v_me and lk.action = 'like'
      ) as liked_me
  ) k
  order by
    (b.profile_id is not null) desc,
    k.same_group desc,
    (k.liked_me and k.same_group and coalesce(sg.shared_count, 0) > 0) desc,
    (c.last_seen is not null and c.last_seen > now() - interval '14 days') desc,
    (d.duo is true) desc,
    score desc,
    c.last_seen desc nulls last
  limit p_limit;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. get_party_deck: + not dormant. Rebuilt from the live definition (0070's body).
-- ---------------------------------------------------------------------------
create or replace function public.get_party_deck(p_party_id uuid, p_limit integer default 20)
returns table (
  profile_id uuid,
  display_name text,
  age integer,
  gender public.gender_enum,
  region public.region_enum,
  bio text,
  shared_games_count integer,
  shared_shows_count integer,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $fn$
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

  -- PARTY_CAP = 3: a full party has nobody left to find.
  if (select count(*) from public.party_members pm where pm.party_id = p_party_id) >= 3 then
    return;
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
      -- Already invited, in any status: pending (waiting on them), accepted, declined or
      -- expired. Nobody is dealt to the party twice.
      and not exists (
        select 1 from public.party_invites pi
        where pi.party_id = p_party_id and pi.target_id = p.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = p.id and b.blocked_id in (select member_profile_id from party_member_ids))
           or (b.blocked_id = p.id and b.blocker_id in (select member_profile_id from party_member_ids))
      )
      and extract(year from age(current_date, p.dob))::int between 18 and 99
      -- 0071: no push token and nothing in 21 days.
      and not public.is_dormant_profile(p.id)
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
$fn$;
