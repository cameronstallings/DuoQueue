-- 0084: game search works before there is an account, and 10 free active chats instead of 5.
--
-- Two small changes for DuoQueue 1.0.2 (build 19), in one file because both have to be live
-- before that build is released and neither changes a signature, a RETURNS shape or anything
-- the 1.0.1 app in the store reads differently.
--
-- ============================================================================
-- 1. search_games for signed-out players
-- ============================================================================
--
-- WHY. 1.0.2 builds the player's card BEFORE the account exists (the plan's D1: a local draft
-- on the phone, the account is created at "Save your card"). The card's game step searches the
-- catalog through search_games (0078), and 0078 made it raise 'Not authenticated' when
-- auth.uid() is null, so in the 1.0.2 wizard every search would fail until Save.
--
-- WHAT CHANGES. Rebuilt from its LIVE definition (pg_get_functiondef, 15 Oct 2026) with exactly
-- two differences: the `if auth.uid() is null then raise` block is gone, and anon gets EXECUTE
-- beside authenticated. Same signature, same RETURNS TABLE(id, name, is_custom), same STABLE
-- SECURITY DEFINER, same body otherwise.
--
-- WHY THIS DISCLOSES NOTHING NEW. Nothing else in the body reads the caller. It returns only
-- (id, name, is_custom) of public.games rows, and anon can already select every games row
-- directly (policy games_select_all, asserted by the check). The popularity count it sorts by
-- never leaves the function: it is an ORDER BY, not a column. SECURITY DEFINER is still what
-- lets that count see every profile_games row.
--
-- WHAT IT DOES NOT HAVE: a rate limit for anon. check_rate_limit is keyed on auth.uid() and
-- returns at once for anon (the same position 0065 took for resolve_invite_code). The query is
-- bounded (1..80 characters, at most 50 rows, one pass over ~560 games), so a hammering client
-- costs what reading the games table directly already costs.
--
-- 1.0.1 is unaffected: it searches with its own ILIKE on the games table and never calls this.
--
-- ============================================================================
-- 2. The free chat cap: 5 becomes 10
-- ============================================================================
--
-- Cameron's decision 3 of 15 Oct 2026: free active chats go from 5 to 10, and the SQL and the
-- paywall copy change together in this build. The cap lives in exactly three functions, found
-- by searching every live function body (not the migration files) for the literal:
--
--   is_conversation_unlocked(uuid)            send-message's gate, the chat screen     `limit 5`
--   is_conversation_unlocked_for(uuid, uuid)  the server's twin (0073); every push      `limit 5`
--                                             that must not open a locked chat reads it:
--                                             notify_looking_now, match_event_push_recipient,
--                                             get_stale_unread_conversations,
--                                             send_first_message_nudges
--   get_matches_summary()                     Matches' is_locked                         `limit 5`
--
-- Each is rebuilt from its LIVE definition with that one literal changed to 10 (and the
-- subquery alias top5 renamed top10 so it does not lie). Signatures, RETURNS shapes,
-- volatility, SECURITY DEFINER and ACLs are unchanged; the check asserts all of it. The rule
-- itself is unchanged: the N most recently active live matches (matched_at or the last
-- message, whichever is later) are unlocked, premium unlocks all.
--
-- Safe to apply before 1.0.2 ships: the lock is server-driven everywhere (Matches reads
-- is_locked, the chat reads is_locked, send-message asks is_conversation_unlocked), so a 1.0.1
-- phone simply finds chats 6 to 10 unlocked while its paywall still says 5. MUST be live before
-- 1.0.2 is released, because the 1.0.2 paywall says 10 (App Store 3.1.2: the purchase screen
-- has to describe what the free tier really is).
--
-- TO UNDO the cap only: re-run the three definitions with `limit 5` (0073's text for the _for
-- twin, the live text before this file for the other two). Undo search: revoke execute on
-- function public.search_games(text, integer) from anon; (the 1.0.2 wizard then shows its
-- honest "search is not available" line).
--
-- Checks: supabase/checks/0084_signed_out_game_search_and_chat_cap_10.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. search_games: no auth gate, executable by anon
-- ---------------------------------------------------------------------------
create or replace function public.search_games(p_query text, p_limit integer default 25)
returns table(id uuid, name text, is_custom boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_q text;
  v_like text;
  v_compact text;
begin
  -- 0084: no auth.uid() check. The 1.0.2 wizard searches before the account exists, and
  -- nothing below reads the caller. See this file's header.

  v_q := lower(regexp_replace(btrim(coalesce(p_query, '')), '\s+', ' ', 'g'));
  if char_length(v_q) < 1 or char_length(v_q) > 80 then
    return;
  end if;
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 50);

  -- LIKE's default escape character is the backslash.
  v_like := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  v_compact := regexp_replace(v_q, '[^a-z0-9]', '', 'g');

  return query
  with pop as (
    select pg.game_id, count(*) as players
    from public.profile_games pg
    group by pg.game_id
  ),
  scored as (
    select
      g.id,
      g.name,
      g.is_custom,
      lower(g.name) as lname,
      case when g.is_custom then '{}'::text[] else g.aliases end as al
    from public.games g
  ),
  ranked as (
    select
      s.id,
      s.name,
      s.is_custom,
      case
        when s.lname = v_q or v_q = any (s.al) then 0
        when s.lname like v_like || '%'
          or exists (select 1 from unnest(s.al) a where a like v_like || '%') then 1
        when (' ' || regexp_replace(s.lname, '[^a-z0-9]+', ' ', 'g')) like '% ' || v_like || '%' then 2
        when s.lname like '%' || v_like || '%' then 3
        when char_length(v_compact) >= 2
          and regexp_replace(s.lname, '[^a-z0-9]', '', 'g') like '%' || v_compact || '%' then 3
        else null
      end as match_rank
    from scored s
  )
  select r.id, r.name, r.is_custom
  from ranked r
  left join pop on pop.game_id = r.id
  where r.match_rank is not null
  order by r.match_rank, r.is_custom, coalesce(pop.players, 0) desc, r.name
  limit p_limit;
end;
$function$;

-- The live ACL was postgres, service_role, authenticated (no PUBLIC). create or replace keeps
-- it; this adds anon and nothing else.
grant execute on function public.search_games(text, integer) to anon;

-- ---------------------------------------------------------------------------
-- 2a. is_conversation_unlocked: limit 5 -> limit 10
-- ---------------------------------------------------------------------------
create or replace function public.is_conversation_unlocked(p_match_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_premium(v_me) then
    return true;
  end if;

  -- The free cap: the 10 most recently active live matches (0084; it was 5). Twins:
  -- is_conversation_unlocked_for and get_matches_summary. Change all three together.
  return exists (
    select 1
    from (
      select
        m.id,
        greatest(m.matched_at, coalesce(lm.last_message_at, m.matched_at)) as activity
      from public.matches m
      left join (
        select match_id, max(created_at) as last_message_at
        from public.messages
        group by match_id
      ) lm on lm.match_id = m.id
      where (m.user_a_id = v_me or m.user_b_id = v_me)
        and m.unmatched_at is null
      order by activity desc
      limit 10
    ) top10
    where top10.id = p_match_id
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2b. is_conversation_unlocked_for: limit 5 -> limit 10
-- ---------------------------------------------------------------------------
create or replace function public.is_conversation_unlocked_for(p_profile_id uuid, p_match_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  -- The free cap, 10 since 0084 (it was 5). Twins: is_conversation_unlocked and
  -- get_matches_summary. Change all three together.
  select public.is_premium(p_profile_id)
      or exists (
        select 1
        from (
          select
            m.id,
            greatest(m.matched_at, coalesce(lm.last_message_at, m.matched_at)) as activity
          from public.matches m
          left join lateral (
            select max(msg.created_at) as last_message_at
            from public.messages msg
            where msg.match_id = m.id
          ) lm on true
          where (m.user_a_id = p_profile_id or m.user_b_id = p_profile_id)
            and m.unmatched_at is null
          order by activity desc
          limit 10
        ) top10
        where top10.id = p_match_id
      );
$function$;

-- ---------------------------------------------------------------------------
-- 2c. get_matches_summary: limit 5 -> limit 10
-- ---------------------------------------------------------------------------
create or replace function public.get_matches_summary()
returns table(match_id uuid, other_profile_id uuid, other_display_name text, other_photo_path text, last_message text, last_message_at timestamp with time zone, last_message_sender_id uuid, unread_count integer, is_locked boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_is_premium boolean;
  v_viewer_is_demo boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  v_is_premium := public.is_premium(v_me);
  v_viewer_is_demo := public.is_demo_viewer();

  return query
  with my_matches as (
    select
      m.id,
      case when m.user_a_id = v_me then m.user_b_id else m.user_a_id end as other_id,
      m.matched_at
    from public.matches m
    where (m.user_a_id = v_me or m.user_b_id = v_me) and m.unmatched_at is null
  ),
  last_msgs as (
    select distinct on (msg.match_id) msg.match_id, msg.content, msg.created_at, msg.sender_id
    from public.messages msg
    where msg.match_id in (select id from my_matches)
    order by msg.match_id, msg.created_at desc
  ),
  unread as (
    select msg.match_id, count(*) as cnt
    from public.messages msg
    where msg.match_id in (select id from my_matches)
      and msg.sender_id <> v_me
      and msg.read_at is null
    group by msg.match_id
  ),
  ranked as (
    select
      mm.id,
      greatest(mm.matched_at, coalesce(lm.created_at, mm.matched_at)) as activity
    from my_matches mm
    left join last_msgs lm on lm.match_id = mm.id
  ),
  -- The free cap, 10 since 0084 (it was 5). Twins: is_conversation_unlocked and
  -- is_conversation_unlocked_for. Change all three together.
  unlocked_ids as (
    select id from ranked order by activity desc limit 10
  )
  select
    mm.id,
    mm.other_id,
    p.display_name,
    (
      select pmedia.storage_path from public.profile_media pmedia
      where pmedia.profile_id = mm.other_id
        and pmedia.moderation_status = 'approved'
        and pmedia.photo_role = 'profile'
    ),
    lm.content,
    lm.created_at,
    lm.sender_id,
    coalesce(u.cnt, 0)::int,
    not (v_is_premium or mm.id in (select id from unlocked_ids))
  from my_matches mm
  join public.profiles p on p.id = mm.other_id
  left join last_msgs lm on lm.match_id = mm.id
  left join unread u on u.match_id = mm.id
  where (p.is_demo = false or v_viewer_is_demo)
  order by greatest(mm.matched_at, coalesce(lm.created_at, mm.matched_at)) desc;
end;
$function$;
