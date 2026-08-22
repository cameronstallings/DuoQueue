-- 0065: invite your duo. The graph of who brought whom, and the two consents that turn
-- an invite into a match.
--
-- 0065 and not 0064: supabase_migrations.schema_migrations on the live cluster ends at
-- 0064 (checked, not inferred), and 0064_schedule_new_player_alerts.sql is the highest
-- file in this directory. No gap, so this is simply the next number.
--
-- WHY THIS EXISTS, AND WHY IT IS DIFFERENT FROM EVERY OTHER ACQUISITION CHANNEL.
--
-- 0063 made a signup reactivate whoever was already waiting. This is the half that brings
-- the signup. Every other channel delivers a stranger into an empty deck; an invite
-- delivers somebody who already has one real profile with real overlap waiting for them,
-- because the person who sent the link is a gamer they already play with. That is the
-- whole argument for building this before anything else at four users, and it is also why
-- the schema below is a graph and not a counter: "how many installs came from invites" is
-- a number, but "who brought whom, and did they connect" is the loop.
--
-- ============================================================================
-- D1. TWO CONSENTS, NOT ONE. THE INVITE IS NOT A MATCH.
-- ============================================================================
--
-- The tempting shape is: redeeming a code creates a match, because obviously the inviter
-- wants to be matched with the person they invited. Rejected as stated, because an invite
-- code is stable and shareable -- somebody can paste theirs into a 500-person Discord --
-- and "the inviter consented once, forever, to anyone who has the string" is not a
-- consent model this schema should learn.
--
-- What is here instead: sending the link is the inviter's standing intent, and
-- accept_invite() is the invitee's. Both are recorded as ordinary rows in public.swipes,
-- so the match that results is the same object, with the same unmatch, block and report
-- paths, as one that came out of the deck. Nothing downstream has to know an invite
-- happened.
--
-- The standing intent is bounded rather than unlimited: rate limit 3 below caps how many
-- of those inviter-side likes get written in a day. Past the cap the invitee's like is
-- still written, so the connection is offered rather than lost -- it just arrives as a duo
-- request instead of a match.
--
-- ============================================================================
-- D2. ATTRIBUTION IS ONE ROW PER INVITEE, AND IT IS WRITTEN BEFORE THEY CONNECT
-- ============================================================================
--
-- invite_redemptions' primary key is the INVITEE. A person has exactly one inviter,
-- forever, and it is whoever's code they redeemed first. That makes "which installs came
-- from an invite" a count of rows rather than a join with a tie-break rule, and it makes
-- the answer stable: a second code cannot overwrite the first.
--
-- The row is written when the code is redeemed, which happens as soon as the invited
-- person has a session -- BEFORE onboarding, and whether or not they ever tap "duo up".
-- Attribution therefore survives an abandoned onboarding, which is precisely the case a
-- growth loop most needs to see. connected_at is the separate, later fact.
--
-- THE MEASUREMENT QUERY, so it lives next to the schema rather than in someone's history:
--
--   select
--     count(*)                                        as invited_signups,
--     count(*) filter (where connected_at is not null) as connected,
--     count(distinct inviter_id)                       as inviters
--   from public.invite_redemptions
--   where redeemed_at > now() - interval '30 days';
--
-- ============================================================================
-- D3. THE 14 DAY REDEMPTION WINDOW
-- ============================================================================
--
-- A code can only be redeemed by an account created in the last 14 days. Without a window
-- the stable code means a two-year-old account could claim an invite tomorrow, and the
-- number this table exists to produce would stop meaning "this install came from an
-- invite".
--
-- 14 days rather than "before onboarding completes", which was the first draft: somebody
-- who installs from the App Store, finishes onboarding, and only then remembers the code
-- their friend sent is a real invited install, and refusing them would both lose the
-- attribution and lose the connection. Anchored on profiles.created_at, which
-- handle_new_user writes and no client can update.
--
-- ============================================================================
-- D4. WHO CAN CALL WHAT
-- ============================================================================
--
-- Three of the four functions here are authenticated-only. resolve_invite_code is
-- deliberately callable by `anon`, and that is the one grant in this file worth arguing
-- for rather than assuming.
--
-- WHY IT HAS TO BE. The invited person's first screen in the app is the sign-up form, and
-- they have no account yet. If the app cannot resolve a code before they have a session
-- then a typo is only discovered after they have created an account, and the sign-up
-- screen cannot say whose invite it is -- which is the entire point of an invite arrival.
--
-- WHAT IT DISCLOSES, EXACTLY. Given a code, one display name. Nothing else: no id-to-code
-- direction, no listing, no enumeration by profile. The code is a 10-character Crockford
-- base32 string drawn from gen_random_uuid()'s CSPRNG bytes -- 50 bits, and 256 % 32 = 0
-- so the byte-to-symbol map is unbiased. At a thousand guesses a second that is ~35,000
-- years to a single hit, and a hit yields a display name that every signed-in user can
-- already see in the deck. The function also refuses anything that is not exactly the
-- code shape before it touches the table, so a prober cannot use it as a SQL-shaped
-- oracle either.
--
-- WHAT IT DOES NOT HAVE. A rate limit. check_rate_limit is keyed on auth.uid(), which is
-- null for anon, and adding an ip-hash table for this one endpoint would be building
-- 0061's abuse accounting a second time for a lookup that returns a first name. Stated so
-- it is a decision on the record rather than an oversight; if the endpoint is ever seen
-- being hammered, the cheap fix is to move resolution behind the invite Edge Function,
-- which is already service-role and can carry the same ip-hash bucket the waitlist uses.
--
-- ============================================================================
-- D5. RLS AND REVOKE, BOTH, AGAIN
-- ============================================================================
--
-- Same reasoning 0061 wrote out and 0063 applied a second time, and it applies harder
-- here: 0052's `alter default privileges ... revoke insert, update, delete, truncate,
-- references, trigger` does not name SELECT, so pg_default_acl still hands `anon=r` to
-- every new table in this schema. Without the revoke, an invite graph -- who knows whom,
-- off-platform -- is born readable by the anonymous role and advertised by PostgREST.
--
-- Neither table is read directly by any client. Everything goes through the four
-- functions below, so zero grants costs nothing and buys the property that one hurried
-- `disable row level security` is a no-op instead of a social-graph disclosure.

-- ---------------------------------------------------------------------------
-- 0. Normalisation, shared by every function here and mirrored in TypeScript.
-- ---------------------------------------------------------------------------
--
-- A code gets read off a screen, dictated over voice chat and retyped. Crockford base32
-- already excludes I, L, O and U from the alphabet so those characters can never be part
-- of a real code; this maps the three that people type anyway onto what they meant, and
-- drops separators so "abcde-12345" and "ABCDE12345" are the same code.
--
-- IMMUTABLE and no table access, so it is safe in a check constraint and in an index.
-- apps/mobile/src/lib/invite.ts carries the identical function with tests; if you change
-- one, change both, or a code the app accepts stops resolving.
create or replace function public.normalize_invite_code(p_code text)
returns text
language sql
immutable
as $fn$
  select translate(upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')), 'ILO', '110');
$fn$;

revoke execute on function public.normalize_invite_code(text) from public;
grant execute on function public.normalize_invite_code(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. The codes.
-- ---------------------------------------------------------------------------
--
-- One per profile, stable for the life of the account. Stable matters more than it looks:
-- a link that a friend saw in a Discord message three weeks ago has to still work, and a
-- code that rotates turns every already-sent invite into a dead end.
--
-- revoked_at is the escape hatch for the one case that needs it -- a user whose link got
-- posted somewhere they did not intend. Revoking makes the old code unresolvable and
-- get_or_create_invite_code mints a new row's worth of code on the next call. Nothing in
-- the app calls it yet; it exists so the answer to "my link leaked" is an UPDATE and not
-- a schema change.
create table public.invite_codes (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  code       text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- Exactly the 32 Crockford symbols: 0-9, A-H, J, K, M, N, P-T, V-Z.
  constraint invite_codes_code_shape check (code ~ '^[0-9A-HJKMNP-TV-Z]{10}$')
);

create unique index invite_codes_code_key on public.invite_codes (code);

alter table public.invite_codes enable row level security;
revoke all on public.invite_codes from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The graph.
-- ---------------------------------------------------------------------------
create table public.invite_redemptions (
  invitee_id   uuid primary key references public.profiles (id) on delete cascade,
  inviter_id   uuid not null references public.profiles (id) on delete cascade,
  code         text not null,
  redeemed_at  timestamptz not null default now(),
  -- When the invitee tapped "duo up". Null means attributed but not connected, which is a
  -- state worth being able to count separately: it is the difference between an invite
  -- that landed and an invite that worked.
  connected_at timestamptz,
  constraint invite_redemptions_not_self check (invitee_id <> inviter_id)
);

-- Serves the funnel query and the "how many has this person brought" read.
create index invite_redemptions_inviter_idx on public.invite_redemptions (inviter_id, redeemed_at desc);
-- Serves rate limit 3 (the 24h cap on inviter-side likes), which is per inviter and
-- ordered by recency, and is the only index the accept path needs.
create index invite_redemptions_inviter_connected_idx
  on public.invite_redemptions (inviter_id, connected_at)
  where connected_at is not null;

alter table public.invite_redemptions enable row level security;
revoke all on public.invite_redemptions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Minting a code.
-- ---------------------------------------------------------------------------
--
-- gen_random_uuid() rather than random(): random() is a seeded PRNG whose stream is
-- predictable from a few outputs, and this string is the only thing standing between a
-- stranger and somebody's invite. gen_random_uuid() is CSPRNG-backed in PG13+, so its 16
-- bytes are the entropy source; get_byte(...) % 32 is exactly uniform because 256 is a
-- multiple of 32.
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $fn$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_code text := '';
  i int;
begin
  for i in 0..9 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$fn$;

revoke execute on function public.generate_invite_code() from public, anon, authenticated;

-- The caller's own code, minted on first ask.
--
-- Onboarding is required. An invite is a promise that the person on the other end has a
-- profile to arrive at, and a half-finished profile is invisible to get_profile_card, so
-- the invitee would land on an arrival screen with nothing on it.
--
-- The retry loop exists because the unique index is the real collision guard: at 50 bits
-- a collision is not going to happen, and "not going to happen" is not the same as
-- "handled". Five attempts, then it gives up loudly rather than returning a code that
-- belongs to somebody else.
create or replace function public.get_or_create_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_code text;
  v_attempt int;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;

  select code into v_code
  from public.invite_codes
  where profile_id = v_me and revoked_at is null;
  if v_code is not null then
    return v_code;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_me and onboarding_completed = true and is_active = true and is_admin_suspended = false
  ) then
    raise exception 'profile_not_ready'
      using hint = 'Finish setting up your profile before inviting anyone.';
  end if;

  -- Generous: this is idempotent and a legitimate client can call it on every mount of
  -- the invite screen. The bound is here so a retry loop in a broken build cannot spin
  -- the generator forever.
  perform public.check_rate_limit('invite_code', 30, interval '1 hour');

  for v_attempt in 1..5 loop
    v_code := public.generate_invite_code();
    begin
      insert into public.invite_codes (profile_id, code) values (v_me, v_code)
      on conflict (profile_id) do update set code = excluded.code, revoked_at = null
      returning code into v_code;
      return v_code;
    exception
      when unique_violation then
        -- The code collided with another profile's. Try again with new entropy.
        null;
    end;
  end loop;

  raise exception 'invite_code_generation_failed';
end;
$fn$;

revoke execute on function public.get_or_create_invite_code() from public, anon;
grant execute on function public.get_or_create_invite_code() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Resolving a code to a name. See D4 for why anon can call this.
-- ---------------------------------------------------------------------------
--
-- The visibility predicate is get_profile_card's, minus the blocks clause (there is no
-- viewer to compare against when the caller is anon; redeem_invite_code applies it once
-- there is one). A revoked, banned, suspended, deactivated, un-onboarded or demo inviter
-- resolves to nothing, and so does a code that never existed -- the same empty result for
-- all of them, so this cannot be used to tell those cases apart.
create or replace function public.resolve_invite_code(p_code text)
returns table (inviter_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $fn$
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
    and p.is_demo = false;
$fn$;

revoke execute on function public.resolve_invite_code(text) from public;
grant execute on function public.resolve_invite_code(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Redeeming: the attribution write.
-- ---------------------------------------------------------------------------
--
-- Idempotent by construction. The app calls this the moment a session exists and a code
-- is pending, which can happen more than once (a cold start mid-flow, a retried request),
-- and the primary key means the second call returns the first call's answer rather than
-- rewriting history. A person invited by two people belongs to whoever they redeemed
-- first.
create or replace function public.redeem_invite_code(p_code text)
returns table (inviter_id uuid, display_name text, connected boolean)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_inviter uuid;
  v_name text;
  v_existing public.invite_redemptions%rowtype;
  v_created_at timestamptz;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_existing from public.invite_redemptions where invitee_id = v_me;
  if found then
    select p.display_name into v_name from public.profiles p where p.id = v_existing.inviter_id;
    inviter_id := v_existing.inviter_id;
    display_name := coalesce(v_name, 'Someone');
    connected := v_existing.connected_at is not null;
    return next;
    return;
  end if;

  -- Ten wrong codes an hour is far more than a person who is retyping one, and it is what
  -- turns the 50 bits in D4 into a bound an authenticated attacker also cannot get past.
  perform public.check_rate_limit('redeem_invite', 10, interval '1 hour');

  select r.inviter_id, r.display_name into v_inviter, v_name
  from public.resolve_invite_code(p_code) r;

  if v_inviter is null or v_inviter = v_me then
    raise exception 'invite_not_found'
      using hint = 'That invite code did not work. Check it and try again.';
  end if;

  -- D3: the 14 day window, anchored on the account, not on the code.
  select p.created_at into v_created_at from public.profiles p where p.id = v_me;
  if v_created_at is null or v_created_at < now() - interval '14 days' then
    raise exception 'invite_window_closed'
      using hint = 'Invite codes only work on a new account.';
  end if;

  -- A block either direction means these two have already decided. Same empty answer as a
  -- bad code, so redeeming cannot be used to detect that somebody blocked you.
  if public.is_blocked_pair(v_me, v_inviter) then
    raise exception 'invite_not_found'
      using hint = 'That invite code did not work. Check it and try again.';
  end if;

  insert into public.invite_redemptions (invitee_id, inviter_id, code)
  values (v_me, v_inviter, public.normalize_invite_code(p_code))
  on conflict (invitee_id) do nothing;

  inviter_id := v_inviter;
  display_name := v_name;
  connected := false;
  return next;
end;
$fn$;

revoke execute on function public.redeem_invite_code(text) from public, anon;
grant execute on function public.redeem_invite_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Accepting: the second consent, and the match.
-- ---------------------------------------------------------------------------
--
-- Returns the same (matched, match_id) shape perform_swipe does, so the screen that calls
-- it can hand the result to the existing match celebration without a second code path.
--
-- THE SWIPE QUOTA IS DELIBERATELY NOT CHARGED. The 25/day free cap exists to meter
-- discovery. This is not discovery: the invitee is answering a specific person who asked
-- for them by name, and spending one of their first 25 swipes on it would be charging
-- them for the app's own onboarding.
--
-- RATE LIMIT 3, THE INVITER-SIDE CAP. 25 invite-originated likes written on one inviter's
-- behalf per rolling 24 hours. Past that only the invitee's like is written and the pair
-- becomes a duo request instead of a match, which is the correct degradation: nothing is
-- lost, the inviter just has to say yes explicitly. The number matches the free swipe cap
-- because it is answering the same question -- how many people can one account connect
-- with in a day without a human on the other side of each decision.
create or replace function public.accept_invite()
returns table (matched boolean, match_id uuid, inviter_id uuid)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_row public.invite_redemptions%rowtype;
  v_recent_connections int;
  v_mutual boolean;
  v_a uuid;
  v_b uuid;
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

  if v_recent_connections < 25 then
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
    -- Same upsert perform_swipe uses, so the on_match_created trigger fires and both
    -- sides get the ordinary "New match!" push. That is the whole notification design for
    -- this feature: no new category, no new setting, no new Edge Function branch.
    insert into public.matches (user_a_id, user_b_id)
    values (v_a, v_b)
    on conflict (user_a_id, user_b_id) do update set unmatched_at = null, unmatched_by = null
    returning id into match_id;
    matched := true;
  end if;

  return next;
end;
$fn$;

revoke execute on function public.accept_invite() from public, anon;
grant execute on function public.accept_invite() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Where the invite link sends somebody who does not have the app.
-- ---------------------------------------------------------------------------
--
-- Empty string means "not released yet", which is true today: DuoQueue is approved by
-- Apple and deliberately unreleased. While it is empty the invite landing page's
-- get-the-app button points at the duoqueue.io waitlist instead of the App Store. On
-- launch day this is one UPDATE, with no redeploy of anything:
--
--   update public.app_config set value = 'https://apps.apple.com/us/app/duoqueue/id<id>'
--   where key = 'app_store_url';
--
-- Runtime config rather than an Edge Function secret for the same reason
-- 0061 put waitlist_open here: the flip has to be possible at 11pm on launch night by
-- somebody who is not near a deploy pipeline.
insert into public.app_config (key, value) values ('app_store_url', '')
on conflict (key) do nothing;
