-- 0072: "Someone wants to duo with you". A liked player finds out, and the new-player alert
-- stops pointing across servers.
--
-- WHY. A like writes a swipes row and nothing else: no trigger on swipes has ever existed, so
-- the only way to learn about a like was the small "Requests (n)" link in the deck header, or
-- reaching the liker's card by chance. Every one of the 86 unanswered likes since launch went
-- to someone who never came back after it. When a liked player DOES come back they like back
-- about 70% of the time (28 of 40), mostly NA pairs who share a game.
--
-- Cameron's decisions (15 Oct 2026) that bind this file:
--
--   * YES to the like alert, FUTURE LIKES ONLY. Nothing here reads a swipe made before the
--     trigger in 0083 exists; there is no backfill.
--   * Gated on the SAME SERVER GROUP (0071's server_group: NA East + NA West are one) and A
--     SHARED GAME. The audit's verifier found that 13 of the 15 reachable pending likes
--     crossed regions and 14 shared no game: an alert for those points at a player the
--     recipient cannot queue with.
--   * Its OWN switch, notification_settings.new_like, default true. Not the new_player switch,
--     whose label ("When someone who plays your games joins") does not describe it.
--   * INSIDE THE SHARED ONE-A-DAY BUDGET: one person-push a day, counting like alerts and
--     new-player alerts together (person_push_sent_recently below). Both batches use it.
--   * QUIET HOURS: an event-driven push about a real person is never sent between 01:00 and
--     09:59 in the recipient's local time. The like alert is that push. A like that lands in
--     quiet hours, or while the day's budget is spent, waits in the ledger, and the hourly
--     sweep (scheduled in 0083) delivers it inside the batch window, 10:00 to 21:00 local.
--
-- ============================================================================
-- THE SHAPE: A TRIGGER CLAIMS, AND SENDS AT ONCE WHEN IT MAY. A SWEEP SENDS THE REST.
-- ============================================================================
--
-- 0063 rejected a trigger fan-out for new-player alerts because that fan-out was bounded by
-- "everyone who plays Valorant". This one is bounded by exactly one recipient, the person
-- liked, so the trigger is the right place to claim. What the trigger may not do is fail the
-- swipe: perform_swipe is the most important write in the app. So the trigger body (in 0083)
-- runs inside its own exception block and only ever raises a WARNING.
--
-- THE TRIGGER FIRES AT COMMIT, NOT AFTER THE INSERT. 0083 creates it as a DEFERRABLE INITIALLY
-- DEFERRED constraint trigger, because three live RPCs write a like and then MORE about the same
-- pair in the same transaction, and a plain AFTER INSERT row trigger decided before the rest
-- existed (found by running each one in a rolled-back probe, 15 Oct 2026):
--   * accept_invite inserts the invitee's like, THEN the inviter's automatic like, THEN the
--     match. Decided at the first insert, the inviter got "Someone wants to duo with you" next
--     to "New match!", and it spent their one person-push for the day.
--   * send_super_ping calls perform_swipe (the like), THEN inserts the super_pings row whose own
--     push names the sender. Decided at the like, the recipient got two pushes about one act,
--     the anonymous one spending the day's budget.
--   * perform_swipe's like-back inserts the like, THEN the match (this one the swiped-back check
--     caught either way).
-- At commit all of it exists, so the checks below see the whole act. send_rose also goes through
-- perform_swipe and sends no push of its own, so a rose is an ordinary like here.
--
--   queue_like_alert(liker, recipient)   the gates, then INSERT the pair into like_alerts
--                                        (the primary key is the permanent pair dedupe), then
--                                        dispatch_like_alert(recipient, event_driven => true).
--   dispatch_like_alert(recipient, ev)   under a per-recipient advisory lock: recipient still
--                                        eligible, inside the hour window for its mode, budget
--                                        unspent; then marks every still-valid pending pair
--                                        for that recipient sent (re-checking each pair's
--                                        gates), and makes ONE notify_via_edge_function call
--                                        carrying the count. Ledger and push request are
--                                        written in the same transaction, so a rollback takes
--                                        both and a commit keeps both.
--   send_pending_like_alerts(max)        the hourly sweep: every recipient with a pending pair
--                                        younger than 7 days who is inside 10:00-21:00 local
--                                        with budget unspent, dispatched with ev = false.
--
-- A pending pair older than 7 days is never sent (a week-old "someone wants to duo" is no
-- longer news); its row stays, so the pair is still never alerted twice.
--
-- ============================================================================
-- THE GATES, ALL IN SQL (a bug in TypeScript cannot widen any of them)
-- ============================================================================
--
-- Recipient (like_alert_recipient_ok): onboarded, active, not banned, not suspended, NOT
-- DEMO, new_like not switched off, and at least one push token (no token, no ledger row, so a
-- tokenless recipient's budget is never burned on a push that cannot arrive).
--
-- Pair (like_alert_pair_ok), re-checked at send time, not only at like time:
--   * the like still exists and the recipient has not swiped the liker (a like-back made a
--     match, whose own "New match!" push says everything; a pass means "no");
--   * no match row exists between them at all (a backstop for the above: an invite's match, or
--     any later path that matches a pair without a swipe each way, already got "New match!");
--   * the liker has never Super Pinged the recipient (that push already named them);
--   * the liker is NOT DEMO (0059: a demo persona is never announced to a real person);
--   * same server group, and at least one shared game_id;
--   * the liker passes deck_gate_hard AND deck_gate_preferences for the recipient: they really
--     are in the recipient's deck, so "Open your deck to see who" is true. deck_gate_hard
--     carries 0071's dormant rule, so a dormant liker is never announced (a liker who just
--     swiped is not dormant, so in practice this is a no-op).
--
-- No name, no id of the liker ever leaves the database in the push. The payload carries the
-- recipient and a count; the deck is where identity belongs (0071 puts the liker on top of it).
--
-- ============================================================================
-- THE EDGE FUNCTION CONTRACT (send-push-notification must learn this event)
-- ============================================================================
--
--   { "type": "new_like", "recipientId": <uuid>, "likeCount": <int >= 1> }
--
--   setting column  new_like           (a missing settings row means notify, as notifyProfile
--                                       already treats every other column)
--   data.category   "new_player"       the shipped 1.0.1 client routes new_player to the deck
--                                       and refreshes it (notificationRouting.ts destinationOf);
--                                       a dedicated "new_like" category would be an unknown
--                                       category to 1.0.1, which resumes and opens nothing.
--   sound           yes (a real person)
--   copy            likeCount = 1:  "Someone wants to duo with you" / "Open your deck to see who."
--                   likeCount > 1:  "{n} players want to duo with you" / "Open your deck to see who."
--
-- A deployed send-push-notification that predates the type answers 400 "Invalid payload" and
-- sends nothing, AND the ledger row is already marked sent: that alert is lost (the safe
-- direction, a missed push, never a duplicate). That is why nothing in THIS file produces a
-- push: the trigger on swipes and the sweep's cron job are created by 0083, which is applied
-- only after the function deploy has been hand-tested.
--
-- ============================================================================
-- ALSO HERE: get_new_player_alert_batch
-- ============================================================================
--
-- Rebuilt from its live definition (0063's body) with three changes and nothing else:
--   1. the 24-hour cooldown becomes the SHARED budget (a like alert in the last 24 hours also
--      holds back a new-player alert, and the reverse is in dispatch_like_alert);
--   2. a new player is announced only to recipients in the same server group (19 of the 38
--      new-player alerts sent so far paired players across regions);
--   3. quiet hours go through local_hour_within(tz, 10, 20). Same window; the only difference
--      is a NULL timezone, which now has to be inside the window in BOTH New York and Los
--      Angeles (0063 used New York alone, which allowed 07:00 for a West Coast phone).
-- Signature, RETURNS shape and grants are unchanged, so the deployed send-new-player-alerts
-- keeps working against it as it is.
--
-- ============================================================================
-- AND claim_new_player_alert: the budget is checked again at the moment of the claim
-- ============================================================================
--
-- The batch reads the shared budget once, when it runs, and the function then claims and pushes
-- each recipient in turn. A like alert for recipient R that commits between the batch read and
-- R's claim would be followed by a new-player alert to R: two person-pushes in a day. And the
-- reverse: a like dispatch reading the budget before a new-player claim commits. So the claim
-- moves into this RPC, which takes the SAME per-recipient advisory lock dispatch_like_alert
-- takes, re-reads person_push_sent_recently under it, and only then inserts the ledger rows
-- (on conflict do nothing, returning what this call claimed). Whichever side gets the lock
-- first commits its ledger row before the other reads the budget.
--
-- send-new-player-alerts calls it from its next deploy on, and falls back to its old direct
-- upsert only when the RPC does not exist yet (function deployed before this file was applied).
-- That fallback has no race to lose: like alerts cannot exist before this file and 0083.
--
-- Checks: supabase/checks/0072_like_alerts.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. local_hour_within: is the recipient's local clock inside [first, last]?
-- ---------------------------------------------------------------------------
--
-- Hours inclusive; first > last wraps midnight, so (10, 0) means 10:00 through 00:59 and
-- (10, 20) means 10:00 through 20:59. profiles.timezone is a validated IANA name
-- (profiles_timezone_valid, 0031) but nullable. A NULL zone must satisfy the window in BOTH
-- America/New_York and America/Los_Angeles: for a US phone with an unknown zone that is the
-- only way to promise "never before 10:00" and "never after the window" at the same time.
create or replace function public.local_hour_within(p_timezone text, p_first_hour integer, p_last_hour integer)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select coalesce(bool_and(
    case
      when p_first_hour <= p_last_hour then hours.h between p_first_hour and p_last_hour
      else hours.h >= p_first_hour or hours.h <= p_last_hour
    end), false)
  from (
    select extract(hour from (now() at time zone z.zone))::int as h
    from unnest(
      case when nullif(btrim(p_timezone), '') is null
        then array['America/New_York', 'America/Los_Angeles']
        else array[p_timezone]
      end
    ) as z(zone)
  ) hours;
$fn$;

revoke execute on function public.local_hour_within(text, integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The switch.
-- ---------------------------------------------------------------------------
--
-- Default true, like every other person-driven category; the OS permission is the real
-- consent gate. No new grant: notification_settings carries 0001's table-wide grant to
-- authenticated, scoped to the caller's own row by its RLS policies, and a table-level grant
-- covers a column added later, so the 1.0.2 build's toggle can write it. 1.0.1 selects "*"
-- and ignores a column it does not know.
alter table public.notification_settings add column if not exists new_like boolean not null default true;

-- The shipped 1.0.1 build has no toggle for this, so a player who already switched off the
-- closest thing it has ("New players in your games") is kept out too, rather than handed a new
-- push they cannot turn off in the app. On 2026-10-14 nobody had switched off anything, so
-- this updates 0 rows today; it is here for every other environment and for the record.
update public.notification_settings
   set new_like = false
 where new_player = false
   and new_like = true;

-- ...and the same holds for anyone who flips that switch AFTER this file is applied: the
-- one-time UPDATE above cannot see the future. Until a build with its own "Someone wants to duo
-- with you" toggle is the minimum version, new_like FOLLOWS new_player whenever an update changes
-- new_player and leaves new_like alone. That is exactly what 1.0.1 sends: its settings screen
-- writes only the column that was tapped (useNotificationSettings.update). Both directions, so a
-- 1.0.1 player who switches "New players in your games" off and on again is not left with like
-- alerts silently off and no switch to get them back.
--
-- A build that HAS the new_like toggle still gets its own choice: an update of new_like alone
-- never fires this, so new_like can be turned back on after new_player goes off, and an update
-- that CHANGES new_like in the same statement keeps the value it asked for. (Setting new_like
-- to the value it already has cannot be told apart from leaving it alone, so that follows.) The
-- one cost there: flipping new_player in that build flips new_like with it (the screen re-reads
-- the row on success, so the player sees it). Remove this trigger once that build is the floor:
--   drop trigger if exists notification_settings_new_like_follows_new_player on public.notification_settings;
create or replace function public.new_like_follows_new_player()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.new_player is distinct from old.new_player
     and new.new_like is not distinct from old.new_like then
    new.new_like := new.new_player;
  end if;
  return new;
end;
$fn$;

revoke execute on function public.new_like_follows_new_player() from public, anon, authenticated;

drop trigger if exists notification_settings_new_like_follows_new_player on public.notification_settings;
create trigger notification_settings_new_like_follows_new_player
  before update of new_player on public.notification_settings
  for each row
  execute function public.new_like_follows_new_player();

-- ---------------------------------------------------------------------------
-- 3. The ledger. Its primary key is the permanent per-pair dedupe; sent_at is the budget.
-- ---------------------------------------------------------------------------
--
-- Both ids cascade from profiles (App Store 5.1.1(v)): delete-account deletes the profile,
-- and with it every row saying who liked whom.
create table if not exists public.like_alerts (
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  liker_id     uuid not null references public.profiles (id) on delete cascade,
  liked_at     timestamptz not null default now(),
  sent_at      timestamptz,
  primary key (recipient_id, liker_id),
  constraint like_alerts_not_self check (recipient_id <> liker_id)
);

-- The budget probe (per recipient, newest send first) and the sweep's pending scan.
create index if not exists like_alerts_recipient_sent_at_idx
  on public.like_alerts (recipient_id, sent_at desc);
create index if not exists like_alerts_pending_idx
  on public.like_alerts (liked_at)
  where sent_at is null;

-- Server-only. RLS with no policies returns nothing to a client role, and the revoke matters:
-- 0052's default privileges still hand SELECT to anon and authenticated on every new table
-- here (0063's measured note). service_role is granted explicitly because from 30 Oct 2026
-- Supabase stops auto-granting new tables to it.
alter table public.like_alerts enable row level security;
revoke all on public.like_alerts from public, anon, authenticated;
grant select, insert, update, delete on public.like_alerts to service_role;

-- ---------------------------------------------------------------------------
-- 4. The shared one-person-push-a-day budget.
-- ---------------------------------------------------------------------------
create or replace function public.person_push_sent_recently(p_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
           select 1 from public.new_player_alerts a
           where a.recipient_id = p_recipient and a.sent_at > now() - interval '24 hours'
         )
      or exists (
           select 1 from public.like_alerts l
           where l.recipient_id = p_recipient and l.sent_at > now() - interval '24 hours'
         );
$fn$;

revoke execute on function public.person_push_sent_recently(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. The gates.
-- ---------------------------------------------------------------------------
create or replace function public.like_alert_recipient_ok(p_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from public.profiles r
    where r.id = p_recipient
      and r.onboarding_completed = true
      and r.is_active = true
      and r.is_banned = false
      and r.is_admin_suspended = false
      and r.is_demo = false
      and not exists (
        select 1 from public.notification_settings ns
        where ns.profile_id = r.id and ns.new_like = false
      )
      and exists (select 1 from public.push_tokens t where t.profile_id = r.id)
  );
$fn$;

revoke execute on function public.like_alert_recipient_ok(uuid) from public, anon, authenticated;

-- Predicate order: the cheap indexed probes first, the two SECURITY DEFINER gates last.
create or replace function public.like_alert_pair_ok(p_recipient uuid, p_liker uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select
    exists (
      select 1 from public.swipes s
      where s.swiper_id = p_liker and s.target_id = p_recipient and s.action = 'like'
    )
    and not exists (
      select 1 from public.swipes s
      where s.swiper_id = p_recipient and s.target_id = p_liker
    )
    -- Any match row at all, live or unmatched: "New match!" already told them about each other.
    and not exists (
      select 1 from public.matches m
      where m.user_a_id = least(p_recipient, p_liker)
        and m.user_b_id = greatest(p_recipient, p_liker)
    )
    -- A Super Ping is the named version of this push; never send the anonymous one as well.
    and not exists (
      select 1 from public.super_pings sp
      where sp.sender_id = p_liker and sp.receiver_id = p_recipient
    )
    and exists (
      select 1
      from public.profiles l
      join public.profiles r on r.id = p_recipient
      where l.id = p_liker
        and l.is_demo = false
        and r.is_demo = false
        and public.server_group(l.region) = public.server_group(r.region)
    )
    and exists (
      select 1
      from public.profile_games mine
      join public.profile_games theirs on theirs.game_id = mine.game_id
      where mine.profile_id = p_recipient and theirs.profile_id = p_liker
    )
    and public.deck_gate_hard(p_recipient, p_liker)
    and public.deck_gate_preferences(p_recipient, p_liker);
$fn$;

revoke execute on function public.like_alert_pair_ok(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Dispatch: send whatever is due for one recipient, as ONE push.
-- ---------------------------------------------------------------------------
--
-- Returns how many pairs were marked sent (0 = nothing went out). p_event_driven picks the
-- hour window: true (straight from a like) = never 01:00-09:59 local; false (the sweep) =
-- 10:00-20:59 local, the window every scheduled push uses.
--
-- pg_try_advisory_xact_lock, not the blocking form: a swipe must never wait on a sweep. If
-- another transaction is dispatching for this recipient right now, this one leaves its row
-- pending and the next like or the next sweep picks it up. Under the lock, the budget probe is
-- a fresh statement, so it sees anything a previous holder committed.
create or replace function public.dispatch_like_alert(p_recipient uuid, p_event_driven boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_timezone text;
  v_count integer;
begin
  if p_recipient is null then
    return 0;
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('like_alert:' || p_recipient::text, 0)) then
    return 0;
  end if;
  if not public.like_alert_recipient_ok(p_recipient) then
    return 0;
  end if;

  select p.timezone into v_timezone from public.profiles p where p.id = p_recipient;
  if coalesce(p_event_driven, false) then
    if not public.local_hour_within(v_timezone, 10, 0) then
      return 0;
    end if;
  elsif not public.local_hour_within(v_timezone, 10, 20) then
    return 0;
  end if;

  if public.person_push_sent_recently(p_recipient) then
    return 0;
  end if;

  update public.like_alerts la
     set sent_at = now()
   where la.recipient_id = p_recipient
     and la.sent_at is null
     and la.liked_at > now() - interval '7 days'
     and public.like_alert_pair_ok(la.recipient_id, la.liker_id);
  get diagnostics v_count = row_count;

  if v_count = 0 then
    return 0;
  end if;

  perform public.notify_via_edge_function(
    jsonb_build_object('type', 'new_like', 'recipientId', p_recipient, 'likeCount', v_count)
  );
  return v_count;
end;
$fn$;

revoke execute on function public.dispatch_like_alert(uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Queue: called for every new like (by the trigger 0083 creates).
-- ---------------------------------------------------------------------------
--
-- Returns what happened, for the check script and for anyone debugging by hand:
--   'sent' | 'pending' | 'skip-invalid' | 'skip-swiped-back' | 'skip-recipient' |
--   'skip-pair' | 'skip-already-queued'
create or replace function public.queue_like_alert(p_liker uuid, p_recipient uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_liker is null or p_recipient is null or p_liker = p_recipient then
    return 'skip-invalid';
  end if;

  -- The recipient already swiped the liker: a like-back (perform_swipe's match, or
  -- accept_invite's inviter like and match, which by the time the commit-time trigger runs are
  -- both written) has its own "New match!", and a pass means "no".
  if exists (
    select 1 from public.swipes s
    where s.swiper_id = p_recipient and s.target_id = p_liker
  ) then
    return 'skip-swiped-back';
  end if;

  if not public.like_alert_recipient_ok(p_recipient) then
    return 'skip-recipient';
  end if;
  if not public.like_alert_pair_ok(p_recipient, p_liker) then
    return 'skip-pair';
  end if;

  insert into public.like_alerts (recipient_id, liker_id)
  values (p_recipient, p_liker)
  on conflict (recipient_id, liker_id) do nothing;
  if not found then
    return 'skip-already-queued';
  end if;

  if public.dispatch_like_alert(p_recipient, true) > 0 then
    return 'sent';
  end if;
  return 'pending';
end;
$fn$;

revoke execute on function public.queue_like_alert(uuid, uuid) from public, anon, authenticated;

-- The trigger function. A deferred constraint trigger AFTER INSERT ON swipes, likes only,
-- firing at COMMIT (the trigger itself is in 0083; why deferred is at the top of this file).
-- Never raises: a bug here must cost a push, never a swipe. That matters even more at commit,
-- where an error would fail the COMMIT and take the whole request with it (the swipe, the
-- invite's match, the Super Ping).
create or replace function public.enqueue_like_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  begin
    perform public.queue_like_alert(new.swiper_id, new.target_id);
  exception
    when others then
      raise warning 'enqueue_like_alert failed: %', sqlerrm;
  end;
  return null;
end;
$fn$;

revoke execute on function public.enqueue_like_alert() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. The sweep (scheduled hourly by 0083).
-- ---------------------------------------------------------------------------
--
-- Only recipients who could be sent to right now are visited: inside the window, budget unspent,
-- still an eligible recipient (like_alert_recipient_ok), and holding at least one pending pair
-- that still passes like_alert_pair_ok. Without the last two, recipients whose pending rows can
-- never go out (new_like switched off, token removed, banned, the liker blocked or now dormant)
-- would be picked first in uuid order every hour for a week, each costing a slot under the cap,
-- and valid recipients past the cap would never be reached. The cap is clamped here, not
-- trusted from the caller. Returns how many recipients were pushed.
create or replace function public.send_pending_like_alerts(p_max_recipients integer default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_recipient uuid;
  v_pushed integer := 0;
begin
  for v_recipient in
    select distinct la.recipient_id
    from public.like_alerts la
    join public.profiles r on r.id = la.recipient_id
    where la.sent_at is null
      and la.liked_at > now() - interval '7 days'
      and public.local_hour_within(r.timezone, 10, 20)
      and not public.person_push_sent_recently(la.recipient_id)
      and public.like_alert_recipient_ok(la.recipient_id)
      and public.like_alert_pair_ok(la.recipient_id, la.liker_id)
    order by la.recipient_id
    limit greatest(least(coalesce(p_max_recipients, 200), 1000), 1)
  loop
    if public.dispatch_like_alert(v_recipient, false) > 0 then
      v_pushed := v_pushed + 1;
    end if;
  end loop;
  return v_pushed;
end;
$fn$;

revoke execute on function public.send_pending_like_alerts(integer) from public, anon, authenticated;
grant execute on function public.send_pending_like_alerts(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 9. get_new_player_alert_batch: shared budget, same server group, local_hour_within.
-- ---------------------------------------------------------------------------
create or replace function public.get_new_player_alert_batch(p_max_recipients integer default 200)
returns table (
  recipient_id     uuid,
  new_profile_ids  uuid[],
  new_player_count integer,
  headline_game    text
)
language sql
stable
security definer
set search_path = public
as $fn$
  with recent_players as (
    -- Rate limit 3: the 48 hour announcement window.
    select n.id, n.region
    from public.profiles n
    where n.onboarding_completed_at is not null
      and n.onboarding_completed_at > now() - interval '48 hours'
      and n.onboarding_completed = true
      and n.is_active = true
      and n.is_banned = false
      and n.is_admin_suspended = false
      and n.is_demo = false
  ),
  eligible_recipients as (
    select r.id, r.region
    from public.profiles r
    join public.notification_settings ns on ns.profile_id = r.id
    where r.onboarding_completed = true
      and r.is_active = true
      and r.is_banned = false
      and r.is_admin_suspended = false
      and r.is_demo = false
      -- D5: the toggle, honoured in SQL so a bug in the Edge Function cannot ignore it.
      and ns.new_player = true
      and exists (select 1 from public.push_tokens t where t.profile_id = r.id)
      -- Rate limit 1, since 0072: the SHARED one-person-push-a-day budget (new-player alerts
      -- and like alerts together).
      and not public.person_push_sent_recently(r.id)
      -- Quiet hours, in the RECIPIENT's local time (10:00-20:59).
      and public.local_hour_within(r.timezone, 10, 20)
  ),
  pairs as (
    select
      er.id as recipient_id,
      rp.id as new_profile_id,
      (select g.name
         from public.profile_games mine
         join public.profile_games theirs on theirs.game_id = mine.game_id
         join public.games g on g.id = mine.game_id
        where mine.profile_id = er.id and theirs.profile_id = rp.id
        order by mine.priority asc
        limit 1) as shared_game_name
    from eligible_recipients er
    join recent_players rp on rp.id <> er.id
    -- 0072: the same server group (NA East + NA West are one). A player you cannot queue with
    -- is not news worth the day's one person-push.
    where public.server_group(rp.region) = public.server_group(er.region)
      -- D2: at least one shared game.
      and exists (
        select 1 from public.profile_games mine
        join public.profile_games theirs on theirs.game_id = mine.game_id
        where mine.profile_id = er.id and theirs.profile_id = rp.id
      )
      -- Rate limit 2: never announce the same pair twice.
      and not exists (
        select 1 from public.new_player_alerts a
        where a.recipient_id = er.id and a.new_profile_id = rp.id
      )
      -- D3: and the new player has to actually be in this recipient's deck.
      and public.deck_gate_hard(er.id, rp.id)
      and public.deck_gate_preferences(er.id, rp.id)
  )
  select
    p.recipient_id,
    array_agg(p.new_profile_id order by p.new_profile_id),
    count(*)::int,
    (array_agg(p.shared_game_name order by p.new_profile_id))[1]
  from pairs p
  group by p.recipient_id
  order by count(*) desc, p.recipient_id
  -- Rate limit 4: the per-run cap, clamped here rather than trusted from the caller.
  limit greatest(least(coalesce(p_max_recipients, 200), 1000), 1);
$fn$;

revoke execute on function public.get_new_player_alert_batch(integer) from public, anon, authenticated;
grant execute on function public.get_new_player_alert_batch(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 10. claim_new_player_alert: the new-player ledger claim, under the budget lock.
-- ---------------------------------------------------------------------------
--
-- Returns the new_profile_ids THIS call claimed: none when the budget was spent since the batch
-- read (a like alert got there first) or another run already claimed them. The blocking lock is
-- right here and wrong in dispatch_like_alert: this runs from an hourly cron and can wait a few
-- milliseconds; a swipe must never wait (that side uses pg_try_advisory_xact_lock and leaves
-- its pair pending for the sweep).
--
-- The output column is claimed_profile_id, not new_profile_id, on purpose: a RETURNS TABLE
-- column is a PL/pgSQL variable, and one named like the ledger's column would make the
-- ON CONFLICT target ambiguous.
create or replace function public.claim_new_player_alert(p_recipient uuid, p_new_profile_ids uuid[])
returns table (claimed_profile_id uuid)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_recipient is null or p_new_profile_ids is null or cardinality(p_new_profile_ids) = 0 then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('like_alert:' || p_recipient::text, 0));

  if public.person_push_sent_recently(p_recipient) then
    return;
  end if;

  return query
    insert into public.new_player_alerts as a (recipient_id, new_profile_id)
    select p_recipient, x.id
    from (select distinct u.id from unnest(p_new_profile_ids) as u(id)) x
    where x.id is not null
      and x.id <> p_recipient
    on conflict (recipient_id, new_profile_id) do nothing
    returning a.new_profile_id;
end;
$fn$;

revoke execute on function public.claim_new_player_alert(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.claim_new_player_alert(uuid, uuid[]) to service_role;
