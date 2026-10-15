-- 0073: the other player hears about it when you propose a time or share your Discord, and a
-- Discord share can no longer be an empty card.
--
-- WHY. propose_session (0023) inserts a match_sessions row and nothing else, and a Discord share
-- inserts a discord_shares row and nothing else. Neither writes a message, so the Matches list
-- shows nothing new, and send-push-notification has no event for either. The recipient learns
-- about a proposal or a share only if they happen to open that exact chat. Read live on
-- 2026-10-14: the only proposal made since 2 Oct (5 Oct, for 10 Oct 19:00) is still pending,
-- sent to a player who never opened that chat again. 0 sessions have ever been confirmed.
--
-- And "Share my Discord" works for players who never entered a Discord name (the onboarding
-- step is optional; 12 of the 24 players onboarded since launch have none). The share card then
-- reads "No longer available" on both sides. Nobody has hit it yet (0 shares ever), so this is
-- latent, and this file closes it for every installed build at once.
--
-- ============================================================================
-- 1. THE PUSHES
-- ============================================================================
--
-- AFTER INSERT triggers call notify_via_edge_function, the path every push in this schema
-- takes. notify_via_edge_function swallows its own errors, and each trigger body below is
-- wrapped in its own exception block as well, so a delivery problem or a bug here never fails
-- the proposal or the share.
--
--   session_proposed  AFTER INSERT ON match_sessions, status 'pending' only
--                     { "type": "session_proposed", "matchId", "sessionId", "proposerId", "recipientId" }
--   discord_shared    AFTER INSERT ON discord_shares, revoked = false only
--                     { "type": "discord_shared", "matchId", "shareId", "sharerId", "recipientId" }
--
-- A push goes out only when ALL of these hold, checked in SQL at insert time:
--   * the match is live: matches.unmatched_at IS NULL. A block DOES set unmatched_at
--     (handle_new_block, verified live 2026-10-14) and unmatch revokes Discord shares
--     (handle_match_unmatched), so unmatched_at alone would do; is_blocked_pair is checked as
--     well, either way round, so this never depends on that trigger staying as it is;
--   * the actor is one of the two players and the recipient is the other;
--   * the recipient is not banned;
--   * the recipient's chat is UNLOCKED for them (is_conversation_unlocked_for below). A free
--     player's 5 most recently active matches are unlocked; a push into a locked chat lands on
--     send-message's conversation_locked 403 and a "Locked" chip;
--   * a proposal's time is still in the future;
--   * no session or Discord push for this match has gone to this recipient in the last hour
--     (match_event_pushes, a claim taken in the same transaction as the push request). It
--     stops a propose, cancel, propose loop from becoming a push loop.
--
-- QUIET HOURS: NONE HERE, decided on the night of 14-15 Oct 2026 while Cameron was offline, and
-- put to him for review the next morning. These are one-to-one actions by a match inside a
-- conversation, the same class as a new message, which has never had quiet hours: a match who
-- proposes "play at 1:30?" at 1 am is useless at 10 am, and League players queue late. His
-- 01:00-09:59 rule (15 Oct) was asked for about Duo Pops from strangers; 0072 applies it to the
-- like alert and 0074 to "Free to duo", both of which reach people who have not talked yet.
-- If he wants these held overnight too, the two ways to do it:
--   * add `and public.local_hour_within(o.timezone, 10, 0)` to match_event_push_recipient: the
--     push is DROPPED, not deferred (the card still waits in the chat), and the hour's claim is
--     not taken, so a re-proposal after 10:00 pushes normally; or
--   * keep sending, but silently (sound off) between 01:00 and 09:59 local, decided in the edge
--     function from the recipient's profiles.timezone.
-- A deferred send (hold it until 10:00) would need its own queue and sweep, like 0072's.
--
-- THE EDGE FUNCTION CONTRACT. send-push-notification learns two event types:
--   setting column  new_message      (the switch that already covers "a match sent you something")
--   data.category   "new_message"    plus data.matchId. The shipped 1.0.1 client routes
--                                    new_message + matchId to that chat (notificationRouting.ts
--                                    destinationOf). What it then SHOWS differs by event:
--
--     discord_shared    shows. An open chat re-reads itself on any new_message push and on
--                       resume (useChatMessages catchUp), and that re-read covers discord_shares.
--     session_proposed  shows when the chat was NOT already open (the usual case: the one
--                       proposal so far went to a player who never reopened that chat): the tap
--                       mounts the chat and its banner query reads the proposal fresh. It does
--                       NOT show when the recipient left the app inside that very chat. The tap
--                       then routes "already-open" and does nothing (useNotificationTapRouting),
--                       catchUp re-reads messages and discord_shares only, and the banner's own
--                       query (useActiveMatchSession, ["match-sessions", matchId]) is refetched by
--                       nothing but the player's own propose/respond/cancel, so the push says
--                       "Tap to confirm" over a chat with no Confirm button until they leave the
--                       chat and come back.
--
--   THE CLIENT HALF, for the 1.0.1 OTA (apps/mobile, a bug fix): invalidate
--   ["match-sessions", matchId] wherever the chat catches up (the new_message push listener and
--   the resume hook in useChatMessages) and on the tap's "already-open" path. Until it lands,
--   the trigger stays on: the closed-chat case is the one that matters (0 sessions have ever been
--   confirmed, and the one pending proposal sat in a chat its recipient never opened again), and
--   in the open-chat case the push is a nudge to a banner one back-and-forth away, not a lie.
--   sound           yes (a real person)
--   copy            session_proposed: "{name} wants to play {Sat 7pm}" / "Tap to confirm or pick another time."
--                     {Sat 7pm} = match_sessions.scheduled_at in the RECIPIENT's profiles.timezone
--                     (fall back to America/New_York, as the SQL does everywhere else).
--                   discord_shared:   "{name} shared their Discord" / "Copy it from the chat."
--   re-check        before sending, re-read the row: the session still exists, is still
--                   'pending', and belongs to that match and proposer; the share still exists,
--                   revoked = false, and belongs to that match and sharer. Drop quietly if not.
-- A deployed function that predates these types answers 400 and sends nothing (the hour's
-- claim is spent, which is harmless), so applying this before that deploy is quiet, not wrong.
--
-- ============================================================================
-- 2. A DISCORD SHARE NEEDS A DISCORD NAME
-- ============================================================================
--
-- A BEFORE INSERT trigger refuses a share from a profile whose discord_username is empty:
--   raise 'discord_username_missing', hint 'Add your Discord username first, then share it.'
-- P0001 with a hint is the convention the app's toUserMessage reads. The trade-off, accepted
-- by the planning critique: on 1.0.1 the tap becomes a silent no-op (its discordShare.mutate()
-- has no onError), instead of a card that reads "No longer available". The OTA hides the menu
-- item when there is no Discord name, and 1.0.2 adds a place to enter one.
--
-- ============================================================================
-- GRANTS
-- ============================================================================
--
-- Every function here is revoked from public, anon and authenticated (Supabase's default
-- privileges grant EXECUTE to all three at creation). Trigger functions are checked for
-- EXECUTE at CREATE TRIGGER time, not at fire time, so the revoke stops direct calls only.
-- match_event_pushes is server-only, with service_role granted explicitly (30 Oct rule).
--
-- Checks: supabase/checks/0073_play_together_pushes.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. is_conversation_unlocked_for: is_conversation_unlocked (0034) with the profile passed in.
-- ---------------------------------------------------------------------------
--
-- The live is_conversation_unlocked reads auth.uid(), so a trigger or a sweep running for
-- somebody else cannot use it. Same rule, same limit of 5: premium is always unlocked; a free
-- player's five most recently active live matches (activity = the later of matched_at and the
-- newest message) are unlocked. If the cap ever changes, change both functions and
-- get_matches_summary together.
create or replace function public.is_conversation_unlocked_for(p_profile_id uuid, p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
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
          limit 5
        ) top5
        where top5.id = p_match_id
      );
$fn$;

revoke execute on function public.is_conversation_unlocked_for(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. A share needs a Discord name.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_discord_share_has_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.shared_by
      and nullif(btrim(p.discord_username), '') is not null
  ) then
    raise exception 'discord_username_missing'
      using hint = 'Add your Discord username first, then share it.';
  end if;
  return new;
end;
$fn$;

revoke execute on function public.enforce_discord_share_has_username() from public, anon, authenticated;

drop trigger if exists enforce_discord_share_has_username_trigger on public.discord_shares;
create trigger enforce_discord_share_has_username_trigger
  before insert on public.discord_shares
  for each row execute function public.enforce_discord_share_has_username();

-- ---------------------------------------------------------------------------
-- 3. The once-an-hour claim, per match and recipient.
-- ---------------------------------------------------------------------------
--
-- Per recipient, not per match: A proposing a time must not use up the hour in which B's
-- Discord share reaches A. Both ids cascade (App Store 5.1.1(v): deleting an account deletes
-- its matches and its profile, and with them these rows).
create table if not exists public.match_event_pushes (
  match_id     uuid not null references public.matches (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  last_sent_at timestamptz not null default now(),
  primary key (match_id, recipient_id)
);

alter table public.match_event_pushes enable row level security;
revoke all on public.match_event_pushes from public, anon, authenticated;
grant select, insert, update, delete on public.match_event_pushes to service_role;

-- True when this call took the hour. One statement, so two inserts racing for the same pair
-- cannot both win: the loser's ON CONFLICT ... WHERE finds a fresh last_sent_at and updates
-- nothing.
create or replace function public.claim_match_event_push(p_match_id uuid, p_recipient uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_claimed boolean := false;
begin
  insert into public.match_event_pushes as mep (match_id, recipient_id, last_sent_at)
  values (p_match_id, p_recipient, now())
  on conflict (match_id, recipient_id) do update
    set last_sent_at = excluded.last_sent_at
    where mep.last_sent_at <= now() - interval '1 hour'
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$fn$;

revoke execute on function public.claim_match_event_push(uuid, uuid) from public, anon, authenticated;

-- The other player, when a push about this match may go to them right now; otherwise NULL.
create or replace function public.match_event_push_recipient(p_match_id uuid, p_actor uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select o.id
  from public.matches m
  join public.profiles o
    on o.id = case when m.user_a_id = p_actor then m.user_b_id else m.user_a_id end
  where m.id = p_match_id
    and p_actor in (m.user_a_id, m.user_b_id)
    and m.unmatched_at is null
    and not public.is_blocked_pair(m.user_a_id, m.user_b_id)
    and o.is_banned = false
    and public.is_conversation_unlocked_for(o.id, m.id);
$fn$;

revoke execute on function public.match_event_push_recipient(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. session_proposed
-- ---------------------------------------------------------------------------
create or replace function public.notify_session_proposed()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_recipient uuid;
begin
  begin
    if new.status <> 'pending' or new.scheduled_at <= now() then
      return null;
    end if;
    v_recipient := public.match_event_push_recipient(new.match_id, new.proposed_by);
    if v_recipient is null or not public.claim_match_event_push(new.match_id, v_recipient) then
      return null;
    end if;
    perform public.notify_via_edge_function(
      jsonb_build_object(
        'type', 'session_proposed',
        'matchId', new.match_id,
        'sessionId', new.id,
        'proposerId', new.proposed_by,
        'recipientId', v_recipient
      )
    );
  exception
    when others then
      raise warning 'notify_session_proposed failed: %', sqlerrm;
  end;
  return null;
end;
$fn$;

revoke execute on function public.notify_session_proposed() from public, anon, authenticated;

drop trigger if exists on_match_session_proposed on public.match_sessions;
create trigger on_match_session_proposed
  after insert on public.match_sessions
  for each row
  when (new.status = 'pending')
  execute function public.notify_session_proposed();

-- ---------------------------------------------------------------------------
-- 5. discord_shared
-- ---------------------------------------------------------------------------
create or replace function public.notify_discord_shared()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_recipient uuid;
begin
  begin
    if new.revoked then
      return null;
    end if;
    v_recipient := public.match_event_push_recipient(new.match_id, new.shared_by);
    if v_recipient is null or not public.claim_match_event_push(new.match_id, v_recipient) then
      return null;
    end if;
    perform public.notify_via_edge_function(
      jsonb_build_object(
        'type', 'discord_shared',
        'matchId', new.match_id,
        'shareId', new.id,
        'sharerId', new.shared_by,
        'recipientId', v_recipient
      )
    );
  exception
    when others then
      raise warning 'notify_discord_shared failed: %', sqlerrm;
  end;
  return null;
end;
$fn$;

revoke execute on function public.notify_discord_shared() from public, anon, authenticated;

drop trigger if exists on_discord_shared on public.discord_shares;
create trigger on_discord_shared
  after insert on public.discord_shares
  for each row
  when (new.revoked = false)
  execute function public.notify_discord_shared();
