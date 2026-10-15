-- 0088: One duo per Queue up. Once someone connects with a Queue up, by tapping I'm in on a
-- Duo Pop OR by joining with the Duo Call LFG post's code, the call is over: League ranked
-- solo/duo is two players.
--
-- WHAT CHANGES (all server side; every signature, RETURNS shape and ACL stays as 0085 left it):
--
--   * queue_ups.locked_via ('pop' or 'call'), so a lock says which path filled it.
--   * WHEN A DUO FORMS (either path), both players have theirs: every OTHER unlocked, unended
--     queue-up of either player whose code still works (looking_until + 15 minutes > now(), the
--     code's grace, not only the hour) ends, so no older code in its grace and no newer queue-up
--     can lock a second duo; the sender leaves Online Now (is_looking_now off, silently:
--     notify_looking_now only fires on false to true), and so does the other player when they
--     had a queue-up of their own. Locked rows are never ended (THE ONE RULE below).
--   * answer_duo_pop: the duo-forms rule above, plus three answers reordered or added, all words
--     build 19 already parses: a pair that already shares a live match gets 'already_matched'
--     with its id BEFORE 'taken' or 'ended' (two crossed I'm in taps used to leave the second
--     player on "ended" although their chat exists); and an answerer whose OWN queue-up is
--     already locked and still current (looking_until + 15 minutes > now()) gets 'unavailable'
--     (they have their duo; Stop frees them). Every other branch is unchanged.
--   * accept_invite, Duo Call branch: the caller's standing like is written only while the call
--     is live AND not yet locked (it was "fewer than 3 other connections"). The FIRST redemption
--     that becomes a NEW match locks the call (locked_via 'call', match_id) and runs the
--     duo-forms rule. A match made from the caller's earlier deck like also locks: they still
--     connected through the code. An accept that does NOT match (the caller had passed on them)
--     does not lock: one duo, not one attempt. A redeemer who accepts after the lock writes only
--     their own like, and /invited says "Duo request sent": the caller decides in Requests (the
--     existing honest path).
--   * accept_invite, BOTH branches: a match row that already exists decides first. Unmatched (one
--     of them said no) stays unmatched: matched false, nothing locked (it used to be upserted back
--     to life, with the unmatcher never told, and a call would have spent its one duo on it;
--     answer_duo_pop already refuses this case). Live: matched true with that id, and a call is
--     NOT locked (they were a duo before the code, and on_match_created never fires for an
--     existing row, so the caller would be told nothing). This is the one change on the
--     permanent-code path (1.0.1's), and 1.0.1 already handles matched false.
--   * queue_up_out: call_code is null once the row is locked; popped_in_seconds is null for a
--     lock that came from the post (build 20 reads that null as "they answered your LFG post").
--   * resolve_invite_code: a locked call code no longer resolves (the permanent branch and
--     anon's grant are unchanged). call_code_ended: a locked call code reads as ended, so the
--     posted link shows the existing "That Duo Call has ended" line in every build.
--
-- ============================================================================
-- THE ONE RULE FOR BUILD 19: A LOCK NEVER SETS ended_at
-- ============================================================================
--
-- Build 19's sheetViewOf (apps/mobile/src/features/queue/queueState.ts:114-125) returns idle on
-- ended_at BEFORE it looks at locked_at. So a locked row stays `ended_at null, locked_at set`,
-- and both build 19 and build 20 draw "Duo locked". The OTHER rows this file ends (either
-- player's) are unlocked rows only: a row someone already locked keeps its "Duo locked" view, and
-- is already over in every way (its code is dead, its pops answer "taken").
--
-- One cosmetic edge, accepted: a sender who queued again inside an older code's 15-minute grace
-- and is then joined through that OLDER code has the newer (unlocked) row ended, and
-- get_my_queue_up reads the newest row, so their sheet is idle rather than "Duo locked". The
-- "Duo locked: {name} answered your LFG post." push and the match both arrive as usual.
--
-- ============================================================================
-- LOCK ORDER (why answer_duo_pop and accept_invite now lock profiles first)
-- ============================================================================
--
-- Hold a sender's profiles row lock (FOR NO KEY UPDATE) before touching their queue_ups rows.
-- start_queue_up and stop_queue_up already take the caller's own (0085). answer_duo_pop and the
-- Duo Call branch of accept_invite now write BOTH players' profiles and BOTH players' queue_ups
-- rows, so each takes both profile locks first, in ONE statement ordered by id
-- (`where p.id in (a, b) order by p.id for no key update`). Every path that can hold two of
-- these locks takes them in uuid order, so two players answering each other's pops at the same
-- moment wait for each other instead of deadlocking (that ordering also removes the old
-- deadlock between two such answers' two-row swipes inserts). The one exception is get_duo_pop's
-- `opened` update, which takes a single row lock while holding nothing else and so cannot be
-- part of a cycle; the profile-delete trigger and the prune are bulk writes with no client
-- path. A single-transaction check cannot prove deadlock freedom; the checks file asserts the
-- order by reading the bodies.
--
-- ============================================================================
-- SAFE FOR THE 1.0.1 APP AND FOR BUILD 19
-- ============================================================================
--
--   * 1.0.1 has no Queue up. Its call-code redeemers (a new player who types a posted code) go
--     through the same resolve_invite_code / redeem_invite_code / accept_invite as before; the
--     differences are that a Duo Call auto-matches 1 redeemer instead of up to 3, and that a pair
--     whose match was unmatched is no longer re-matched by any code (matched false, a shape 1.0.1
--     already shows when the inviter had passed).
--   * Build 19 (1.0.2, built, not in the store): after a post lock its sheet says "{name} grabbed
--     your Duo Pop." (it has no post line), its resume check may open DUO LOCKED without a time,
--     and its pill reads "Queued" until the profile refreshes. All cosmetic; every RPC answers
--     in the shapes it already parses.
--
-- ============================================================================
-- DEPLOY ORDER
-- ============================================================================
--
--   1. Deploy send-push-notification FIRST. The live function reads any locked row as a Duo
--      Pop, so the first post lock would push "{name} grabbed your Duo Pop. Popped in 10:00."
--      The new one selects * (locked_via is simply absent before this file) and pushes
--      "{name} answered your LFG post." for a call lock.
--   2. Dry run this file with its check, then apply it.
--
-- No backfill: queue_ups had 0 rows on 15 Oct 2026, and a null locked_via with locked_at set
-- reads as a Duo Pop everywhere (queue_up_out, the push).
--
-- Rebuilt from the LIVE definitions read 15 Oct 2026 (pg_get_functiondef): answer_duo_pop,
-- accept_invite, queue_up_out, resolve_invite_code and call_code_ended are byte for byte 0085's.
-- Not changed on purpose: get_duo_pop (it already answers "taken" for any locked_at, so open Pop
-- cards and late I'm in taps stop by either path), start_queue_up (a locked, unended row is
-- still live for idempotency, so neither build can double-queue; queueing again goes through
-- stop_queue_up, which ends a locked row like any other), stop_queue_up, get_my_queue_up,
-- duo_pop_recipients and generate_call_code (rebuilt by 0089).
--
-- Checks: supabase/checks/0088_one_duo_per_queue_up.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. queue_ups.locked_via
-- ---------------------------------------------------------------------------
-- Account deletion still works: the locker's locked_by is SET NULL, locked_at and locked_via
-- stay, and both checks still hold (neither mentions locked_by).
alter table public.queue_ups
  add column if not exists locked_via text;

alter table public.queue_ups drop constraint if exists queue_ups_locked_via;
alter table public.queue_ups
  add constraint queue_ups_locked_via check (locked_via is null or locked_via in ('pop', 'call'));

alter table public.queue_ups drop constraint if exists queue_ups_locked_via_needs_lock;
alter table public.queue_ups
  add constraint queue_ups_locked_via_needs_lock check (locked_via is null or locked_at is not null);

comment on column public.queue_ups.locked_via is
  'How the one duo of this queue-up formed (0088): pop = someone tapped I''m in on a Duo Pop, call = someone joined with the Duo Call code and matched. Null with locked_at set reads as a pop.';

-- ---------------------------------------------------------------------------
-- 2. queue_up_out: no code once locked; no "Popped in" for a post lock
-- ---------------------------------------------------------------------------
create or replace function public.queue_up_out(p_id uuid, p_already boolean)
returns table(
  queue_id uuid, game_id uuid, game_name text, ping boolean, notified integer, pop_note text,
  created_at timestamptz, pop_expires_at timestamptz, looking_until timestamptz, ended_at timestamptz,
  call_code text, locked_at timestamptz, match_id uuid, partner_id uuid, partner_name text,
  popped_in_seconds integer, already_queued boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    q.id,
    q.game_id,
    g.name,
    q.ping,
    cardinality(q.recipients),
    q.pop_note,
    q.created_at,
    q.pop_expires_at,
    q.looking_until,
    q.ended_at,
    -- 0088: the code dies with the first duo, not only with the hour.
    case when q.ended_at is null and q.looking_until > now() and q.locked_at is null then q.call_code end,
    q.locked_at,
    q.match_id,
    q.locked_by,
    lp.display_name,
    -- 0088: only a Duo Pop lock "popped in"; a post answered at minute 40 would otherwise read
    -- "Popped in 10:00". Null here is build 20's signal that the duo came from the post.
    case
      when q.locked_at is not null and q.locked_via is distinct from 'call'
        then greatest(1, least(600, ceil(extract(epoch from q.locked_at - q.created_at))))::int
    end,
    coalesce(p_already, false)
  from public.queue_ups q
  left join public.games g on g.id = q.game_id
  left join public.profiles lp on lp.id = q.locked_by
  where q.id = p_id;
$fn$;

revoke execute on function public.queue_up_out(uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. answer_duo_pop: one duo, both ways
-- ---------------------------------------------------------------------------
create or replace function public.answer_duo_pop(p_pop_id uuid, p_accept boolean)
returns table(result text, match_id uuid, popped_in_seconds integer)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_q public.queue_ups%rowtype;
  v_existing_id uuid;
  v_existing_unmatched timestamptz;
  v_match uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('answer_duo_pop', 30, interval '1 hour');

  -- 0088: both players' profiles, in uuid order, before the queue_ups row (the header's LOCK
  -- ORDER). A lock below writes both players' profiles and queue_ups rows. A pop that does not
  -- exist leaves only the caller's own row here, and answers unavailable below.
  perform 1 from public.profiles p
   where p.id in (v_me, (select q.sender_id from public.queue_ups q where q.id = p_pop_id))
   order by p.id
   for no key update;

  select * into v_q from public.queue_ups q where q.id = p_pop_id for update;
  if not found or not (v_q.recipients @> array[v_me]) then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  -- Not now: remembered for this sender's next 7 days of pops, and never sent to the sender.
  if not coalesce(p_accept, false) then
    if v_q.locked_by is distinct from v_me and not (v_q.declined @> array[v_me]) then
      update public.queue_ups q set declined = array_append(q.declined, v_me) where q.id = v_q.id;
    end if;
    return query select 'declined'::text, null::uuid, null::integer;
    return;
  end if;

  -- I'm in, again, by the player who already has it: the same answer.
  if v_q.locked_by = v_me then
    return query select 'locked'::text, v_q.match_id,
      greatest(1, least(600, ceil(extract(epoch from v_q.locked_at - v_q.created_at))))::int;
    return;
  end if;

  -- 0088: a live match already has its chat, whatever has happened to this pop since. Asked
  -- BEFORE taken and ended, so the second of two crossed I'm in taps (each player popped the
  -- other; the first tap locked one pop and ended the answerer's own) opens the chat that tap
  -- made instead of reading "ended". Only for a pair duo_pop_pair_ok still allows; any other
  -- pair falls through to the answers it always got.
  select m.id, m.unmatched_at into v_existing_id, v_existing_unmatched
  from public.matches m
  where m.user_a_id = least(v_q.sender_id, v_me) and m.user_b_id = greatest(v_q.sender_id, v_me);
  if v_existing_id is not null and v_existing_unmatched is null
     and public.duo_pop_pair_ok(v_q.sender_id, v_me) then
    return query select 'already_matched'::text, v_existing_id, null::integer;
    return;
  end if;

  if v_q.locked_at is not null then
    return query select 'taken'::text, null::uuid, null::integer;
    return;
  end if;
  if v_q.ended_at is not null then
    return query select 'ended'::text, null::uuid, null::integer;
    return;
  end if;
  if v_q.pop_expires_at <= now() then
    return query select 'expired'::text, null::uuid, null::integer;
    return;
  end if;
  -- 0088: one duo per player. The answerer's own queue-up already found its duo and is still
  -- current (inside its hour or the code's 15-minute grace): taking this pop too would leave
  -- them with two. Stop (stop_queue_up ends a locked row) frees them.
  if exists (
    select 1 from public.queue_ups q
    where q.sender_id = v_me
      and q.locked_at is not null
      and q.ended_at is null
      and q.looking_until + interval '15 minutes' > now()
  ) then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;
  if not public.duo_pop_pair_ok(v_q.sender_id, v_me) then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  -- A live match already has its chat (answered above). An unmatched one means one of them said
  -- no, and a pop must not bring it back.
  if v_existing_id is not null then
    if v_existing_unmatched is null then
      return query select 'already_matched'::text, v_existing_id, null::integer;
    else
      return query select 'unavailable'::text, null::uuid, null::integer;
    end if;
    return;
  end if;

  -- 0088: locked_via 'pop'. Never ended_at (the header's ONE RULE FOR BUILD 19).
  update public.queue_ups q
     set locked_by = v_me,
         locked_at = now(),
         locked_via = 'pop'
   where q.id = v_q.id;

  -- Both consents, as ordinary likes, so the match is the same object as one from the deck
  -- (same unmatch, block and report paths), and no swipe quota is charged: this is a direct
  -- insert, not perform_swipe.
  --
  -- The like-alert trigger on_swipe_like_alert is DEFERRABLE INITIALLY DEFERRED (0083:69-74),
  -- so it runs at COMMIT, sees both likes and the match, and 0072's no-match check skips the
  -- alert; a like that already existed takes the conflict path, which is an UPDATE and never
  -- fires the INSERT trigger.
  insert into public.swipes (swiper_id, target_id, action)
  values (v_q.sender_id, v_me, 'like'), (v_me, v_q.sender_id, 'like')
  on conflict (swiper_id, target_id) do update set action = 'like';

  -- The INSERT fires on_match_created, whose new_match push send-push-notification enriches
  -- for a pop: "Duo locked" to the sender only (it reads match_id below, after COMMIT).
  insert into public.matches (user_a_id, user_b_id)
  values (least(v_q.sender_id, v_me), greatest(v_q.sender_id, v_me))
  on conflict (user_a_id, user_b_id) do nothing
  returning id into v_match;
  if v_match is null then
    -- Lost a race with a deck swipe in the same instant: the match is theirs and ours alike.
    select m.id into v_match
    from public.matches m
    where m.user_a_id = least(v_q.sender_id, v_me) and m.user_b_id = greatest(v_q.sender_id, v_me);
  end if;

  update public.queue_ups q set match_id = v_match where q.id = v_q.id;

  -- 0088: one duo per Queue up. The sender has theirs: any OTHER queue-up of theirs whose code
  -- still works (an older one inside its 15-minute grace) ends, so it cannot lock a second duo,
  -- and they leave Online Now. Silent (0074's notify_looking_now fires only on false to true),
  -- and last_active_at is left alone because the sender did nothing just now.
  update public.queue_ups q
     set ended_at = now()
   where q.sender_id = v_q.sender_id
     and q.id <> v_q.id
     and q.ended_at is null
     and q.locked_at is null
     and q.looking_until + interval '15 minutes' > now();
  update public.profiles p
     set is_looking_now = false,
         looking_now_expires_at = null
   where p.id = v_q.sender_id
     and (coalesce(p.is_looking_now, false) or p.looking_now_expires_at is not null);

  -- And so does the answerer: their own unlocked queue-ups whose code still works end (their
  -- open pops answer "ended", their code reads as ended, their sheet goes idle in both builds),
  -- and they leave Online Now, as stop_queue_up would. Without this the player most likely to
  -- tap I'm in, one who is queued themselves (duo_pop_recipients ranks "free to duo now" first),
  -- keeps their own 6 pops and posted code open and can be locked a second time. The grace is
  -- included: resolve_invite_code still resolves a code for 15 minutes past looking_until. A
  -- row of theirs someone already locked is left as it is (THE ONE RULE FOR BUILD 19).
  update public.queue_ups q
     set ended_at = now()
   where q.sender_id = v_me
     and q.id <> v_q.id
     and q.ended_at is null
     and q.looking_until + interval '15 minutes' > now()
     and q.locked_at is null;
  if found then
    update public.profiles p
       set is_looking_now = false,
           looking_now_expires_at = null
     where p.id = v_me;
  end if;

  return query select 'locked'::text, v_match,
    greatest(1, least(600, ceil(extract(epoch from now() - v_q.created_at))))::int;
end;
$fn$;

revoke execute on function public.answer_duo_pop(uuid, boolean) from public, anon;
grant execute on function public.answer_duo_pop(uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Duo Call: a locked call code no longer resolves, and reads as ended
-- ---------------------------------------------------------------------------
-- resolve_invite_code, rebuilt from its LIVE definition (0085's, 15 Oct 2026). The first branch
-- is unchanged; the Duo Call branch gains `and q.locked_at is null`. Same signature, RETURNS,
-- STABLE SECURITY DEFINER and ACL (anon keeps it, 0065's D4).
create or replace function public.resolve_invite_code(p_code text)
returns table(inviter_id uuid, display_name text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select p.id, p.display_name
  from public.invite_codes ic
  join public.profiles p on p.id = ic.profile_id
  where ic.code = public.normalize_invite_code(p_code)
    -- Cheap shape gate before the index probe, so a garbage string never becomes a query.
    and public.normalize_invite_code(p_code) ~ '^[0-9A-HJKMNP-TV-Z]{10}$'
    and ic.revoked_at is null
    and p.is_active = true
    and p.is_admin_suspended = false
    and p.onboarding_completed = true
    and p.is_banned = false
    and p.is_demo = false
  union all
  -- 0085: a live Duo Call code. 0088: and not yet locked (one duo per Queue up).
  select p.id, p.display_name
  from public.queue_ups q
  join public.profiles p on p.id = q.sender_id
  where q.call_code = public.normalize_invite_code(p_code)
    and public.normalize_invite_code(p_code) ~ '^[0-9A-HJKMNP-TV-Z]{10}$'
    and q.ended_at is null
    and q.locked_at is null
    and q.looking_until + interval '15 minutes' > now()
    and p.is_active = true
    and p.is_admin_suspended = false
    and p.onboarding_completed = true
    and p.is_banned = false
    and p.is_demo = false
    and not exists (
      select 1 from public.invite_codes ic2
      where ic2.code = public.normalize_invite_code(p_code) and ic2.revoked_at is null
    );
$function$;

revoke execute on function public.resolve_invite_code(text) from public;
grant execute on function public.resolve_invite_code(text) to anon, authenticated, service_role;

-- call_code_ended, rebuilt from its LIVE definition (0085's). A call whose duo formed (locked by
-- either path) has ended, so a posted link shows the existing CALL_ENDED_COPY in every build
-- (InviteBanner.tsx). Same signature, STABLE SECURITY DEFINER, anon keeps it.
create or replace function public.call_code_ended(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((
    select v.c ~ '^[0-9A-HJKMNP-TV-Z]{10}$'
       and not exists (
         select 1 from public.invite_codes ic where ic.code = v.c and ic.revoked_at is null
       )
       and exists (
         select 1 from public.queue_ups q
         where q.call_code = v.c
           and q.created_at > now() - interval '7 days'
           and (q.ended_at is not null
                or q.locked_at is not null
                or q.looking_until + interval '15 minutes' <= now())
       )
    from (select public.normalize_invite_code(p_code) as c) v
  ), false);
$fn$;

revoke execute on function public.call_code_ended(text) from public;
grant execute on function public.call_code_ended(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. accept_invite: the first duo through a Duo Call code locks it
-- ---------------------------------------------------------------------------
-- Rebuilt from its LIVE definition (0085's, 15 Oct 2026). v_is_call is now decided before the
-- invitee's like instead of after it (the same query, and nothing between the two places reads
-- or writes what it reads). Changes, each marked 0088:
--   (a) Duo Call: both players' profiles are locked in uuid order before anything is written
--       (the header's LOCK ORDER; answer_duo_pop takes the same pair the same way);
--   (b) Duo Call: the standing like needs the call live AND unlocked (it was "fewer than 3
--       OTHER redemptions connected"; v_call_connected is gone);
--   (c) Duo Call: a NEW match through a live, unlocked call locks it: locked_via 'call',
--       match_id, the caller's other live or in-grace queue-ups ended and the caller out of
--       Online Now, the redeemer's own live or in-grace queue-ups ended (as answer_duo_pop does);
--   (d) both branches: an existing match row decides first. Unmatched stays unmatched (matched
--       false); live is matched with its id and locks nothing.
-- The match id is copied into the local v_match before the queue_ups UPDATE; this function has
-- no #variable_conflict directive and match_id is also an OUT parameter. A SET target is always
-- a column, so `match_id = v_match` is safe, and every column the new statements read is
-- qualified.
create or replace function public.accept_invite()
returns table(matched boolean, match_id uuid, inviter_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_row public.invite_redemptions%rowtype;
  v_recent_connections int;
  v_mutual boolean;
  v_a uuid;
  v_b uuid;
  v_is_call boolean;
  v_call public.queue_ups%rowtype;
  v_call_found boolean := false;
  v_standing_ok boolean;
  v_match uuid;
  v_existing_id uuid;
  v_existing_unmatched timestamptz;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;

  select * into v_row from public.invite_redemptions where invitee_id = v_me;
  if not found then
    raise exception 'no_invite' using hint = 'There is no invite on this account.';
  end if;

  -- Every gate the deck would apply to this pair, minus "not already swiped" (which is
  -- the one thing this function is allowed to change) and minus the preference filters
  -- (an invite is a named person, not a search result -- a region filter should not stop
  -- somebody connecting with the friend who brought them).
  if not exists (
    select 1 from public.profiles p
    where p.id = v_row.inviter_id
      and p.is_active = true
      and p.is_admin_suspended = false
      and p.onboarding_completed = true
      and p.is_banned = false
      and (p.is_demo = false or public.is_demo_viewer())
  ) then
    raise exception 'inviter_unavailable'
      using hint = 'That player is not available right now.';
  end if;
  if public.is_blocked_pair(v_me, v_row.inviter_id) then
    raise exception 'inviter_unavailable'
      using hint = 'That player is not available right now.';
  end if;
  if not public.same_age_band(v_me, v_row.inviter_id) then
    raise exception 'inviter_unavailable'
      using hint = 'That player is not available right now.';
  end if;

  -- 0085: a redemption is a call-code redemption when its code is NOT the inviter's permanent
  -- code. 0088: decided here, before anything is written, so the Duo Call path can take its
  -- locks first.
  v_is_call := not exists (
    select 1 from public.invite_codes ic
    where ic.profile_id = v_row.inviter_id and ic.code = v_row.code
  );
  if v_is_call then
    -- 0088 (a): both profiles, in uuid order, before the swipes and the queue_ups row.
    perform 1 from public.profiles p
     where p.id in (v_me, v_row.inviter_id)
     order by p.id
     for no key update;
  end if;

  -- The invitee's consent. DO UPDATE, not DO NOTHING, and the asymmetry with the inviter's
  -- row below is the point.
  --
  -- Found by running this against the live database rather than by reading it: the invitee
  -- in that test had already passed on the inviter from the deck, `on conflict do nothing`
  -- silently kept the pass, and the pair still matched because the mutual check only looked
  -- at the other side. Two fixes, both here. This side upserts because a tap on a named
  -- person's arrival screen is not a re-swipe of a card -- they are answering the friend who
  -- asked for them by name, and that is a newer and more specific decision than a flick past
  -- a face in a deck.
  insert into public.swipes (swiper_id, target_id, action)
  values (v_me, v_row.inviter_id, 'like')
  on conflict (swiper_id, target_id) do update set action = 'like';

  -- The inviter's standing consent, bounded -- and DO NOTHING, so it can only ever add a
  -- decision, never overwrite one. If the inviter already passed on this person with their
  -- profile in front of them, that judgement stands and no match forms. A link sent before
  -- they had seen the profile does not get to undo what they decided after.
  select count(*) into v_recent_connections
  from public.invite_redemptions
  where invite_redemptions.inviter_id = v_row.inviter_id
    and connected_at > now() - interval '24 hours';

  -- 0085: a Duo Call code's standing consent lasts only as long as the call.
  -- 0088 (b): and only until its one duo has formed.
  if v_is_call then
    -- FOR UPDATE: two invitees accepting the same call at once see each other's lock.
    select q.* into v_call
    from public.queue_ups q
    where q.call_code = v_row.code and q.sender_id = v_row.inviter_id
    for update;
    v_call_found := found;
    v_standing_ok := v_call_found
      and v_call.ended_at is null
      and v_call.looking_until + interval '15 minutes' > now()
      and v_call.locked_at is null;
  else
    v_standing_ok := true;
  end if;

  if v_recent_connections < 25 and v_standing_ok then
    insert into public.swipes (swiper_id, target_id, action)
    values (v_row.inviter_id, v_me, 'like')
    on conflict (swiper_id, target_id) do nothing;
  end if;

  update public.invite_redemptions
  set connected_at = coalesce(connected_at, now())
  where invitee_id = v_me;

  -- BOTH directions, both 'like'. The second half is true by construction after the upsert
  -- above, and it is written out anyway: this is the predicate that decides whether two
  -- people can message each other, and it should not be readable as "and something else
  -- earlier in this function must have gone right".
  select
    exists (
      select 1 from public.swipes
      where swiper_id = v_row.inviter_id and target_id = v_me and action = 'like'
    )
    and exists (
      select 1 from public.swipes
      where swiper_id = v_me and target_id = v_row.inviter_id and action = 'like'
    )
  into v_mutual;

  matched := false;
  match_id := null;
  inviter_id := v_row.inviter_id;

  if v_mutual then
    v_a := least(v_me, v_row.inviter_id);
    v_b := greatest(v_me, v_row.inviter_id);

    -- 0088 (d): a match row that already exists decides first, on both branches.
    --   Unmatched: one of them said no after seeing the other, and a code (a link sent before
    --   that, or a post) does not get to undo it. Not matched, nothing locked. This used to be
    --   upserted back to life (unmatched_at = null) with nobody told, and a Duo Call would then
    --   have spent its one duo on it; answer_duo_pop refuses the same case.
    --   Live: they were a duo before this code. Matched, with that id, and a call is NOT locked
    --   (on_match_created never fires for an existing row, so the caller would lose their call
    --   with no push; answer_duo_pop answers already_matched without a lock the same way).
    select m.id, m.unmatched_at into v_existing_id, v_existing_unmatched
    from public.matches m
    where m.user_a_id = v_a and m.user_b_id = v_b;
    if v_existing_id is not null and v_existing_unmatched is not null then
      return next;
      return;
    end if;

    if v_existing_id is not null then
      v_match := v_existing_id;
    else
      -- A new match: the INSERT fires on_match_created, so both sides get the ordinary
      -- "New match!" push (for a call lock, "Duo locked: {name} answered your LFG post." to the
      -- caller only; send-push-notification reads locked_via after COMMIT). That is the whole
      -- notification design for this feature: no new category, no new setting.
      insert into public.matches (user_a_id, user_b_id)
      values (v_a, v_b)
      on conflict (user_a_id, user_b_id) do nothing
      returning id into v_match;
      if v_match is null then
        -- Lost a race with a deck swipe in the same instant (answer_duo_pop's rule): the match
        -- is theirs and ours alike, and still new to this call.
        select m.id, m.unmatched_at into v_match, v_existing_unmatched
        from public.matches m
        where m.user_a_id = v_a and m.user_b_id = v_b;
        if v_existing_unmatched is not null then
          return next;
          return;
        end if;
      end if;
    end if;
    matched := true;
    match_id := v_match;

    -- 0088 (c): the first NEW duo through a live call ends it.
    if v_existing_id is null
       and v_is_call and v_call_found
       and v_call.ended_at is null
       and v_call.locked_at is null
       and v_call.looking_until + interval '15 minutes' > now() then
      update public.queue_ups q
         set locked_by = v_me,
             locked_at = now(),
             locked_via = 'call',
             match_id = v_match
       where q.id = v_call.id
         and q.locked_at is null;
      if found then
        -- The caller has their duo: any OTHER queue-up of theirs whose code still works ends (a
        -- newer one they started inside this code's grace would otherwise stay live, pops and
        -- code, and could lock a second duo), and they leave Online Now.
        update public.queue_ups q
           set ended_at = now()
         where q.sender_id = v_row.inviter_id
           and q.id <> v_call.id
           and q.ended_at is null
           and q.locked_at is null
           and q.looking_until + interval '15 minutes' > now();
        update public.profiles p
           set is_looking_now = false,
               looking_now_expires_at = null
         where p.id = v_row.inviter_id
           and (coalesce(p.is_looking_now, false) or p.looking_now_expires_at is not null);

        -- And the redeemer has theirs: their own unlocked queue-ups whose code still works
        -- (the grace included) end, as answer_duo_pop does for the answerer.
        update public.queue_ups q
           set ended_at = now()
         where q.sender_id = v_me
           and q.ended_at is null
           and q.looking_until + interval '15 minutes' > now()
           and q.locked_at is null;
        if found then
          update public.profiles p
             set is_looking_now = false,
                 looking_now_expires_at = null
           where p.id = v_me;
        end if;
      end if;
    end if;
  end if;

  return next;
end;
$function$;

revoke execute on function public.accept_invite() from public, anon;
grant execute on function public.accept_invite() to authenticated, service_role;
