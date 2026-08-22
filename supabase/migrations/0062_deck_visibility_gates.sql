-- 0062: deck visibility gates, and the pool count that lets an empty deck say why.
--
-- (The plan that specifies this file, docs/superpowers/plans/2026-08-18-low-density-fixes.md,
-- calls it 0061. 0061 was taken by 0061_waitlist.sql, which is applied to the live database,
-- so this file and the two that follow it shift up by one. Nothing else about the plan
-- changes.)
--
-- WHAT THIS IS FOR. The deck's empty state today says "No more profiles right now / Check
-- back later, or adjust your filters to see more people" no matter why it is empty, and at
-- four real users that sentence is usually wrong in one of two specific directions: either
-- there is genuinely nobody, or there are people and the viewer's own filters are hiding
-- them. Those want opposite screens -- one offers a ping when somebody joins, the other
-- offers to clear the filters -- and the only way to tell them apart is to ask the server how
-- many candidates survive with the filters taken away. That is get_deck_pool_size. The two
-- gate functions are how it, and the new-player alert sweep that follows in 0063, ask that
-- question without re-deriving the answer by hand at each call site.
--
-- ============================================================================
-- THE DUPLICATION, STATED UP FRONT BECAUSE IT IS THE COST OF THIS FILE
-- ============================================================================
--
-- deck_gate_hard and deck_gate_preferences MIRROR public.get_deck's candidate predicate.
-- get_deck remains the source of truth. IF YOU CHANGE get_deck's WHERE CLAUSE, CHANGE THESE
-- TWO FUNCTIONS IN THE SAME MIGRATION.
--
-- get_deck is deliberately NOT refactored to call them. 0060's header is an explicit,
-- hard-won warning about editing that function body for anything but a required change: it
-- is the one code path App Review is guaranteed to exercise, and it carries 0059's is_demo
-- gating, 0053's is_admin_suspended check and 0048's rate limit inside it. Rewriting it to
-- call two new SECURITY DEFINER functions would also cost the planner the inlined predicate
-- it gets today, on the live matching path, to remove a duplication that is checkable by
-- reading two files side by side.
--
-- What drift can and cannot do, which is why the trade is acceptable:
--   * NOTHING IN THIS FILE GRANTS VISIBILITY. Neither gate returns a profile, a name or a
--     row; both return a boolean, and the only caller-facing function here returns a bare
--     integer. Drift degrades MESSAGING AND TARGETING -- a count that is slightly off, a new
--     player announced who turns out not to be visible -- never access.
--   * The one safety-critical predicate, the adult/minor age band, is delegated to the
--     existing public.same_age_band() rather than re-derived here, so it cannot drift at all.
--
-- ============================================================================
-- GRANTS
-- ============================================================================
--
-- Supabase's default privileges grant EXECUTE to anon, authenticated AND service_role at
-- function creation, and revoking from PUBLIC does not remove a role's own explicit grant.
-- That is the mistake 0013 made and 0041 had to clean up. So every function below names
-- `public, anon, authenticated` in its revoke and then grants back exactly what it needs.
-- The two gates get nothing back: they are only ever called from inside other SECURITY
-- DEFINER functions, which run as the owner.

-- ---------------------------------------------------------------------------
-- 1. deck_gate_hard -- the half of get_deck's predicate that is not negotiable.
-- ---------------------------------------------------------------------------
--
-- Not self, active, not admin-suspended, onboarding complete, not banned, demo-gated, not
-- already swiped, not blocked either way, same age band. Nothing here is a preference and
-- nothing here can be relaxed by a setting.
--
-- Two of these deserve a note:
--
--   * THE DEMO PREDICATE is 0059's rule with the viewer passed in explicitly instead of read
--     from auth.uid() via is_demo_viewer(). Same meaning -- a demo profile is visible only to
--     another demo profile -- expressed so that a sweep running as the service role, with no
--     JWT at all, gets the right answer for a named recipient. Getting this wrong would
--     re-open exactly the "fake profiles shown to real users" exposure 0059 closed.
--
--   * THE AGE BAND uses same_age_band() rather than get_deck's inline
--     v_effective_min_age/v_effective_max_age arithmetic. That arithmetic is two rules welded
--     together: adults see adults and minors see minors (mandatory), and the viewer's own
--     min/max sliders on top (a preference, floored at 18). Only the first belongs here; the
--     second is in deck_gate_preferences below. same_age_band already encodes the first
--     exactly, and reusing it is what makes this predicate undriftable.
--
-- same_age_band and is_blocked_pair are both revoked from `authenticated` (0031). This
-- function is SECURITY DEFINER, so it calls them as the owner -- the same way get_deck does.
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
  );
$fn$;

revoke execute on function public.deck_gate_hard(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. deck_gate_preferences -- the half that is the viewer's own filters.
-- ---------------------------------------------------------------------------
--
-- LEFT JOIN preferences, not an inner join: get_deck fetches the viewer's preferences with
-- `select ... into`, which leaves every local NULL when there is no row, and every predicate
-- below is written to be inert on NULL. An inner join would instead make a viewer with no
-- preferences row see nobody, which is the opposite of what get_deck does.
--
-- THE PREMIUM FILTERS are guarded by `not v.prem or ...`. get_deck nulls each of those six
-- locals when the viewer is not premium, so a lapsed subscriber's stale filter is already
-- inert server-side; `not v.prem or <filter is null> or <candidate matches>` reproduces that
-- in one expression instead of a second code path.
create or replace function public.deck_gate_preferences(p_viewer uuid, p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from public.profiles c
    left join public.preferences pr on pr.profile_id = p_viewer
    cross join lateral (
      select public.is_premium(p_viewer) as prem, public.is_minor(p_viewer) as minor
    ) v
    where c.id = p_candidate
      -- Age range: a free filter, floored at 18 exactly as get_deck floors it. The band
      -- itself (adults with adults) is deck_gate_hard's job, which is why a minor viewer
      -- short-circuits true here instead of repeating get_deck's 15..17 window.
      and (
        v.minor
        or extract(year from age(current_date, c.dob))::int
             between greatest(coalesce(pr.min_age, 18), 18) and coalesce(pr.max_age, 99)
      )
      and (
        pr.preferred_regions is null or array_length(pr.preferred_regions, 1) is null
        or c.region = any (pr.preferred_regions)
      )
      and (
        pr.required_language is null or exists (
          select 1 from public.profile_languages pl
          where pl.profile_id = c.id and pl.language_code = pr.required_language
        )
      )
      -- Premium-only from here down.
      and (not v.prem or pr.filter_platform is null or exists (
        select 1 from public.profile_platforms pp
        where pp.profile_id = c.id and pp.platform = pr.filter_platform))
      and (not v.prem or pr.filter_game_id is null or exists (
        select 1 from public.profile_games pg
        where pg.profile_id = c.id and pg.game_id = pr.filter_game_id))
      and (not v.prem or pr.filter_skill_level is null or exists (
        select 1 from public.profile_games pg
        where pg.profile_id = c.id and pg.skill_level = pr.filter_skill_level))
      and (not v.prem or pr.filter_playstyle is null or exists (
        select 1 from public.profile_playstyles pps
        where pps.profile_id = c.id and pps.tag = pr.filter_playstyle))
      and (not v.prem or pr.filter_show_id is null or exists (
        select 1 from public.profile_shows psh
        where psh.profile_id = c.id and psh.show_id = pr.filter_show_id))
      and (not v.prem or not coalesce(pr.filter_recently_active, false)
        or (c.last_active_at is not null and c.last_active_at > now() - interval '24 hours'))
  );
$fn$;

revoke execute on function public.deck_gate_preferences(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_deck_pool_size -- how many people the caller could see with no filters.
-- ---------------------------------------------------------------------------
--
-- The client calls this ONLY when the deck has come back empty, and uses it to choose which
-- of two true sentences to show:
--
--   pool > 0  ->  "your filters are hiding everyone", with a button that clears them
--   pool = 0  ->  "you are early", with the offer of a ping when somebody joins
--
-- Note that "nobody exists" and "you have already swiped everyone" both land on pool = 0,
-- and that is correct: for a viewer who has seen every profile there is, "we will tell you
-- when someone new joins" is precisely the right promise.
--
-- VOLATILE, not stable, because check_rate_limit writes a row. Marking it stable would be a
-- lie the planner is entitled to act on.
--
-- The four cheap column predicates are repeated inline ahead of the gate call so that the
-- per-row SECURITY DEFINER call only runs on rows that already look plausible; deck_gate_hard
-- is not inlinable by the planner precisely because it is SECURITY DEFINER.
--
-- The auth and ban checks are get_deck's preamble verbatim, so an unauthenticated or banned
-- caller gets the same error, in the same shape, from either function. The rate limit is
-- 20/minute against get_deck's 40: this is only ever reached on an already-empty deck and it
-- returns a bare count that identifies nobody, but it does scan profiles, and a bare count is
-- still worth not handing out as a free polling loop.
create or replace function public.get_deck_pool_size()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_count integer;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('get_deck_pool_size', 20, interval '1 minute');

  select count(*) into v_count
  from public.profiles c
  where c.id <> v_me
    and c.is_active = true
    and c.is_admin_suspended = false
    and c.onboarding_completed = true
    and c.is_banned = false
    and public.deck_gate_hard(v_me, c.id);

  return v_count;
end;
$fn$;

revoke execute on function public.get_deck_pool_size() from public, anon, authenticated;
grant execute on function public.get_deck_pool_size() to authenticated;
