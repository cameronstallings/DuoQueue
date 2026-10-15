-- 0089: Party LFG posts. In a party of two, either member can share an LFG post with a code;
-- the first player who joins DuoQueue with it (or types it in) takes the party's third seat.
--
-- WHAT IT IS FOR. Cameron, 15 Oct 2026: "for the invite a third feature, you could also post an
-- LFG post with the invite code to find a third as well as swiping through the deck... if it says
-- use this code and join us through DuoQueue, that's good marketing too." The party deck stays
-- exactly as it is; this adds a second way to fill the seat, from anywhere a post can go. The
-- client half is build 20 (DuoQueue 1.0.2's party group, worktree b19-party).
--
-- ============================================================================
-- THE MODEL: AN ATOMIC JOIN, NOT AN INVITE
-- ============================================================================
--
-- A party code never creates a party_invites row. Joining is one call, join_party_by_code(code),
-- made from /invited AFTER the new player's card is saved (or from Matches by an existing
-- player). Under the party row lock it re-checks the post and the joiner, inserts the member,
-- marks the post filled, ends any other open post of the party, declines the party's other
-- pending deck invites (as 0070's respond_party_invite does when the last seat goes) and queues
-- the existing party_joined push ("{name} joined your party"). Why not an invite made at sign-up:
--   * sign-ups are abandoned at the wizard all the time, and each would leave a pending invite
--     holding the seat for 7 days;
--   * Stop post must stop the seat, not just the code;
--   * a block that removes a member must not re-open a post that already found its third;
--   * it would mean rebuilding respond_party_invite, which 1.0.1 calls.
-- So: respond_party_invite, get_my_party_invites, get_party_deck, perform_party_swipe and the
-- party_invites table are untouched, and 1.0.1 and build 19 behave exactly as before.
-- party_members gains two columns (joined_by_code false and lfg_seen_at null for every existing
-- and every deck-made row), and party_messages_select_member gains the code joiner's cutoff,
-- which reads exactly as before for every member who did not join by code.
--
-- Party codes share generate_call_code's alphabet, shape and namespace with invite codes and
-- Duo Call codes (0065, 0085), so the invite link, the front door's code field and
-- parseInviteCode all carry them. They are kept OUT of resolve_invite_code / redeem_invite_code /
-- accept_invite on purpose: those return one 1:1 inviter ("Duo with {name}") and write likes. On
-- 1.0.1 and build 19 a party code reads "That code did not work" (party LFG is a build 20
-- feature): do not post a party code publicly while the store serves an older build. A live
-- permanent invite code wins any collision, as it does for call codes.
--
-- ============================================================================
-- THE RULES
-- ============================================================================
--
-- Literals: PARTY_CALL_TTL = 2 hours (a guess; the post says "Code works until {time}").
-- CODE_GRACE = 15 minutes past expires_at (the Duo Call's grace for a code typed at the front
-- door and joined minutes later). PARTY_CAP = 3 (0070). HOP_CAP = 3 posts filled per joiner per
-- 24 hours (one account cannot hop into every party posted in a Discord).
--
-- Who can post (start_party_call): a member of a party of exactly two, onboarded, active, not
-- suspended or banned, whose two members share a LIVE 1:1 match (unmatched_at null) and are both
-- ready. Without the match rule, a stranger who joined by code and then blocked one founder would
-- be left in a party of two with the other founder and could post a new public code into that
-- person's party. Both members tapping at once get one post (the party row lock, then "a live
-- post is returned unchanged with already_live true"). A demo party may post; its code never
-- resolves (as with Duo Call; App Review's notes say so).
--
-- THE OTHER MEMBER CAN SEE AND STOP IT. A post is refused (party_not_ready, detail
-- 'partner_not_ready', a hint naming them) until every OTHER member has opened this party on a
-- build that shows the post and its Stop: party_members.lfg_seen_at, stamped by get_party_call
-- (build 20's party screen polls it; 1.0.1 and build 19 never call it, and have no Stop; a demo
-- persona counts as seen, so App Review's demo party can still post). Without
-- it a founder on an older build would get one chat line and no way to stop a stranger taking
-- the seat. A new post also writes PARTY_CALL_NOTE in the party chat from the poster (below):
-- who gets the seat, what they will see (both names and ages, and the chat from then on) and
-- where to stop it, so the other member hears through the existing party_message push.
-- This is "told, with Stop", not "asked first": the deck needs every member's like before an
-- invite, and a post needs only the poster's tap. Making the other member say yes before a code
-- goes live would need a client step (build 20 shares the code the moment start_party_call
-- returns), so it is Cameron's call, not this file's.
--
-- WHAT A CODE JOINER SEES. Their membership row says so (party_members.joined_by_code, below),
-- and party_messages_select_member shows them only messages created at or after their joined_at:
-- never the founders' chat from before they arrived. Deck joiners (every member liked them) and
-- founders read the whole chat, exactly as before. preview_party_code shows every member's name
-- and age before Join, as the deck invite does.
--
-- What a post's status is (party_call_status), in order:
--   null    no such post, or the sharer or any member is a demo account (the code never works);
--   ended   Stop post, or more than 15 minutes past expires_at;
--   full    a player already joined with it (filled_at), or the party has 3;
--   ended   the sharer is no longer a member, the party has fewer than 2, a member is not ready
--           (inactive, banned, suspended, not onboarded), or the two members no longer share a
--           live match;
--   live    otherwise.
-- "full" before the member checks: a block that removes the joiner leaves the post spoken for.
--
-- Who can join (party_code_joiner_ok), every refusal answered "unavailable" so a refusal never
-- reveals a block or a report: onboarded, active, not suspended or banned, not a demo account,
-- 18 or over; and against EVERY member: no block either way, the same age band, each side's age
-- range admits the other (floored at 18, duo_pop_recipients' rule), no report either way, no 1:1
-- pass either way, no unmatched match (someone already said no); and no party-deck pass by any
-- member of THIS party; and fewer than HOP_CAP posts filled in 24 hours. These are the "already
-- said no" and "not who I'm looking for" cases duo_pop_recipients, duo_pop_pair_ok and
-- answer_duo_pop respect. There is no 14-day new-account window: an existing player can join
-- from Matches.
--
-- A code joiner cannot evict a founder: handle_new_block is rebuilt so that when the BLOCKER
-- joined that party by code (party_members.joined_by_code, on the membership itself, so it lasts
-- exactly as long as they are in the party: no prune and no sharer deletion can lift it), the
-- blocker leaves instead of the blocked member. Deck parties behave exactly as before. It also
-- takes the party row lock (FOR NO KEY UPDATE, in id order) of every party either player is in
-- BEFORE it reads memberships, the lock join_party_by_code and respond_party_invite hold, so a
-- block and a join at the same instant run one after the other: the block's deletes see the
-- join's member row, or the join's checks see the block.
--
-- ============================================================================
-- THE RPCS (the build 20 contract; old builds call none of them)
-- ============================================================================
--
--   start_party_call(party)  authenticated  -> code, expires_at, game_id, game_name, already_live
--                                              (a new post raises party_not_ready, detail
--                                              partner_not_ready, with a hint naming the other
--                                              member, until their app has called get_party_call)
--   get_party_call(party)    authenticated  -> code, expires_at, game_id, game_name, sharer_id,
--                                              sharer_name, mine (0 rows: no live post); stamps
--                                              the caller's party_members.lfg_seen_at
--   end_party_call(party)    authenticated  -> void (idempotent)
--   resolve_party_code(code) anon + auth    -> status, sharer_name, game_name (names only when
--                                              live; 0 rows: not a party code)
--   preview_party_code(code) authenticated  -> status, sharer_name, game_name, member_name,
--                                              member_age (one row per member when live and the
--                                              caller may join; else one status row; 0 rows:
--                                              not a party code)
--   join_party_by_code(code) authenticated  -> result ('joined', 'member', 'full', 'ended',
--                                              'unavailable'), party_id (joined or member only)
-- Helpers with no client grant: party_call_status, party_call_for_code, party_code_joiner_ok,
-- prune_party_calls, generate_call_code. party_message_visible is granted to authenticated only
-- because party_messages' select policy calls it (policies run as the querying role); it answers
-- only about the caller (auth.uid()).
--
-- ============================================================================
-- RETENTION AND DELETION (App Store 5.1.1(v))
-- ============================================================================
--
-- prune_party_calls() deletes posts older than 30 days, daily at 09:58 UTC
-- (party-calls-prune-daily; :58 was unused on cron.job, read 15 Oct 2026). Deleting the sharer's
-- account deletes their posts (sharer_id CASCADE); deleting a party deletes its posts; deleting
-- the joiner's account nulls filled_by (the post stays "full"). No id arrays, so no forget
-- trigger. Attribution: party_calls.filled_by within those 30 days, plus App Store installs
-- from ct=invite. party_members.joined_by_code and lfg_seen_at live and die with the membership
-- row (leaving, a block, account or party deletion).
--
-- ============================================================================
-- BEFORE BUILD 20 GOES TO REVIEW (not done by this file)
-- ============================================================================
--
--   * Privacy policy, one bullet: a party's LFG post keeps its code, who shared it and who
--     joined with it, deleted after 30 days and when either account is deleted; whether a
--     member joined by code is kept with their party membership and goes when they leave.
--   * App Review note, one line: a demo party's code never resolves, so a reviewer cannot join a
--     party with one.
--   * Plan docs/superpowers/plans/2026-10-15-build-19.md has only the Duo Pops / Duo Calls
--     privacy bullet today; add the party one beside it.
--
-- ============================================================================
-- KILL SWITCHES
-- ============================================================================
--
--   Hide Share LFG post in build 20 (it    revoke execute on function public.get_party_call(uuid), public.start_party_call(uuid) from authenticated;
--     treats 42501 as "not available"):
--   End every live post now (codes stop   update public.party_calls set ended_at = now() where ended_at is null and filled_at is null;
--     resolving and joining at once):
--   Stop joining by code entirely:        revoke execute on function public.join_party_by_code(text) from authenticated;
--   Stop the retention sweep:             select cron.unschedule('party-calls-prune-daily');
--
-- Independent of 0088. Apply any time before build 20 goes to review: nothing calls it before.
-- Checks: supabase/checks/0089_party_lfg.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. party_calls: one row per shared post
-- ---------------------------------------------------------------------------
create table if not exists public.party_calls (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid not null references public.parties (id) on delete cascade,
  -- Who shared it, and so whose rank and region the post carries.
  sharer_id   uuid not null references public.profiles (id) on delete cascade,
  -- The game the post names (a game both members have, when there is one).
  game_id     uuid references public.games (id) on delete set null,
  -- generate_call_code(): the same alphabet and shape as invite_codes.code (0065).
  code        text not null,
  created_at  timestamptz not null default now(),
  -- created_at + PARTY_CALL_TTL (2 hours). The code still works CODE_GRACE (15 minutes) past it.
  expires_at  timestamptz not null,
  -- Stop post, by either member.
  ended_at    timestamptz,
  -- The player who took the seat with it, and when. filled_by is SET NULL when that account is
  -- deleted; filled_at stays, so the post stays "full".
  filled_at   timestamptz,
  filled_by   uuid references public.profiles (id) on delete set null,
  constraint party_calls_code_shape check (code ~ '^[0-9A-HJKMNP-TV-Z]{10}$'),
  constraint party_calls_ttl check (expires_at > created_at and expires_at <= created_at + interval '2 hours'),
  -- One-way, like queue_ups' locked_by (0085's departure 2): deleting the joiner must not fail.
  constraint party_calls_filled_by_needs_filled_at check (filled_by is null or filled_at is not null)
);

create unique index if not exists party_calls_code_key on public.party_calls (code);
create index if not exists party_calls_party_created_idx on public.party_calls (party_id, created_at desc);
create index if not exists party_calls_created_at_idx on public.party_calls (created_at);
-- HOP_CAP: posts a joiner filled in the last 24 hours.
create index if not exists party_calls_filled_by_idx on public.party_calls (filled_by, filled_at) where filled_by is not null;
create index if not exists party_calls_sharer_idx on public.party_calls (sharer_id);

-- Server-only, both ways (0085's pattern; from 30 Oct 2026 nothing is auto-granted, service_role
-- included).
alter table public.party_calls enable row level security;
revoke all on public.party_calls from public, anon, authenticated;
grant select, insert, update, delete on public.party_calls to service_role;

comment on table public.party_calls is
  'One row per party LFG post (0089): the code a party of two shares to find its third. Server-only: reached through start_party_call, get_party_call, end_party_call, resolve_party_code, preview_party_code, join_party_by_code, prune_party_calls and the service role. Pruned at 30 days.';

-- ---------------------------------------------------------------------------
-- 1b. On the membership: how they joined, and whether their app can show a post
-- ---------------------------------------------------------------------------
-- Constant defaults, so both adds are catalog-only (no table rewrite). Clients cannot write
-- either: party_members has no INSERT or UPDATE policy (0026), so only SECURITY DEFINER
-- functions do. Members can read both through party_members_select_member, which is fine: the
-- founders know who came in by code.
alter table public.party_members
  add column if not exists joined_by_code boolean not null default false;
alter table public.party_members
  add column if not exists lfg_seen_at timestamptz;

comment on column public.party_members.joined_by_code is
  'True when this member took the seat with a party LFG post''s code (0089 join_party_by_code). They read party chat only from joined_at, and blocking another member removes them, not that member (handle_new_block). Lives exactly as long as the membership.';
comment on column public.party_members.lfg_seen_at is
  'First time this member''s app read the party''s LFG post (0089 get_party_call: build 20 and later), so it can show a post and its Stop. start_party_call refuses while any other member has none.';

-- What a member may read of the party chat: everything, unless they joined by code, and then
-- only from the moment they joined. About the CALLER only (auth.uid()), so calling it directly
-- tells a client nothing about anyone else. SECURITY DEFINER because party_messages' policy
-- runs as the querying role and party_members is itself behind RLS.
create or replace function public.party_message_visible(p_party_id uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.party_members pm
    where pm.party_id = p_party_id
      and pm.profile_id = auth.uid()
      and (not pm.joined_by_code or p_created_at >= pm.joined_at)
  );
$fn$;

revoke execute on function public.party_message_visible(uuid, timestamptz) from public, anon;
grant execute on function public.party_message_visible(uuid, timestamptz) to authenticated, service_role;

-- 0026's policy was is_party_member(party_id, auth.uid()) for PUBLIC. Now TO authenticated (anon
-- never matched anyway: auth.uid() is null) and through the helper above, which is the same test
-- plus the code joiner's cutoff. Realtime evaluates this same policy per subscriber, so a code
-- joiner's live feed starts at their join too.
drop policy if exists party_messages_select_member on public.party_messages;
create policy party_messages_select_member on public.party_messages
  for select to authenticated
  using (public.party_message_visible(party_id, created_at));

-- ---------------------------------------------------------------------------
-- 2. One code namespace: call codes, party codes and invite codes never collide
-- ---------------------------------------------------------------------------
-- generate_call_code, rebuilt from its LIVE definition (0085's): it also rejects any code on file
-- in party_calls. Duo Call and party codes share this one generator. ACL unchanged (no client
-- grant).
create or replace function public.generate_call_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_code text;
  i int;
begin
  for i in 1..5 loop
    v_code := public.generate_invite_code();
    if not exists (select 1 from public.invite_codes ic where ic.code = v_code)
       and not exists (select 1 from public.queue_ups q where q.call_code = v_code)
       and not exists (select 1 from public.party_calls pc where pc.code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'call_code_generation_failed';
end;
$fn$;

revoke execute on function public.generate_call_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Helpers (no client grant)
-- ---------------------------------------------------------------------------

-- The post a typed or pasted code names, or null: any case, any punctuation, I/L/O read as 1/1/0
-- (normalize_invite_code), the right shape, not somebody's live permanent invite code (that one
-- wins, as it does for call codes), and shared in the last 7 days.
create or replace function public.party_call_for_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select pc.id
  from public.party_calls pc
  where pc.code = public.normalize_invite_code(p_code)
    and public.normalize_invite_code(p_code) ~ '^[0-9A-HJKMNP-TV-Z]{10}$'
    and pc.created_at > now() - interval '7 days'
    and not exists (
      select 1 from public.invite_codes ic
      where ic.code = public.normalize_invite_code(p_code) and ic.revoked_at is null
    )
  limit 1;
$fn$;

revoke execute on function public.party_call_for_code(text) from public, anon, authenticated;

-- The post's status: null, 'ended', 'full' or 'live'. The order is the header's.
create or replace function public.party_call_status(p_call_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_call public.party_calls%rowtype;
  v_members uuid[];
begin
  select * into v_call from public.party_calls pc where pc.id = p_call_id;
  if not found then
    return null;
  end if;

  select coalesce(array_agg(pm.profile_id order by pm.profile_id), '{}')
    into v_members
  from public.party_members pm
  where pm.party_id = v_call.party_id;

  -- Demo isolation: a demo account's party code never works for anyone.
  if exists (
    select 1 from public.profiles p
    where (p.id = any (v_members) or p.id = v_call.sharer_id) and p.is_demo
  ) then
    return null;
  end if;

  if v_call.ended_at is not null or v_call.expires_at + interval '15 minutes' <= now() then
    return 'ended';
  end if;

  if v_call.filled_at is not null or cardinality(v_members) >= 3 then
    return 'full';
  end if;

  if cardinality(v_members) < 2 or not (v_call.sharer_id = any (v_members)) then
    return 'ended';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = any (v_members)
      and not (p.is_active and p.onboarding_completed
               and not coalesce(p.is_banned, false) and not p.is_admin_suspended)
  ) then
    return 'ended';
  end if;

  if not exists (
    select 1 from public.matches m
    where m.user_a_id = least(v_members[1], v_members[2])
      and m.user_b_id = greatest(v_members[1], v_members[2])
      and m.unmatched_at is null
  ) then
    return 'ended';
  end if;

  return 'live';
end;
$fn$;

revoke execute on function public.party_call_status(uuid) from public, anon, authenticated;

-- May p_joiner take the last seat in p_party_id by code? The header's joiner rules; false for
-- every refusal alike.
create or replace function public.party_code_joiner_ok(p_party_id uuid, p_joiner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((
    select j.is_active
       and j.onboarding_completed
       and not j.is_admin_suspended
       and not coalesce(j.is_banned, false)
       and not j.is_demo
       and j.dob is not null
       and extract(year from age(current_date, j.dob))::int >= 18
       and not exists (
         select 1
         from public.party_members pm
         join public.profiles mp on mp.id = pm.profile_id
         left join public.preferences mpr on mpr.profile_id = pm.profile_id
         where pm.party_id = p_party_id
           and (
             pm.profile_id = j.id
             or public.is_blocked_pair(pm.profile_id, j.id)
             or not coalesce(public.same_age_band(pm.profile_id, j.id), false)
             -- Each side's age range admits the other, floored at 18 (duo_pop_recipients' and
             -- the deck's rule): a member who looks for 25 to 32 is not handed a 45-year-old,
             -- and the joiner's own range counts too. No preferences row reads 18 to 99.
             or not coalesce(
               extract(year from age(current_date, j.dob))::int
                 between greatest(coalesce(mpr.min_age, 18), 18) and coalesce(mpr.max_age, 99)
               and extract(year from age(current_date, mp.dob))::int
                 between greatest(coalesce(jpr.min_age, 18), 18) and coalesce(jpr.max_age, 99),
               false)
             or exists (
               select 1 from public.reports rep
               where (rep.reporter_profile_id = pm.profile_id and rep.reported_profile_id = j.id)
                  or (rep.reporter_profile_id = j.id and rep.reported_profile_id = pm.profile_id)
             )
             or exists (
               select 1 from public.swipes w
               where w.action = 'pass'
                 and ((w.swiper_id = pm.profile_id and w.target_id = j.id)
                   or (w.swiper_id = j.id and w.target_id = pm.profile_id))
             )
             or exists (
               select 1 from public.matches m
               where m.user_a_id = least(pm.profile_id, j.id)
                 and m.user_b_id = greatest(pm.profile_id, j.id)
                 and m.unmatched_at is not null
             )
           )
       )
       and not exists (
         select 1 from public.party_swipes ps
         where ps.party_id = p_party_id and ps.target_id = j.id and ps.action = 'pass'
       )
       -- HOP_CAP = 3 posts filled in 24 hours.
       and (
         select count(*) from public.party_calls pc
         where pc.filled_by = j.id and pc.filled_at > now() - interval '24 hours'
       ) < 3
    from public.profiles j
    left join public.preferences jpr on jpr.profile_id = j.id
    where j.id = p_joiner
  ), false);
$fn$;

revoke execute on function public.party_code_joiner_ok(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The party's side: share, read, stop
-- ---------------------------------------------------------------------------

-- Share LFG post. Returns the live post when there already is one (already_live true, nothing
-- written), so both members share one code and two taps at once get one row. A NEW post needs
-- every other member's lfg_seen_at (the header's THE OTHER MEMBER CAN SEE AND STOP IT): else it
-- raises party_not_ready with detail 'partner_not_ready' and a hint that names them, which
-- build 20 shows as it is (partyLfgErrorMessage shows any P0001 hint). A NEW post also writes
-- PARTY_CALL_NOTE in the party chat from the caller:
--   "I made an LFG post to find our third. The first player who joins with its code in the
--    next 2 hours gets the spot. They'll see our names and ages, and our chat from when they
--    join. You can stop the post on our party screen."
-- "made", not "shared": it is written here, before the sharer's share sheet opens, and stays true
-- if they cancel the sheet or it fails (the code exists either way; either member can Stop it).
-- Inside its own exception block, because enforce_message_send_guard raises at 8 messages in 10
-- seconds and that must never fail the post.
create or replace function public.start_party_call(p_party_id uuid)
returns table(code text, expires_at timestamptz, game_id uuid, game_name text, already_live boolean)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_members uuid[];
  v_call public.party_calls%rowtype;
  v_game uuid;
  v_unseen text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('party_call', 10, interval '1 hour');

  select * into v_profile from public.profiles p where p.id = v_me;
  if not found
     or not v_profile.onboarding_completed
     or not v_profile.is_active
     or v_profile.is_admin_suspended then
    raise exception 'profile_not_ready'
      using hint = 'Finish setting up your profile first.';
  end if;
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;

  -- 0070's party row lock: posts, joins, Stop, deck likes, accepts and blocks touching this party
  -- run one at a time.
  perform 1 from public.parties pa where pa.id = p_party_id for no key update;

  -- The caller's app can show a post: it just asked to make one.
  update public.party_members pm
     set lfg_seen_at = now()
   where pm.party_id = p_party_id and pm.profile_id = v_me and pm.lfg_seen_at is null;

  select coalesce(array_agg(pm.profile_id order by pm.profile_id), '{}')
    into v_members
  from public.party_members pm
  where pm.party_id = p_party_id;

  if cardinality(v_members) >= 3 then
    raise exception 'This party is already full. Parties hold 3 players.'
      using detail = 'party_full';
  end if;
  if cardinality(v_members) < 2
     -- The two must share a live 1:1 match (see the header).
     or not exists (
       select 1 from public.matches m
       where m.user_a_id = least(v_members[1], v_members[2])
         and m.user_b_id = greatest(v_members[1], v_members[2])
         and m.unmatched_at is null
     )
     or exists (
       select 1 from public.profiles p
       where p.id = any (v_members)
         and not (p.is_active and p.onboarding_completed
                  and not coalesce(p.is_banned, false) and not p.is_admin_suspended)
     ) then
    raise exception 'party_not_ready'
      using detail = 'party_not_ready',
            hint = 'A party needs two players before it can look for a third.';
  end if;

  -- Already posted (by either member): the same post, nothing written.
  select * into v_call
  from public.party_calls pc
  where pc.party_id = p_party_id
    and pc.ended_at is null
    and pc.filled_at is null
    and pc.expires_at > now()
  order by pc.created_at desc
  limit 1;
  if found then
    return query
    select v_call.code, v_call.expires_at, v_call.game_id, g.name, true
    from (select 1) one
    left join public.games g on g.id = v_call.game_id;
    return;
  end if;

  -- A new post only when every other member's app can show it and its Stop (lfg_seen_at, from
  -- get_party_call). 1.0.1 and build 19 never set it. A demo persona never opens the app and is
  -- nobody to protect, so it counts as seen: App Review's demo party can still show the flow
  -- (its code never resolves).
  select coalesce(nullif(btrim(p.display_name), ''), 'Your partner') into v_unseen
  from public.party_members pm
  join public.profiles p on p.id = pm.profile_id
  where pm.party_id = p_party_id
    and pm.profile_id <> v_me
    and pm.lfg_seen_at is null
    and not p.is_demo
  order by pm.joined_at asc, pm.profile_id asc
  limit 1;
  if v_unseen is not null then
    raise exception 'party_not_ready'
      using detail = 'partner_not_ready',
            hint = format('Ask %s to open this party on the latest DuoQueue first. Then they can see your post and stop it.', v_unseen);
  end if;

  -- The game: the caller's first game (by priority, then age) that every other member also
  -- has; else the caller's first game; else none.
  select pg.game_id into v_game
  from public.profile_games pg
  where pg.profile_id = v_me
    and not exists (
      select 1 from unnest(v_members) o(id)
      where o.id <> v_me
        and not exists (
          select 1 from public.profile_games pg2 where pg2.profile_id = o.id and pg2.game_id = pg.game_id
        )
    )
  order by pg.priority asc nulls last, pg.created_at asc
  limit 1;
  if v_game is null then
    select pg.game_id into v_game
    from public.profile_games pg
    where pg.profile_id = v_me
    order by pg.priority asc nulls last, pg.created_at asc
    limit 1;
  end if;

  insert into public.party_calls as pc (party_id, sharer_id, game_id, code, created_at, expires_at)
  values (p_party_id, v_me, v_game, public.generate_call_code(), now(), now() + interval '2 hours')
  returning pc.* into v_call;

  -- The other member hears about it through the existing party_message push, and is told what
  -- the joiner will see and where Stop is.
  begin
    insert into public.party_messages (party_id, sender_id, content)
    values (
      p_party_id, v_me,
      'I made an LFG post to find our third. The first player who joins with its code in the next 2 hours gets the spot. They''ll see our names and ages, and our chat from when they join. You can stop the post on our party screen.'
    );
  exception when others then
    null;
  end;

  return query
  select v_call.code, v_call.expires_at, v_call.game_id, g.name, false
  from (select 1) one
  left join public.games g on g.id = v_call.game_id;
end;
$fn$;

revoke execute on function public.start_party_call(uuid) from public, anon;
grant execute on function public.start_party_call(uuid) to authenticated, service_role;

-- The party's live post, for BOTH members (so the one who did not share sees it and can Stop
-- it), or zero rows: none, Stopped, filled, past expires_at, or the party is not two. A demo
-- party's post shows (its code just never resolves). Also stamps the caller's lfg_seen_at.
create or replace function public.get_party_call(p_party_id uuid)
returns table(
  code text, expires_at timestamptz, game_id uuid, game_name text,
  sharer_id uuid, sharer_name text, mine boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  perform public.check_rate_limit('get_party_call', 60, interval '1 minute');
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;

  -- This member's app reads the post, so it can show one and its Stop: the other member may now
  -- share (start_party_call). Written once; every later poll matches no row. No party lock: a
  -- start_party_call holding it reads this row after it commits, and the stamp only ever goes
  -- from null to a time.
  update public.party_members pm
     set lfg_seen_at = now()
   where pm.party_id = p_party_id and pm.profile_id = v_me and pm.lfg_seen_at is null;

  if (select count(*) from public.party_members pm where pm.party_id = p_party_id) <> 2 then
    return;
  end if;

  return query
  select pc.code, pc.expires_at, pc.game_id, g.name, pc.sharer_id, sp.display_name, pc.sharer_id = v_me
  from public.party_calls pc
  left join public.games g on g.id = pc.game_id
  left join public.profiles sp on sp.id = pc.sharer_id
  where pc.party_id = p_party_id
    and pc.ended_at is null
    and pc.filled_at is null
    and pc.expires_at > now()
    and coalesce(public.party_call_status(pc.id), 'live') = 'live'
  order by pc.created_at desc
  limit 1;
end;
$fn$;

revoke execute on function public.get_party_call(uuid) from public, anon;
grant execute on function public.get_party_call(uuid) to authenticated, service_role;

-- Stop post: either member withdraws the party's post. Takes the party row lock, so a Stop and a
-- join run one after the other: once Stop commits, nobody can join with that code. Idempotent.
create or replace function public.end_party_call(p_party_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  perform public.check_rate_limit('end_party_call', 20, interval '1 hour');
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;

  perform 1 from public.parties pa where pa.id = p_party_id for no key update;

  update public.party_calls pc
     set ended_at = now()
   where pc.party_id = p_party_id
     and pc.ended_at is null
     and pc.filled_at is null
     and pc.expires_at + interval '15 minutes' > now();
end;
$fn$;

revoke execute on function public.end_party_call(uuid) from public, anon;
grant execute on function public.end_party_call(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. The joiner's side: resolve, preview, join
-- ---------------------------------------------------------------------------

-- What a party code is, before there is an account (the front door and Save run it as anon) or
-- just after (the redemption hook). One row: status 'live', 'full' or 'ended'; the sharer's
-- display name and the game ONLY when live, never the other member's name. Zero rows when the
-- string is not a party code (the app then tries it as an invite or call code), when it is a
-- live permanent invite code, or for a demo party. No rate limit, like resolve_invite_code: a
-- code is 50 random bits.
create or replace function public.resolve_party_code(p_code text)
returns table(status text, sharer_name text, game_name text)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    s.st,
    case when s.st = 'live' then sp.display_name end,
    case when s.st = 'live' then g.name end
  from (
    select pc.sharer_id, pc.game_id, public.party_call_status(pc.id) as st
    from public.party_calls pc
    where pc.id = public.party_call_for_code(p_code)
  ) s
  left join public.profiles sp on sp.id = s.sharer_id
  left join public.games g on g.id = s.game_id
  where s.st is not null;
$fn$;

revoke execute on function public.resolve_party_code(text) from public;
grant execute on function public.resolve_party_code(text) to anon, authenticated, service_role;

-- What /invited shows before Join the party. Only for a signed-in, onboarded caller.
--   live and the caller may join: one row per member (oldest first), each with status 'live',
--     the sharer's name, the game, and that member's display name and AGE (ages stay; the same
--     data the pending-invite RLS showed for a deck invite);
--   already a member: one row, status 'member' (the app calls join_party_by_code, which answers
--     'member' with the party id, and opens the chat);
--   otherwise one row with only status: 'full', 'ended' or 'unavailable';
--   not a party code: zero rows.
-- No side effects besides the rate-limit hit: previewing never holds the seat.
create or replace function public.preview_party_code(p_code text)
returns table(status text, sharer_name text, game_name text, member_name text, member_age integer)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_call public.party_calls%rowtype;
  v_status text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('preview_party_code', 30, interval '1 hour');
  if not exists (select 1 from public.profiles p where p.id = v_me and p.onboarding_completed) then
    raise exception 'profile_not_ready'
      using hint = 'Finish setting up your profile first.';
  end if;

  select * into v_call from public.party_calls pc where pc.id = public.party_call_for_code(p_code);
  if not found then
    return;
  end if;
  v_status := public.party_call_status(v_call.id);
  if v_status is null then
    return;
  end if;

  if public.is_party_member(v_call.party_id, v_me) then
    return query select 'member'::text, null::text, null::text, null::text, null::integer;
    return;
  end if;
  if v_status <> 'live' then
    return query select v_status, null::text, null::text, null::text, null::integer;
    return;
  end if;
  if not public.party_code_joiner_ok(v_call.party_id, v_me) then
    return query select 'unavailable'::text, null::text, null::text, null::text, null::integer;
    return;
  end if;

  return query
  select
    'live'::text,
    sp.display_name,
    g.name,
    p.display_name,
    extract(year from age(current_date, p.dob))::int
  from public.party_members pm
  join public.profiles p on p.id = pm.profile_id
  left join public.profiles sp on sp.id = v_call.sharer_id
  left join public.games g on g.id = v_call.game_id
  where pm.party_id = v_call.party_id
  order by pm.joined_at asc, pm.profile_id asc;
end;
$fn$;

revoke execute on function public.preview_party_code(text) from public, anon;
grant execute on function public.preview_party_code(text) to authenticated, service_role;

-- Join the party: the one write a party code can cause. Under the party row lock it re-reads the
-- post and the joiner, then inserts the member, marks the post filled, declines the party's other
-- pending invites (0070's "the party is full now") and queues the existing party_joined push to
-- the members ("{name} joined your party", send-push-notification's notifyPartyJoined, which
-- checks the joiner is a member when it runs). result:
--   'joined'      the caller is now the third member; party_id is the party.
--   'member'      the caller was already in it; party_id is the party (open the chat).
--   'full'        someone else took the seat first.
--   'ended'       Stop post, past expires_at plus 15 minutes, or the party changed under it.
--   'unavailable' any joiner rule failed (never says which).
-- Zero rows when the string is not a party code. Raises only for no session, a ban, a caller who
-- has not finished their card ('profile_not_ready') and the rate limit.
create or replace function public.join_party_by_code(p_code text)
returns table(result text, party_id uuid)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_call_id uuid;
  v_party uuid;
  v_call public.party_calls%rowtype;
  v_status text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  perform public.check_rate_limit('join_party_by_code', 10, interval '1 hour');
  if not exists (select 1 from public.profiles p where p.id = v_me and p.onboarding_completed) then
    raise exception 'profile_not_ready'
      using hint = 'Finish setting up your profile first.';
  end if;

  v_call_id := public.party_call_for_code(p_code);
  if v_call_id is null then
    return;
  end if;
  select pc.party_id into v_party from public.party_calls pc where pc.id = v_call_id;

  -- 0070's party row lock, then everything is read fresh.
  perform 1 from public.parties pa where pa.id = v_party for no key update;
  select * into v_call from public.party_calls pc where pc.id = v_call_id for update;
  if not found then
    return;
  end if;

  v_status := public.party_call_status(v_call.id);
  if v_status is null then
    return;
  end if;
  if public.is_party_member(v_call.party_id, v_me) then
    return query select 'member'::text, v_call.party_id;
    return;
  end if;
  if v_status <> 'live' then
    return query select v_status, null::uuid;
    return;
  end if;
  if not public.party_code_joiner_ok(v_call.party_id, v_me) then
    return query select 'unavailable'::text, null::uuid;
    return;
  end if;

  -- joined_by_code: their chat starts at joined_at (party_message_visible), and a block of
  -- theirs removes them, not the founder (handle_new_block).
  insert into public.party_members (party_id, profile_id, joined_by_code) values (v_call.party_id, v_me, true);

  update public.party_calls pc
     set filled_at = now(),
         filled_by = v_me
   where pc.id = v_call.id;

  -- Any other post of this party still open (a second one shared while the first sat in its
  -- 15-minute grace) ends with it: one join fills the seat, and every code of the party stops,
  -- even if the seat later opens again (a block). The founders can always share a new one.
  update public.party_calls pc
     set ended_at = now()
   where pc.party_id = v_call.party_id
     and pc.id <> v_call.id
     and pc.ended_at is null
     and pc.filled_at is null;

  -- The party is full now: no deck invite into it can be honoured (0070:353-356).
  update public.party_invites pi
     set status = 'declined'
   where pi.party_id = v_call.party_id and pi.status = 'pending';

  perform public.notify_via_edge_function(
    jsonb_build_object('type', 'party_joined', 'partyId', v_call.party_id, 'joinerId', v_me)
  );

  return query select 'joined'::text, v_call.party_id;
end;
$fn$;

revoke execute on function public.join_party_by_code(text) from public, anon;
grant execute on function public.join_party_by_code(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. A code joiner cannot evict a founder
-- ---------------------------------------------------------------------------
-- handle_new_block, rebuilt from its LIVE definition (0031's, read 15 Oct 2026). Two things
-- added, both marked 0089:
--   * in a party the BLOCKER joined by code (their own party_members.joined_by_code), the
--     blocker leaves instead of the blocked member. The flag is on the membership, so it holds
--     for as long as they are in the party: the 30-day prune of party_calls and the sharer's
--     account deletion (party_calls.sharer_id CASCADE) cannot lift it. Everywhere else (every
--     deck party, every founder) the blocked user is removed exactly as before, so 1.0.1 is
--     unchanged.
--   * it first takes the party row lock of every party either player is in, in id order: the
--     lock join_party_by_code and respond_party_invite hold while they check for blocks and add
--     a member. A join in flight finishes first and every statement below (each takes a fresh
--     snapshot: this is a VOLATILE plpgsql function under READ COMMITTED) sees its member row;
--     a join that starts after waits for this block and its checks see it. Taken before the
--     matches UPDATE, and no path that holds a party lock waits on a matches row, so this adds
--     no lock cycle.
-- Same trigger, same signature, no client grant.
create or replace function public.handle_new_block()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- 0089: the party locks first (see above).
  perform 1 from public.parties pa
   where pa.id in (
     select pm.party_id from public.party_members pm
     where pm.profile_id in (new.blocker_id, new.blocked_id)
   )
   order by pa.id
   for no key update;

  update public.matches
  set unmatched_at = now(), unmatched_by = new.blocker_id
  where unmatched_at is null
    and ((user_a_id = new.blocker_id and user_b_id = new.blocked_id)
      or (user_a_id = new.blocked_id and user_b_id = new.blocker_id));

  -- 0089: a player who joined a party with its LFG code and then blocks another member of it
  -- leaves that party themselves; the members they found there stay.
  delete from public.party_members pm
  where pm.profile_id = new.blocker_id
    and pm.joined_by_code
    and exists (
      select 1 from public.party_members other
      where other.party_id = pm.party_id and other.profile_id = new.blocked_id
    );

  -- Parties containing both of them: remove the blocked user, and drop any invite
  -- either direction.
  delete from public.party_members pm
  where pm.profile_id = new.blocked_id
    and exists (
      select 1 from public.party_members other
      where other.party_id = pm.party_id and other.profile_id = new.blocker_id
    );

  delete from public.party_invites pi
  where (pi.target_id = new.blocked_id
         and exists (select 1 from public.party_members pm
                     where pm.party_id = pi.party_id and pm.profile_id = new.blocker_id))
     or (pi.target_id = new.blocker_id
         and exists (select 1 from public.party_members pm
                     where pm.party_id = pi.party_id and pm.profile_id = new.blocked_id));

  return new;
end;
$function$;

revoke execute on function public.handle_new_block() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Retention
-- ---------------------------------------------------------------------------
create or replace function public.prune_party_calls()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  delete from public.party_calls where created_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke execute on function public.prune_party_calls() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'party-calls-prune-daily') then
    perform cron.unschedule('party-calls-prune-daily');
  end if;
end;
$$;

select cron.schedule(
  'party-calls-prune-daily',
  '58 9 * * *',
  $$select public.prune_party_calls()$$
);
