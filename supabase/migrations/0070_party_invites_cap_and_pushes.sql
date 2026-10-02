-- 0070: parties stop at three, invites expire, one party per duo, and party pushes exist.
--
-- "Invite a third" shipped as a loop with no end and no voice. Read off the live cluster on
-- 2026-10-02 before this was written: one party had grown to FOUR members with a fifth
-- invite still pending, nothing had ever told anybody that an invite or a party message
-- existed, and two people in the same match could each tap the button and end up in two
-- different parties. Every function below is rebuilt from its LIVE definition
-- (pg_get_functiondef on 2026-10-02), not from the older migration files, so the bans, rate
-- limits, block and age-group checks and the demo visibility gate added by 0048, 0053 and
-- 0059 all carry over unchanged. Every signature and RETURNS shape is identical, because the
-- App Store build calls these and cannot be patched.
--
-- ============================================================================
-- THE RULES, AND WHERE EACH ONE IS ENFORCED
-- ============================================================================
--
-- PARTY_CAP = 3 members. INVITE_TTL = 7 days. Both are literals in the functions below
-- (search this file for "PARTY_CAP" and "INVITE_TTL"), kept as literals rather than helper
-- functions so each rule reads in place and adds no new callable surface.
--
-- 1. create_party: ONE PARTY PER DUO, WHOEVER TAPS. 0044 reused a party only when the CALLER
--    had created it, so A tapping and then B tapping produced two parties with the same two
--    people, each with its own swipes and its own chat. It now reuses any party whose
--    current membership is exactly the two of them (count = 2), whoever created it. The
--    lookup and the insert are serialized per unordered pair with pg_advisory_xact_lock, so
--    two simultaneous taps cannot both miss the lookup and both insert. Only a brand-new
--    party sends the party_started push to the partner; a reused one is silent.
--
-- 2. perform_party_swipe: AN INVITE ONLY WHILE THERE IS ROOM, AND invited MEANS SENT. The old
--    code invited whenever every member had liked the target, at any size, and returned
--    invited = true even when ON CONFLICT DO NOTHING had inserted nothing, so a second like
--    on the same person told the app "Everyone said yes!" again. Now an invite is created only
--    when 2 <= members < PARTY_CAP and the target has no invite row in this party in ANY
--    status (a declined or expired person is not re-asked by re-swiping), and invited is true
--    only when a row was actually inserted. The swipe itself is recorded exactly as before.
--    The like path takes a row lock on the party (FOR NO KEY UPDATE, which does not block
--    the foreign-key KEY SHARE locks that message and swipe inserts take), so two members
--    liking the same person at the same moment cannot each count the other's like as
--    missing and both skip the invite, and the member count cannot move under the check.
--
-- 3. respond_party_invite: ACCEPT REFUSES WHAT IT CANNOT HONOUR. Accepting an invite older
--    than INVITE_TTL, or into a party that already has PARTY_CAP members, now raises a
--    sentence a person can read (the next app build shows these; the store build, which
--    predates them, shows its own generic error, and the refused invite then drops out of its
--    banner on the refetch):
--      'This party invite expired. Invites last 7 days.'   (detail: party_invite_expired)
--      'This party is already full. Parties hold 3 players.' (detail: party_full)
--    A successful accept adds the member, marks the invite accepted, then declines every
--    OTHER pending invite of that party: with a cap of three, the party is full the moment
--    the third person joins, and those invites can never be honoured. The accept path takes
--    the same party row lock as the like path, so two people accepting at once serialize and
--    the second is told the party is full. Decline is unchanged.
--
--    WHY THE REFUSED INVITE IS NOT MARKED DECLINED BY THE REFUSAL ITSELF. A raise aborts the
--    RPC's transaction (PostgREST runs each call in one, see 0066), so an UPDATE made just
--    before the raise is rolled back with it, and a void function has no other way to tell
--    the store build "no". The decline is made durable elsewhere instead: get_my_party_invites
--    stops returning both kinds immediately (the store build already refetches invites on a
--    respond error), the accept path declines a party's other invites the moment it fills,
--    and the daily sweep in section 6 declines whatever is left. So a refused invite vanishes
--    from the banner at once and is declined in storage within a day.
--
-- 4. get_party_deck: no one with an invite row in this party, in any status, and no
--    candidates at all once the party is full. Before, an invited person stayed in the deck
--    of every member who had not swiped them, and a full party kept dealing cards.
--
-- 5. get_my_party_invites: no invite older than INVITE_TTL and none into a full party.
--
-- 6. A DAILY SWEEP. decline_stale_party_invites() declines pending invites older than
--    INVITE_TTL, and, as a backstop for section 3, pending invites into parties that already
--    have PARTY_CAP members. pg_cron runs it at 09:25 UTC. Read off cron.job on 2026-10-02:
--    :00 daily-swipes-refreshed-hourly, :00/:30 reengagement-nudges-half-hourly, :15
--    rate_limit_hits_cleanup_hourly, :20 new-player-alerts-hourly, :40 */6
--    verified-stats-sync-six-hourly, :45 waitlist_attempts_cleanup_hourly. :25 is free. The
--    schedule is idempotent (unschedule if it exists, then schedule), so re-running this
--    file cannot create a second job. Kill switch: select cron.unschedule('party-invites-expire-daily');
--
-- 7. ONE-OFF DATA FIX. The sweep runs once, right after it is created and before the push
--    triggers exist. On 2026-10-02 that declines the one pending invite sitting in the
--    four-member party, and nothing else (no pending invite was older than 7 days). The four members are left alone: removing
--    someone from a chat they are already in is not a data fix, and the cap stops it growing.
--
-- ============================================================================
-- THE PUSHES
-- ============================================================================
--
-- Same path as every other push: a trigger calls notify_via_edge_function (which swallows
-- its own errors, so a delivery problem never fails the write) and that POSTs to
-- send-push-notification. pg_net only sends what COMMITS: http_post inserts into
-- net.http_request_queue and the worker cannot see an uncommitted row, so a rolled-back
-- transaction (the check script, a dry run) sends nothing. All ids are UUIDs.
--
--   party_invite   AFTER INSERT ON party_invites            { type, partyId, inviteId, targetId }
--   party_joined   AFTER UPDATE OF status, pending->accepted { type, partyId, joinerId }
--   party_message  AFTER INSERT ON party_messages           { type, partyId, messageId, senderId }
--   party_started  inside create_party, new-party branch only { type, partyId, creatorId, partnerId }
--
-- There is no party_members trigger on purpose: create_party inserts two member rows, and
-- only one push (to the partner) is wanted. The edge function picks the recipients and the
-- copy. A deployed edge function that predates these types answers 400 "Invalid payload"
-- and sends nothing, so applying this before that deploy is harmless, only quiet.
--
-- Checks: supabase/checks/0070_party_invites_cap_and_pushes.sql (rolled back, proves each
-- rule above as real member accounts).

-- ---------------------------------------------------------------------------
-- 1. create_party
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

  -- Both members tapping at once must land in the same party: serialize the lookup and the
  -- insert on the unordered pair, so whichever call is second sees the first one's party.
  perform pg_advisory_xact_lock(
    hashtextextended('create_party:' || least(v_me, v_other)::text || ':' || greatest(v_me, v_other)::text, 0)
  );

  -- Any party whose current membership is exactly these two, whoever created it.
  select pa.id into v_party_id
  from public.parties pa
  where exists (
      select 1 from public.party_members pm
      where pm.party_id = pa.id and pm.profile_id = v_me
    )
    and exists (
      select 1 from public.party_members pm
      where pm.party_id = pa.id and pm.profile_id = v_other
    )
    and (select count(*) from public.party_members pm where pm.party_id = pa.id) = 2
  order by pa.created_at desc
  limit 1;

  if v_party_id is not null then
    return v_party_id;
  end if;

  insert into public.parties (created_by) values (v_me) returning id into v_party_id;
  insert into public.party_members (party_id, profile_id) values (v_party_id, v_me), (v_party_id, v_other);

  perform public.notify_via_edge_function(
    jsonb_build_object('type', 'party_started', 'partyId', v_party_id, 'creatorId', v_me, 'partnerId', v_other)
  );

  return v_party_id;
end;
$$;

revoke execute on function public.create_party(uuid) from public, anon;
grant execute on function public.create_party(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. perform_party_swipe
-- ---------------------------------------------------------------------------
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
  v_inserted int;
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

  -- Serialize likes (and accepts, which take the same lock) per party, so the like count
  -- and the member count below are read after any concurrent like or join has committed.
  if p_action = 'like' then
    perform 1 from public.parties pa where pa.id = p_party_id for no key update;
  end if;

  insert into public.party_swipes (party_id, member_id, target_id, action)
  values (p_party_id, v_me, p_target_id, p_action)
  on conflict (party_id, member_id, target_id) do update set action = excluded.action, created_at = now();

  invited := false;

  if p_action = 'like' then
    select count(*) into v_member_count from public.party_members pm where pm.party_id = p_party_id;
    select count(*) into v_like_count
    from public.party_swipes ps
    where ps.party_id = p_party_id and ps.target_id = p_target_id and ps.action = 'like'
      and ps.member_id in (select pm.profile_id from public.party_members pm where pm.party_id = p_party_id);

    -- PARTY_CAP = 3: an invite only while there is room for one more, never to someone
    -- already in the party, and never twice to the same person (any status).
    if v_member_count >= 2 and v_member_count < 3
       and v_like_count >= v_member_count
       and not public.is_party_member(p_party_id, p_target_id)
       and not exists (
         select 1 from public.party_invites pi
         where pi.party_id = p_party_id and pi.target_id = p_target_id
       )
    then
      insert into public.party_invites (party_id, target_id) values (p_party_id, p_target_id)
      on conflict (party_id, target_id) do nothing;
      get diagnostics v_inserted = row_count;
      invited := v_inserted > 0;
    end if;
  end if;

  return next;
end;
$$;

revoke execute on function public.perform_party_swipe(uuid, uuid, swipe_action_enum) from public, anon;
grant execute on function public.perform_party_swipe(uuid, uuid, swipe_action_enum) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. respond_party_invite
-- ---------------------------------------------------------------------------
create or replace function public.respond_party_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_party_id uuid;
  v_status party_invite_status_enum;
  v_created_at timestamptz;
  v_member_count int;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('respond_party_invite', 20, interval '1 hour');

  if not p_accept then
    -- Decline: unchanged.
    select party_id into v_party_id
    from public.party_invites
    where id = p_invite_id and target_id = v_me and status = 'pending';

    if v_party_id is null then
      raise exception 'No pending invite';
    end if;

    update public.party_invites set status = 'declined' where id = p_invite_id;
    return;
  end if;

  select pi.party_id into v_party_id
  from public.party_invites pi
  where pi.id = p_invite_id and pi.target_id = v_me;

  if v_party_id is null then
    raise exception 'No pending invite';
  end if;

  -- Same lock as perform_party_swipe's like path: two accepts into one party serialize, and
  -- the second reads the first one's member row and declined invites.
  perform 1 from public.parties pa where pa.id = v_party_id for no key update;

  select pi.status, pi.created_at into v_status, v_created_at
  from public.party_invites pi
  where pi.id = p_invite_id
  for update;

  select count(*) into v_member_count from public.party_members pm where pm.party_id = v_party_id;

  if v_status is distinct from 'pending' then
    -- A stale card whose invite was closed because someone else filled the last seat.
    if v_member_count >= 3 and not public.is_party_member(v_party_id, v_me) then
      raise exception 'This party is already full. Parties hold 3 players.'
        using detail = 'party_full';
    end if;
    raise exception 'No pending invite';
  end if;

  -- INVITE_TTL = 7 days.
  if v_created_at <= now() - interval '7 days' then
    raise exception 'This party invite expired. Invites last 7 days.'
      using detail = 'party_invite_expired';
  end if;

  -- PARTY_CAP = 3.
  if v_member_count >= 3 then
    raise exception 'This party is already full. Parties hold 3 players.'
      using detail = 'party_full';
  end if;

  insert into public.party_members (party_id, profile_id) values (v_party_id, v_me)
  on conflict do nothing;
  update public.party_invites set status = 'accepted' where id = p_invite_id;

  -- The party is full now: no other invite into it can be honoured.
  update public.party_invites
     set status = 'declined'
   where party_id = v_party_id and id <> p_invite_id and status = 'pending';
end;
$$;

revoke execute on function public.respond_party_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_party_invite(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_party_deck
-- ---------------------------------------------------------------------------
create or replace function public.get_party_deck(p_party_id uuid, p_limit integer default 20)
returns table (
  profile_id uuid,
  display_name text,
  age integer,
  gender gender_enum,
  region region_enum,
  bio text,
  shared_games_count integer,
  shared_shows_count integer,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $$
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

revoke execute on function public.get_party_deck(uuid, integer) from public, anon;
grant execute on function public.get_party_deck(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_my_party_invites
-- ---------------------------------------------------------------------------
create or replace function public.get_my_party_invites()
returns table (invite_id uuid, party_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select pi.id, pi.party_id, pi.created_at
  from public.party_invites pi
  where pi.target_id = auth.uid()
    and pi.status = 'pending'
    -- INVITE_TTL = 7 days.
    and pi.created_at > now() - interval '7 days'
    -- PARTY_CAP = 3.
    and (select count(*) from public.party_members pm where pm.party_id = pi.party_id) < 3;
$$;

revoke execute on function public.get_my_party_invites() from public, anon;
grant execute on function public.get_my_party_invites() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The sweep and its daily schedule
-- ---------------------------------------------------------------------------
create or replace function public.decline_stale_party_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_declined int;
begin
  update public.party_invites pi
     set status = 'declined'
   where pi.status = 'pending'
     and (
       -- INVITE_TTL = 7 days.
       pi.created_at <= now() - interval '7 days'
       -- PARTY_CAP = 3.
       or (select count(*) from public.party_members pm where pm.party_id = pi.party_id) >= 3
     );
  get diagnostics v_declined = row_count;
  return v_declined;
end;
$$;

revoke execute on function public.decline_stale_party_invites() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'party-invites-expire-daily') then
    perform cron.unschedule('party-invites-expire-daily');
  end if;
end;
$$;

select cron.schedule(
  'party-invites-expire-daily',
  '25 9 * * *',
  $$select public.decline_stale_party_invites()$$
);

-- ---------------------------------------------------------------------------
-- 7. One-off: decline pending invites into parties that are already full (and any already
--    past INVITE_TTL). Runs before the triggers exist, and a decline never pushes anyway.
-- ---------------------------------------------------------------------------
select public.decline_stale_party_invites();

-- ---------------------------------------------------------------------------
-- 8. Push triggers
-- ---------------------------------------------------------------------------
create or replace function public.notify_party_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_via_edge_function(
    jsonb_build_object('type', 'party_invite', 'partyId', new.party_id, 'inviteId', new.id, 'targetId', new.target_id)
  );
  return new;
end;
$$;

create or replace function public.notify_party_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_via_edge_function(
    jsonb_build_object('type', 'party_joined', 'partyId', new.party_id, 'joinerId', new.target_id)
  );
  return new;
end;
$$;

create or replace function public.notify_party_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_via_edge_function(
    jsonb_build_object('type', 'party_message', 'partyId', new.party_id, 'messageId', new.id, 'senderId', new.sender_id)
  );
  return new;
end;
$$;

revoke execute on function public.notify_party_invite() from public, anon, authenticated;
revoke execute on function public.notify_party_joined() from public, anon, authenticated;
revoke execute on function public.notify_party_message() from public, anon, authenticated;

drop trigger if exists on_party_invite_created on public.party_invites;
create trigger on_party_invite_created
  after insert on public.party_invites
  for each row
  when (new.status = 'pending')
  execute function public.notify_party_invite();

drop trigger if exists on_party_invite_accepted on public.party_invites;
create trigger on_party_invite_accepted
  after update of status on public.party_invites
  for each row
  when (old.status = 'pending' and new.status = 'accepted')
  execute function public.notify_party_joined();

drop trigger if exists on_party_message_created on public.party_messages;
create trigger on_party_message_created
  after insert on public.party_messages
  for each row
  execute function public.notify_party_message();
