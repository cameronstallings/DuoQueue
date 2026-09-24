-- 0067: the age gate moves behind authentication, and "no profile row" becomes the shape
-- of an account that has not passed it yet.
--
-- 0067 and not 0066b: 0066_invite_rate_limit_actually_counts.sql is the highest file in
-- this directory, and this repo's rule is that an applied migration is never edited.
--
-- ONE HONEST CAVEAT UP FRONT, because every other migration here opens by saying it
-- checked the live cluster and this one cannot. The task that produced this file forbade
-- touching the database, so nothing below was measured, dry-run, or compared against
-- supabase_migrations.schema_migrations. Two consequences, both deliberate rather than
-- incidental:
--
--   * Every function this file rewrites is rebuilt from the LAST definition on disk,
--     named in the section that rewrites it. That reconstruction is the thing 0054 got
--     wrong and 0056 had to undo. Where a rebuild from disk was avoidable, it was
--     avoided: section 6 derives the fourteen public_* views from whatever is actually
--     live via pg_get_viewdef rather than retyping fourteen definitions nobody here can
--     verify, and section 5 fixes get_deck and get_online_now by changing the one helper
--     they both consult instead of restating four hundred lines of two functions that
--     cannot be diffed against production from this seat.
--   * Apply it with scripts/db/apply-migration.ps1 and no -Commit first. The dry-run
--     wraps it in a transaction and rolls back, and it is the only place left where the
--     assumptions below get checked.
--
-- THAT DRY RUN HAS SINCE HAPPENED (2026-09-23, hosted project at 0066, rolled back, nothing
-- committed): this file and 0068 applied cleanly in one transaction, all fourteen views took
-- the wrap, and a profile-less caller simulated with `set local role authenticated` and a
-- random `sub` got zero rows from public_profiles, public_profile_media,
-- public_verified_stats and get_profile_card, `age_not_verified` from get_deck and
-- get_online_now, while a caller with a profile still got the card and the views. Section
-- 6b (get_profile_card) was added after an adversarial review and is rebuilt from the live
-- definition. What a dry run cannot reach is anything that needs a real Apple signup: the
-- provider value GoTrue writes into raw_app_meta_data (D4) is still a device-test item.
--
-- ============================================================================
-- D1. WHAT SIGN IN WITH APPLE BREAKS
-- ============================================================================
--
-- Today the age gate runs BEFORE auth. apps/mobile/app/(auth)/age-gate.tsx collects a
-- date of birth, hands it to sign-up.tsx as a route param, and sign-up sends it as
-- signUp metadata; handle_new_user reads raw_user_meta_data->>'dob' and refuses to
-- create the account without it. That ordering is the whole reason the invariant "you
-- cannot hold a session without a verified 18+ date of birth" has held.
--
-- An identity token from Apple carries no birthdate, and signInWithIdToken has no
-- metadata channel to smuggle one through. So with the trigger as written, Sign in with
-- Apple cannot be turned on at all: GoTrue inserts the auth.users row, the trigger raises
-- 'A valid date of birth is required to create an account', the insert rolls back, and
-- the user is told "Database error saving new user". That is why SOCIAL_SIGN_IN_ENABLED
-- is still false at apps/mobile/app/(auth)/sign-in.tsx, on a feature that is otherwise
-- entirely built.
--
-- The fix is to let the age gate run AFTER authentication on provider signups. The
-- question this migration exists to answer is what the account looks like in between.
--
-- ============================================================================
-- D2. WHY "NO PROFILE ROW" AND NOT "A PROFILE WITH A NULL DOB"
-- ============================================================================
--
-- The obvious shape is a profiles row with dob null, filled in once the user answers. It
-- is rejected, and this project already holds the receipts for why.
--
-- 1. THIS EXACT BUG HAS BEEN SHIPPED TWICE. 0031 section 7: the age CHECK read `dob is
--    null or dob <= ...`, so a null always satisfied it; is_minor() returned NULL,
--    same_age_band() returned NULL, and `if not same_age_band(...)` did not fire, because
--    NULL is not false. The account was hidden from the deck and could still swipe, match
--    and chat by target id. 0053 then found the other half of the same bug in
--    handle_new_user itself (`v_dob !~ pattern` is NULL, not TRUE, when v_dob is NULL),
--    and 0056 had to re-apply that fix after an unrelated migration reverted it. Three
--    migrations, one root cause: a nullable dob means every reader has to remember that
--    NULL is a third answer, and readers do not remember.
--
-- 2. THE CONSTRAINT DOES THE REMEMBERING. `dob not null`, plus `check (dob is not null
--    and dob <= current_date - 18 years)`, is enforced once, by the database, at the only
--    place that matters. Nobody writing a query next year has to know it exists. A
--    nullable dob deletes that guarantee and replaces it with a convention, and a
--    convention is exactly what 0031 and 0053 were cleaning up after.
--
-- 3. ABSENCE IS ENFORCED BY THE FOREIGN KEYS, FOR FREE. Fifty-five client-writable tables
--    reference public.profiles (id). A session with no profile row cannot write to any of
--    them: the insert fails with 23503, loudly, at the database. A row with a null dob
--    satisfies every one of those keys, so a half-account could like, message, join a
--    party and be reported, and each of those paths would have to grow its own "but is
--    the dob null" check.
--
-- 4. A NULL-DOB ROW LOOKS LIKE A MEMBER EVERYWHERE IT IS JOINED. It appears in counts, in
--    admin screens, in exports, in every `join profiles` written without this state in
--    mind. An absent row appears nowhere. Given a choice between a hazard that hides
--    inside data and a hazard that shows up as control flow, take the control flow one:
--    control flow can be enumerated, and D3 enumerates it.
--
-- 5. IT KEEPS dob UNWRITABLE BY CLIENTS. 0031's column allow-list for the profiles UPDATE
--    grant deliberately excludes dob, and there is no INSERT policy and no INSERT grant
--    on profiles at all, so today nothing client-reachable writes an age. A
--    fill-in-the-null design needs such a path. This one does not: complete_signup()
--    below only ever INSERTs, and never updates dob, so an age still cannot be rewritten
--    after the fact by anybody.
--
-- What absence is NOT is free. It converts a data-shape hazard into a control-flow one,
-- and the surfaces that gate on the SUBJECT's profile rather than the VIEWER's do not
-- notice a missing viewer at all. That is the next section, and sections 5 to 7 are the
-- fix for it.
--
-- ============================================================================
-- D3. THE WINDOW THIS OPENS, AND EVERY PLACE IT LEAKED
-- ============================================================================
--
-- The invariant moves from "you cannot hold a SESSION without a verified 18+ date of
-- birth" to "you cannot hold a PROFILE without one". The gap between those two sentences
-- is a real session, holding a real `authenticated` JWT, with no profiles row: somebody
-- who tapped Sign in with Apple and has not answered yet. It is unbounded in duration --
-- they can sit on the screen, background the app, or abandon -- and it is observable only
-- to that one user.
--
-- The design this file implements asserted that "every existing RLS policy already
-- handles that state correctly because they all join profiles". That is true of the table
-- policies and false of the two surfaces that actually carry the data. Every table policy
-- is `profile_id = auth.uid()` or a participant check, so it returns zero rows or hits one
-- of those fifty-five foreign keys and raises a catchable 23503. But a survey of all 66
-- migrations found four places where the viewer is not asked about at all:
--
--   * get_deck and get_online_now (last defined in 0060) are SECURITY DEFINER, bypass RLS
--     entirely, and never join the viewer's own profiles row. They derive the viewer's age
--     band from `v_i_am_minor := public.is_minor(v_me)`, which is SQL NULL when there is
--     no row; `if v_i_am_minor then` treats NULL as not-true and falls into the ELSE
--     branch, which is the ADULT 18..99 band. A profile-less session gets a full,
--     correctly scored deck of real adults -- names, ages, regions, bios -- with no error
--     and no empty result. A silent, correct-looking answer is the worst possible failure
--     for an age gate, and this is the app's primary content surface. Section 5.
--
--   * The fourteen public_* views gate only on the SUBJECT's profiles row. The viewer
--     appears in their predicates solely as auth.uid() inside the blocks NOT EXISTS and
--     inside is_demo_viewer(), both of which are permissive when the viewer has no
--     profile. All fourteen are granted to authenticated, so one PostgREST GET enumerates
--     every onboarded user's name, age, region and bio, and the other thirteen views then
--     give up photo paths, voice intro paths, games, shows, platforms, languages,
--     playstyles, prompt answers, vibe and play schedule. Section 6.
--
--   * profile_photos_select_approved and voice_intros_select_approved (0043) authorize
--     through two of those views, so they inherit the same hole and hand over the bytes.
--     Section 7, where they are fixed by the view fix rather than by being touched.
--
--   * profile_photos_insert_own_folder (0031) and voice_intros_insert_own_folder (0032)
--     are the only client write paths in the whole schema with no dependency on profiles.
--     Section 7.
--
-- AND A FIFTH, WHICH THAT SURVEY MISSED: get_profile_card (0060), SECURITY DEFINER, granted
-- to authenticated, asks nothing about the viewer beyond `auth.uid() is not null`. An
-- adversarial review of this file caught it before it was ever applied. Section 6b. That
-- review also went through every other live SECURITY DEFINER function callable by
-- authenticated, and each of the rest requires a match, party, like or block row, all of
-- which carry a foreign key to profiles and so cannot exist for this caller.
--
-- The single mechanism under the first of those is worth stating plainly, because this
-- kind of thing comes back: public.is_minor(uuid) returns NULL rather than false for an
-- absent profile, and its two classes of caller treat that NULL in opposite ways.
-- same_age_band() wraps it in coalesce(..., false) and correctly denies, which is why
-- get_standouts, perform_swipe, deck_gate_hard and get_deck_pool_size all behave today.
-- get_deck and get_online_now assign it to a plpgsql boolean and test it, where NULL is
-- not-true and falls through to the adult branch. One helper, two call styles, and only
-- one of them fails closed.
--
-- WHAT WAS CHECKED AND IS FINE, so it does not get re-litigated: check_rate_limit works
-- (rate_limit_hits.profile_id is a bare uuid with no foreign key, 0048, deliberately);
-- is_banned_user, is_admin_user, is_demo_viewer and is_premium all coalesce to false;
-- get_standouts returns empty and inserts nothing, so it self-heals once a profile
-- exists; get_admirers, get_matches_summary, get_swipe_quota, get_consumable_credits and
-- the party functions return empty or raise; and every scheduled sweep (0038, 0053, 0063)
-- requires onboarding_completed = true, which is unreachable without a profile -- so no
-- cron job and no other user can observe this window at all.
--
-- ============================================================================
-- D4. THE TRIGGER: QUIET ONLY FOR PROVIDERS, LOUD FOR EVERYTHING ELSE
-- ============================================================================
--
-- handle_new_user keeps its banned_identities check, first and unconditional, on every
-- path. Then, if there is no dob in the metadata, it returns without creating anything.
--
-- That branch is gated on the provider, and the gate is not decoration. Ungated, the
-- quiet path would also apply to `supabase.auth.signUp({email, password})` with no
-- metadata -- a call anybody can make with the anon key that ships inside the app binary.
-- Today that call raises and no account is created. Ungated, it would succeed, mint an
-- auth.users row, and make Supabase's own SMTP send a confirmation email to whatever
-- address the caller named. An unlimited mailer is not a thing to hand out as a side
-- effect of an age-gate change.
--
-- The gate is an allow-list of two providers rather than `<> 'email'`, on purpose: adding
-- a third provider should be a decision made by somebody reading this comment, not
-- something that happens by default the day a box gets ticked in the Supabase dashboard.
-- `null in ('apple','google')` is NULL rather than true, so a signup whose
-- raw_app_meta_data carries no provider key falls through to the raise. Fail closed.
--
-- VERIFY THIS ON THE FIRST REAL DEVICE TEST. GoTrue is expected to set
-- raw_app_meta_data->>'provider' to 'apple' for signInWithIdToken({provider:'apple'}).
-- If it does not, Apple sign-in fails with the generic "Database error saving new user"
-- rather than silently opening anything. Wrong in the safe direction, but wrong, and it
-- is a five-minute check against a real signup that nobody should skip.
--
-- An INVALID dob still raises, on every path. Only an ABSENT one is quiet. Worth naming
-- what raising does on the OAuth path: GoTrue rolls the auth.users insert back, so the
-- user cannot sign in at all and gets that same generic error. Fine today, because the
-- OAuth path never sends a dob. If a future client ever DOES send one at OAuth signup, a
-- malformed value becomes an un-debuggable "sign in failed" instead of a message -- so if
-- you add that, add the error mapping with it.
--
-- ============================================================================
-- D5. complete_signup: THE ORDER OF THE CHECKS IS THE DESIGN
-- ============================================================================
--
-- One SECURITY DEFINER function, called by the client after authentication, doing what
-- the trigger would have done. The order it does things in is the argument:
--
--   1. auth.uid() or refuse. Nothing here means anything without a caller.
--   2. The banned_identities check, first and unconditional, mirroring the trigger. The
--      email is re-read from auth.users and never accepted as an argument, because a
--      client-supplied one is trivially chosen to miss the ban list.
--   3. The dob shape and the 18+ check, BEFORE the "do you already have a profile" check.
--      This is the ordering that gets written backwards. If the existence check came
--      first, an authenticated adult could send an under-18 date, get a success back, and
--      quote that success as the server having accepted it. An endpoint that returns OK
--      for an under-18 date under ANY circumstance is not an age gate. So the validation
--      runs every time, for every caller, before anything can return normally.
--   4. Only then the existence check, and only then the writes.
--
-- IDEMPOTENCY, which the design asked to have decided and justified rather than assumed.
-- Neither a plain no-op nor a plain raise is right, so this does neither:
--
--   * SAME dob as the row that already exists -> return quietly. The realistic re-entry is
--     a timeout where the write actually committed and the client retried, or a double
--     tap, or a relaunch between the RPC committing and the profile refresh landing.
--     Raising there strands a brand-new user behind an error they cannot clear, on the one
--     screen standing between them and the app, for a state that is already correct.
--   * DIFFERENT dob -> raise 'This account already has a profile'. A silent no-op here
--     would be the app telling somebody their date of birth was accepted while the stored
--     one says otherwise. That is an age-gate-shaped lie, and it is the one sentence an
--     18+ app cannot afford to say. Loud, catchable, and the stored value wins.
--
--   The stored dob is NEVER updated, on any path: no `on conflict do update`, nothing that
--   touches profiles.dob after the insert. Together with 0031's UPDATE column allow-list,
--   which excludes dob, that keeps "an age cannot be changed once it is set" true for
--   every client-reachable path in the schema.
--
--   The three child rows ARE re-attempted on the quiet path, with `on conflict do
--   nothing`, so a call interrupted between inserts self-heals instead of leaving a
--   profile without its notification_settings row forever. That row matters more than it
--   looks: get_new_player_alert_batch (0063) INNER JOINs notification_settings, so a
--   profile missing it is silently dropped from every new-player sweep, permanently, with
--   no error anywhere. Which is also why all four inserts live in this one function body
--   rather than in four client-side writes -- one RPC is one PostgREST transaction, so the
--   four rows commit together and no new window opens between them.
--
-- NO RATE LIMIT, stated as a decision rather than left as an omission, the way 0065's D4
-- did for resolve_invite_code. Two reasons. Metering the raise path does nothing: 0066 is
-- the entire story of discovering that a raising RPC aborts its own transaction and takes
-- check_rate_limit's hit row down with it. And the success path is bounded to exactly one
-- by profiles.id being a primary key.
--
-- WHAT THAT LEAVES OPEN, NAMED RATHER THAN GLOSSED. A rejected under-18 caller still holds
-- a valid JWT after the raise and can call again with a date five years earlier; nothing
-- distinguishes the second call from the first. That is not a regression -- the pre-auth
-- flow has exactly the same property, because the trigger's raise rolls the auth.users row
-- away and leaves nothing to remember the attempt by. What IS new is that there is now,
-- for the first time, a durable identity to hang a record on: the auth.users row survives
-- the raise, and Apple returns a stable `sub` for the same Apple ID forever.
-- public.apply_durable_ban(uuid, text) (0054) already works with no profiles row -- it
-- reads the email from auth.users, writes banned_identities, sets banned_until and kills
-- the sessions. Recording a rejection cannot be done from inside this function, because
-- the raise would roll the record back (0066 again), so it needs either a second RPC the
-- client calls when it catches the raise, or a contract that returns a code instead of
-- raising. Both are follow-ups. Neither is in the contract this file implements.
--
-- A NULL EMAIL IS ALLOWED TO COMPLETE A SIGNUP, and here is the reasoning, because it was
-- asked for explicitly. banned_identities is keyed on email_identity_hash(...), so with no
-- email there is nothing to look up and the check is a no-op -- exactly as it already is
-- in the trigger, which is equally conditional on `new.email is not null`. Refusing on a
-- null email would not be denying a known ban, it would be denying an unknown, and it
-- would brick any provider that returns no address. Both Apple and Google always deliver
-- one today (Apple's Hide My Email relay is a real, stable, per-app address), so the
-- branch is unreachable in practice.
--
-- The narrow ban hole that IS real belongs written down where the next person will find
-- it: Apple offers Hide My Email or Share My Email at every FIRST authorization, and the
-- two produce different values in auth.users.email and therefore different hashes, so a
-- user banned under one can come back under the other in a single tap. The fix is to key
-- bans on the provider subject (auth.identities.provider_id) as well as on the email,
-- which means a column on banned_identities and a change to apply_durable_ban, and belongs
-- in its own migration rather than half-done in this one. Naming it, not fixing it.
--
-- ONE CONSEQUENCE FOR THE INVITE WINDOW, since 0065's D3 anchors on it: profiles.created_at
-- now means "when this account finished the age gate" rather than "when this account was
-- created". For the 14-day redemption window that is strictly more generous and harmless.
-- It does mean profiles.created_at is no longer the true account-age clock, so anything
-- that ever needs real account age must read auth.users.created_at.
--
-- ============================================================================
-- D6. WHAT complete_signup DELIBERATELY DOES NOT SET
-- ============================================================================
--
-- onboarding_completed is left at its default false, and the insert does not name the
-- column. Two triggers depend on that:
--
--   * enforce_verified_email_before_visible (0028) is BEFORE UPDATE only. A row INSERTed
--     with onboarding_completed already true would never pass through it, which is the
--     exact guarantee 0028 exists to provide.
--   * stamp_onboarding_completed_at (0063) is also BEFORE UPDATE OF onboarding_completed.
--     A row born with the flag set would never be stamped, and an unstamped user is never
--     announced by the new-player sweep.
--
-- Both properties hold only on the UPDATE path, which is where the onboarding wizard puts
-- them. This function creates an account; it does not finish one.

-- ---------------------------------------------------------------------------
-- 1. Assert the shape the whole design rests on, before changing anything.
-- ---------------------------------------------------------------------------
--
-- Everything above is an argument that a profiles row means "18+, verified". That is only
-- true while dob is NOT NULL and the CHECK is the 0053 form that refuses a null. 0056
-- restated both defensively; this asserts them instead, and refuses to install a post-auth
-- age gate on top of a table that has quietly lost either one. A migration that fails here
-- has told you something worth knowing.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'dob' and is_nullable = 'NO'
  ) then
    raise exception '0067 refuses to run: public.profiles.dob is nullable, and this migration requires the NOT NULL that 0053 added and 0056 restated.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profile_must_be_18'
      and pg_get_constraintdef(oid) ilike '%dob is not null%'
  ) then
    raise exception '0067 refuses to run: constraint profile_must_be_18 is missing or no longer refuses a null dob. Expected the 0053 form.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. The one predicate the rest of this file is written in terms of.
-- ---------------------------------------------------------------------------
--
-- "Has this caller given us a date of birth we verified as 18 or over?" A profiles row
-- exists if and only if that happened: section 1 just asserted the constraints that make
-- it an if-and-only-if, and the only two writers are the trigger and complete_signup,
-- both of which validate before they insert.
--
-- THE NULL auth.uid() CARVE-OUT is the convention already written into all fourteen
-- public_* views for their blocks check, and 0059's header names it: a null auth.uid()
-- means there is no member session at all -- anon, or a service_role call from an Edge
-- Function or a scheduled sweep. Those callers' visibility is decided by the GRANT, not
-- by this predicate, and thirteen of the fourteen views are not granted to anon in the
-- first place. Without the carve-out this function would silently narrow the one anon
-- grant that does exist (public_verified_stats) and every service-role read, neither of
-- which has anything to do with the age gate.
--
-- SECURITY DEFINER because it is called from inside views and RLS policies, where the
-- caller's own visibility of public.profiles is not the question being asked. It answers
-- one boolean about the caller's own session and discloses nothing else, which is why it
-- is safe to grant broadly -- and it MUST be granted broadly, because a function
-- referenced from an RLS policy is executed as the querying role. That is 0034's lesson,
-- learned the expensive way when revoking EXECUTE on is_admin_user nearly locked every
-- user out of their own profile row.
create or replace function public.viewer_age_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select auth.uid() is null
      or exists (select 1 from public.profiles p where p.id = auth.uid());
$fn$;

-- Revoked from all three client-facing roles first and then granted back, rather than
-- revoked from PUBLIC alone: Supabase's default privileges grant EXECUTE on every new function
-- in public to anon and authenticated directly (0041's lesson), and a revoke from PUBLIC does
-- not touch a role's own grant. The end state is the same three roles either way; this way it
-- is the state this file chose rather than the one the defaults happened to leave.
revoke execute on function public.viewer_age_verified() from public, anon, authenticated;
grant execute on function public.viewer_age_verified() to anon, authenticated, service_role;

comment on function public.viewer_age_verified() is
  'True when the caller has a profiles row, which by construction means a date of birth '
  'verified as 18+. Also true when auth.uid() is null (anon, service_role), whose '
  'visibility is decided by the grant rather than by the age gate. See 0067.';

-- ---------------------------------------------------------------------------
-- 3. handle_new_user: an absent dob is quiet, an invalid dob still raises.
-- ---------------------------------------------------------------------------
--
-- BASED ON 0056_reapply_null_dob_guard.sql, which is the last definition of this function
-- on disk and the one 0056 restored after 0054 rebuilt it from a stale baseline and
-- silently reverted 0053's NULL-dob fix. Read that file's header before touching this
-- one. The banned_identities check below is 0054's, kept verbatim and in the same first
-- position; the `v_dob is null or` in the shape guard is 0053's fix, kept verbatim; the
-- insert, the timezone laundering through is_valid_timezone, and the three child inserts
-- are all unchanged.
--
-- WHAT IS ACTUALLY DIFFERENT, in full: one new declaration (v_provider) and one new
-- branch of five lines between the ban check and the dob shape guard. Nothing else. D4
-- argues why that branch is an allow-list of providers rather than an unconditional quiet
-- path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob text := new.raw_user_meta_data ->> 'dob';
  v_timezone text := new.raw_user_meta_data ->> 'timezone';
  v_provider text := new.raw_app_meta_data ->> 'provider';
  v_parsed_dob date;
begin
  if new.email is not null and exists (
    select 1 from public.banned_identities
    where email_hash = public.email_identity_hash(new.email)
      and unbanned_at is null
  ) then
    raise exception 'This account has been banned and cannot be re-created.';
  end if;

  -- The one new branch. A provider signup carries no birthdate and cannot be made to, so
  -- the account is created with NO profile row and public.complete_signup() becomes the
  -- gate. Anything that is not one of these two providers -- including a null provider,
  -- since `null in (...)` is NULL and not true -- falls through and raises exactly as it
  -- does today.
  if v_dob is null and v_provider in ('apple', 'google') then
    return new;
  end if;

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

-- ---------------------------------------------------------------------------
-- 4. complete_signup: the gate, now that it runs after authentication.
-- ---------------------------------------------------------------------------
--
-- The pinned contract, which the mobile client codes against literally:
--
--   public.complete_signup(p_dob text, p_timezone text, p_display_name text default null)
--   returns void
--
--   'A valid date of birth is required to create an account'
--   'You must be at least 18 to create an account'
--   'This account has been banned and cannot be re-created.'
--   'This account already has a profile'
--
-- The first three are byte-identical to the trigger's, so the two paths cannot drift into
-- saying different things about the same refusal. Unlike the trigger's, these reach the
-- client cleanly as PostgrestError messages instead of being swallowed by GoTrue into
-- "Database error saving new user" -- which is worth knowing on the client side, because
-- the same ban refusal is legible from here and illegible from there.
--
-- D5 has the order of the checks, the idempotency argument, the absence of a rate limit,
-- and what a null email does. D6 has what this deliberately does not set.
--
-- SECURITY DEFINER is not a shortcut here, it is the only option: public.profiles has no
-- INSERT policy and no INSERT grant to authenticated (0001 grants select and update
-- only), so a client cannot create its own row by any route. That property is worth
-- keeping, and this function is its single, argued exception.
create or replace function public.complete_signup(
  p_dob text,
  p_timezone text,
  p_display_name text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_email text;
  v_parsed_dob date;
  v_existing_dob date;
  v_display_name text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  -- (1) The ban check, first and unconditional, mirroring the trigger. The email comes
  -- from auth.users and never from an argument. email_identity_hash is revoked from
  -- authenticated (0054); SECURITY DEFINER covers both reads.
  select u.email into v_email from auth.users u where u.id = v_me;

  -- A JWT outlives the account it names by up to an hour, so a token issued just before
  -- a delete-account run can still arrive here. Without this, the insert below would fail
  -- on profiles.id references auth.users (id) with a raw 23503 that means nothing to
  -- anybody. Same sentence as the null-uid case above, because it is the same fact.
  if not found then
    raise exception 'Not authenticated';
  end if;

  if v_email is not null and exists (
    select 1 from public.banned_identities
    where email_hash = public.email_identity_hash(v_email)
      and unbanned_at is null
  ) then
    raise exception 'This account has been banned and cannot be re-created.';
  end if;

  -- (2) The date of birth, validated before anything can return normally.
  if p_dob is null or p_dob !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'A valid date of birth is required to create an account';
  end if;

  -- The regex admits '2026-02-30', which the cast then rejects with a raw Postgres 22008.
  -- The trigger can live with that, because GoTrue flattens everything into one generic
  -- message anyway; this endpoint cannot, because the client matches on the text. Every
  -- malformed date gets the same sentence.
  begin
    v_parsed_dob := p_dob::date;
  exception
    when invalid_datetime_format or datetime_field_overflow then
      raise exception 'A valid date of birth is required to create an account';
  end;

  if v_parsed_dob > (current_date - interval '18 years')::date then
    raise exception 'You must be at least 18 to create an account';
  end if;

  -- (3) Only now, does this account already have a profile. Per D5: the same date is a
  -- retry, a different date is a lie waiting to be told.
  select p.dob into v_existing_dob from public.profiles p where p.id = v_me;

  if found then
    if v_existing_dob is distinct from v_parsed_dob then
      raise exception 'This account already has a profile';
    end if;

    -- A retry of a call that already landed. Heal any child row a previous interrupted
    -- call did not reach, and touch nothing else. Above all, not dob.
    insert into public.preferences (profile_id) values (v_me) on conflict (profile_id) do nothing;
    insert into public.notification_settings (profile_id) values (v_me) on conflict (profile_id) do nothing;
    insert into public.profile_vibe (profile_id) values (v_me) on conflict (profile_id) do nothing;
    return;
  end if;

  -- (4) The display name is a SEED, not a commitment. Apple hands it over on the first
  -- authorization for an Apple ID and never again, so it is worth carrying, but the very
  -- next screen lets the user change it. profiles.display_name carries four constraints
  -- (2..30 characters, non-blank after trimming, no control characters; 0001 plus 0049),
  -- and a name that fails any of them is dropped to null rather than allowed to abort the
  -- account creation. Losing a suggested name is a shrug. Failing a signup because
  -- somebody's legal name is thirty-one characters long is not.
  v_display_name := nullif(btrim(coalesce(p_display_name, '')), '');
  if v_display_name is not null then
    v_display_name := nullif(btrim(left(v_display_name, 30)), '');
  end if;
  if v_display_name is not null and (
       char_length(v_display_name) < 2
       or public.has_disallowed_control_chars(v_display_name, false)
     ) then
    v_display_name := null;
  end if;

  -- (5) The same four rows the trigger writes, in the same order, in one transaction.
  -- onboarding_completed is not named: see D6. The timezone is laundered through
  -- is_valid_timezone exactly as the trigger launders it, so a client that sends garbage
  -- gets a null column on both paths rather than a different answer on each.
  --
  -- NO `on conflict (id) do nothing` HERE, deliberately, and this is the one place the D5
  -- promise could otherwise be broken. Two calls that arrive together both pass the existence
  -- check in (3), because neither can see the other's uncommitted row; the second one's insert
  -- then waits on the primary key until the first commits. With `do nothing`, the loser
  -- returned success having stored nothing, even when its date was a different one: the exact
  -- "your date of birth was accepted" lie D5 exists to refuse. Instead the loser gets the
  -- unique violation, re-reads the row the winner committed (a fresh statement sees it under
  -- READ COMMITTED), and gets D5's own answer: quiet for the same date, the raise for a
  -- different one. A violation that is not about this row at all is re-raised untouched.
  begin
    insert into public.profiles (id, display_name, dob, timezone)
    values (
      v_me,
      v_display_name,
      v_parsed_dob,
      case when public.is_valid_timezone(p_timezone) then p_timezone else null end
    );
  exception
    when unique_violation then
      select p.dob into v_existing_dob from public.profiles p where p.id = v_me;
      if not found then
        raise;
      end if;
      if v_existing_dob is distinct from v_parsed_dob then
        raise exception 'This account already has a profile';
      end if;
  end;

  insert into public.preferences (profile_id) values (v_me) on conflict (profile_id) do nothing;
  insert into public.notification_settings (profile_id) values (v_me) on conflict (profile_id) do nothing;
  insert into public.profile_vibe (profile_id) values (v_me) on conflict (profile_id) do nothing;
end;
$fn$;

revoke execute on function public.complete_signup(text, text, text) from public, anon, authenticated;
grant execute on function public.complete_signup(text, text, text) to authenticated;

comment on function public.complete_signup(text, text, text) is
  'Post-authentication age gate for provider signups, which carry no birthdate. Creates '
  'the four rows handle_new_user would have created, behind the same 18+ and ban checks. '
  'Never updates an existing dob. See 0067.';

-- ---------------------------------------------------------------------------
-- 5. is_minor: refuse a question that has no true answer.
-- ---------------------------------------------------------------------------
--
-- This is the fix for get_deck and get_online_now, and it is deliberately not made in
-- get_deck or get_online_now.
--
-- WHY NOT THERE. Both are two-hundred-line SECURITY DEFINER functions whose last
-- definition on disk is 0060, itself pulled from pg_get_functiondef against the live
-- cluster at the time. Adding a four-line precondition means restating both bodies in
-- full from a baseline this migration is forbidden to verify, which is precisely how 0054
-- reverted 0053's dob fix without anyone noticing for two migrations. Changing the one
-- helper they both consult touches five lines and cannot revert anything.
--
-- WHY A RAISE AND NOT A SAFE DEFAULT. There is no boolean that is safe. Returning false
-- means "adult", which is the current hole: get_deck's ELSE branch hands a profile-less
-- session the 18..99 band and a full deck of real adults. Returning true means "minor",
-- which points that same session at the 15..17 band instead. The honest answer to "is
-- this account a minor" for an account that has never told us its date of birth is that
-- the question is unanswerable, and the only way for a boolean-returning function to say
-- so is to refuse.
--
-- WHAT ELSE THIS CLOSES, all of it in the fail-closed direction and all of it only for a
-- caller with no profile row: same_age_band's coalesce(..., false) becomes a raise rather
-- than a silent false, so perform_swipe (and send_rose and send_super_ping through it)
-- stops answering 'Cannot interact across age groups', which was never true and never
-- actionable; get_standouts stops returning empty for a reason it cannot explain; and
-- deck_gate_preferences, which computes is_minor(p_viewer) directly, refuses as well.
-- 0062's header says its gates must mirror get_deck, and for this one viewer they were
-- the exact opposite of it: get_deck_pool_size already answered 0, because deck_gate_hard
-- inner-joins the viewer's own profiles row, while get_deck in the same second handed
-- over every adult on the platform. get_deck_pool_size is left alone -- 0 was always the
-- right answer -- and get_deck now refuses, so the two agree again. Every one of these
-- moves from a quiet wrong answer to a loud refusal.
--
-- SCOPE, so the blast radius is on the record: in every call site except the viewer-side
-- ones, is_minor is called with an id that came out of public.profiles, so for a normal
-- session nothing changes at all. It is revoked from every client role (0031), it appears
-- in no RLS policy and no view, and its only callers are SECURITY DEFINER functions owned
-- by postgres. The one obligation this creates: if you ever refactor get_deck or
-- get_online_now to stop calling is_minor, put an explicit
-- `if not public.viewer_age_verified() then raise ...` in its place, because after this
-- migration that call is the only thing standing between a profile-less session and the
-- deck.
--
-- The token is a bare string in the house style (0065's profile_not_ready, 0066's
-- invite_window_closed) with the human sentence in the hint.
create or replace function public.is_minor(p_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_dob date;
begin
  select p.dob into v_dob from public.profiles p where p.id = p_profile_id;

  if not found then
    raise exception 'age_not_verified'
      using hint = 'This account has not completed the age check.';
  end if;

  -- 0007's expression, unchanged.
  return extract(year from age(current_date, v_dob))::int < 18;
end;
$fn$;

revoke execute on function public.is_minor(uuid) from public, anon, authenticated;

comment on function public.is_minor(uuid) is
  'Age band for a profile. Raises age_not_verified when the profile does not exist: there '
  'is no safe boolean for an account with no verified date of birth, and the NULL this '
  'used to return was read as "adult" by get_deck and get_online_now. See 0067.';

-- ---------------------------------------------------------------------------
-- 6. The fourteen public_* views, gated on the viewer for the first time.
-- ---------------------------------------------------------------------------
--
-- Every one of these gates on the SUBJECT: is the person whose data this is active,
-- onboarded, unbanned, not in a block pair with you. None of them has ever asked anything
-- about the VIEWER's own profile, because until now every authenticated session had one
-- by construction. That construction is exactly what this migration removes, so the
-- question now has to be asked out loud.
--
-- WHY THIS IS A LOOP OVER pg_get_viewdef AND NOT FOURTEEN RETYPED DEFINITIONS. The last
-- definitions on disk are spread across 0035, 0037, 0039, 0059 and 0060, and this
-- migration cannot check a single one of them against the live cluster. Retyping is how a
-- definition silently reverts; 0054 did it to a function and it took two migrations to
-- notice. Wrapping the definition Postgres actually holds cannot revert anything: the
-- inner select is byte-for-byte whatever is live at apply time, and the only change is one
-- outer predicate. CREATE OR REPLACE VIEW demands identical column names, types and
-- order, and `select * from (<live def>) gated` guarantees all three.
--
-- The predicate is a no-argument stable function with no column references, so the planner
-- treats it as a one-time filter: evaluated once per query, and when it is false the whole
-- scan is skipped rather than filtered row by row.
--
-- THE PRICE, named so nobody has to rediscover it: a future `create or replace view
-- public.public_profiles as select ...` written flat in a migration file will drop the
-- guard silently -- exactly as it would if this file had retyped the definitions instead.
-- If you rewrite one of these views, carry the public.viewer_age_verified() predicate with
-- it. The re-run guard below looks for that function's name in the live definition, so a
-- view that loses it gets re-wrapped the next time something like this runs.
--
-- GRANTS: CREATE OR REPLACE VIEW is expected to preserve the ACL (0035 says so; 0053 and
-- 0059 both re-applied them anyway rather than assume). Same here, with one refinement.
-- The anon SELECT that exists on public_verified_stats and on no other view is read back
-- from the live catalog per view and restored only where it was actually held, rather than
-- re-granted from a list written into this file. Restoring a privilege that has been
-- revoked since 0059 would be this migration quietly re-opening something nobody asked it
-- to open.
do $$
declare
  v_view text;
  v_def text;
  v_anon_select boolean;
begin
  foreach v_view in array array[
    'public_profiles', 'public_profile_media', 'public_profile_voice_intro',
    'public_profile_games', 'public_profile_shows', 'public_profile_platforms',
    'public_profile_languages', 'public_profile_playstyles', 'public_profile_prompts',
    'public_profile_vibe', 'public_profile_schedule', 'public_profile_activity',
    'public_linked_accounts', 'public_verified_stats'
  ]
  loop
    if to_regclass(format('public.%I', v_view)) is null then
      raise exception '0067 refuses to run: expected view public.% to exist, and will not install a partial gate across the discovery views.', v_view;
    end if;

    v_anon_select := has_table_privilege('anon', format('public.%I', v_view), 'select');
    v_def := pg_get_viewdef(format('public.%I', v_view)::regclass, true);

    if position('viewer_age_verified' in v_def) > 0 then
      raise notice '0067: public.% already carries the age gate, left as it is.', v_view;
    else
      execute format(
        'create or replace view public.%I as select * from (%s) gated where public.viewer_age_verified()',
        v_view,
        rtrim(btrim(v_def), ';')
      );
    end if;

    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon, authenticated',
      v_view
    );
    execute format('grant select on public.%I to authenticated', v_view);

    if v_anon_select then
      execute format('grant select on public.%I to anon', v_view);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6b. get_profile_card: the same question, asked of the one card read.
-- ---------------------------------------------------------------------------
--
-- D3's fifth leak. get_profile_card replaced the public_profiles read on the profile-detail
-- path in 0060 so that gender could stay visible one card at a time, and it copied the view's
-- SUBJECT predicates faithfully. What it never needed until now was a VIEWER predicate beyond
-- `auth.uid() is not null`, because a session implied a profile. After this migration a
-- profile-less session that knows a profile id gets that person's display name, age, gender,
-- region and bio back from it, and ids are not hard to find: resolve_invite_code is callable
-- by anon and returns inviter_id.
--
-- REBUILT FROM THE LIVE DEFINITION, not from disk and not from memory, which is the lesson
-- of 0054 and the reason section 6 loops over pg_get_viewdef. The body below is
-- pg_get_functiondef('public.get_profile_card(uuid)') read from the hosted project on
-- 2026-09-23 (it matched 0060 exactly), with one added predicate and nothing else. The
-- signature, the returned columns, STABLE, SECURITY DEFINER and the search_path are all
-- unchanged, which CREATE OR REPLACE would insist on for the return type in any case.
--
-- The new predicate sits next to the existing viewer check rather than at the end, so the two
-- read as the pair they are: there is a caller, and that caller has passed the age gate. With
-- auth.uid() already known to be non-null, viewer_age_verified() is exactly "the caller has a
-- profiles row". Empty result, not an error, the same answer the views now give.
--
-- ACL: CREATE OR REPLACE keeps the existing one, which live is postgres, authenticated and
-- service_role, with no anon and no PUBLIC. Restated anyway, revoking from all three client
-- roles before granting back, per the rule every SECURITY DEFINER function in this schema now
-- follows.
create or replace function public.get_profile_card(p_profile_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  age integer,
  gender gender_enum,
  region region_enum,
  bio text
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    p.id,
    p.display_name,
    extract(year from age(current_date::timestamptz, p.dob::timestamptz))::int,
    p.gender,
    p.region,
    p.bio
  from public.profiles p
  where auth.uid() is not null
    and public.viewer_age_verified()
    and p.id = p_profile_id
    and p.is_active = true
    and p.is_admin_suspended = false
    and p.onboarding_completed = true
    and p.is_banned = false
    and (p.is_demo = false or public.is_demo_viewer())
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    );
$function$;

revoke execute on function public.get_profile_card(uuid) from public, anon, authenticated;
grant execute on function public.get_profile_card(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Storage.
-- ---------------------------------------------------------------------------
--
-- THE TWO READ POLICIES ARE ALREADY FIXED BY SECTION 6, and are deliberately not touched
-- here. 0043 rewrote profile_photos_select_approved and voice_intros_select_approved to
-- authorize through public_profile_media and public_profile_voice_intro, for the reason
-- its header explains at length: a view's underlying-table access runs as the view owner
-- even when the view is referenced from inside another table's RLS policy, which a plain
-- nested join does not. That indirection is why the two policies inherited the viewer
-- hole, and it is why they inherit the fix. Rewriting them here would mean restating
-- 0043's predicate from disk for no gain and some risk.
--
-- THE TWO WRITE POLICIES ARE THE ONLY CLIENT WRITE PATHS IN THE SCHEMA WITH NO PROFILES
-- DEPENDENCY. Every other client write carries a foreign key to public.profiles and fails
-- with 23503 for a session that has none. These two compare a folder name to auth.uid()
-- and stop there, so a profile-less session could upload arbitrary bytes into the private
-- buckets and read them back through *_select_own_folder. The objects would be orphans --
-- the matching profile_media insert fails on that same foreign key, so nothing is ever
-- moderated or served -- but an unmetered, age-unverified write path into storage is not
-- something to leave open on the grounds that the bytes are unreachable.
--
-- Both policies below are 0031's and 0032's text verbatim plus one predicate. The folder
-- comparison already forces a non-null auth.uid() (null::text matches nothing), so the
-- carve-out inside viewer_age_verified() cannot be reached from here.
drop policy if exists "profile_photos_insert_own_folder" on storage.objects;
create policy "profile_photos_insert_own_folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.viewer_age_verified()
  );

drop policy if exists "voice_intros_insert_own_folder" on storage.objects;
create policy "voice_intros_insert_own_folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'voice-intros'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.viewer_age_verified()
  );

-- ---------------------------------------------------------------------------
-- 8. No backfill, and a census that says so out loud.
-- ---------------------------------------------------------------------------
--
-- NOTHING NEEDS BACKFILLING, and the reason is the invariant being replaced. Until today
-- an auth.users row could not exist without a profiles row: the trigger raised on an
-- absent or invalid dob, and a raise inside that trigger rolls the auth.users insert back
-- with it. (It is an AFTER INSERT trigger, on_auth_user_created, as read from the live
-- catalog; an AFTER trigger's raise aborts the same statement a BEFORE one would.) So
-- there is no population of profile-less accounts to repair. Symmetrically there are no profiles rows with a null dob to repair either --
-- 0053 added the NOT NULL after checking live that zero rows had one, and section 1 above
-- just refused to run if that has changed since.
--
-- Every existing profiles row therefore already means what section 2 says it means, and
-- the new state introduced here can only be entered by a signup that happens after this
-- migration is applied.
--
-- The census is a notice, not an assertion. If it ever prints a non-zero count on a
-- cluster that has not yet enabled provider sign-in, that is a fact worth chasing: it
-- would mean an auth.users row was created by some path that bypassed the trigger. It is
-- not a reason to refuse the migration, because after this migration that state is legal.
do $$
declare
  v_orphans bigint;
begin
  select count(*) into v_orphans
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null;

  if v_orphans > 0 then
    raise notice '0067: % auth.users row(s) have no profiles row. After this migration that is the legal "authenticated, age not yet verified" state; before it, it should have been impossible. Worth a look.', v_orphans;
  else
    raise notice '0067: every auth.users row has a profiles row. Nothing to backfill.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Re-running this file.
-- ---------------------------------------------------------------------------
--
-- Safe, and checked clause by clause. Sections 2, 3, 4, 5 and 6b are CREATE OR REPLACE
-- FUNCTION, which is idempotent by definition and preserves each function's ACL, with the
-- grants restated after it regardless. Sections 1 and 8 only read. Section 7 is DROP
-- POLICY IF EXISTS followed by CREATE, the same shape 0031, 0032, 0042 and 0043 all use on
-- these objects.
--
-- Section 6 is the only part where a second run could have done damage, because wrapping
-- an already-wrapped view would nest it twice. It checks the live definition for the
-- guard function's name and skips any view that already carries it, so a re-run
-- re-applies the grants and leaves the definitions alone. That check is also what makes
-- the section self-healing rather than one-shot: a view rewritten flat by some later
-- migration, and so stripped of the predicate, is picked up and re-wrapped the next time
-- this runs.

-- ---------------------------------------------------------------------------
-- 10. What changes for the client, and what this file deliberately did not do.
-- ---------------------------------------------------------------------------
--
-- OBSERVABLE CHANGES, so the app side is not left to discover them:
--
--   * complete_signup(p_dob, p_timezone, p_display_name) exists and is the only way an
--     account created by a provider signup gets a profile. Its four message texts are
--     listed at section 4 and are matched literally by the client.
--   * A session with no profiles row now gets NOTHING from the fourteen public_* views,
--     from get_profile_card (section 6b), and from the two approved-media storage read
--     policies, where it previously got the entire corpus from the views and any card it
--     could name an id for. Empty results, not errors. This sentence originally left out
--     get_profile_card and was wrong for it until 6b was added; it is a claim about the
--     surfaces D3 enumerates, and D3 says how the rest were checked.
--   * A session with no profiles row now gets a raised `age_not_verified` from get_deck
--     and get_online_now, which previously handed it a full deck of real adults, and from
--     get_standouts, perform_swipe, send_rose, send_super_ping and accept_invite as soon
--     as any of them evaluates an age band -- where perform_swipe previously answered
--     'Cannot interact across age groups', which was not true. get_deck_pool_size is
--     unchanged and still answers 0, which was already the right answer. Every one of
--     these should be unreachable once the client routes a profile-less session to the
--     completion screen; they are the backstop for when it does not, and the backstop is
--     loud on purpose, so that a routing bug arrives as an error report and not as
--     silence.
--
-- TWO THINGS LEFT UNDONE ON PURPOSE, both of which need an owner:
--
--   * redeem_invite_code (0066) still raises invite_window_closed for a caller with no
--     profiles row, because its 14-day window reads profiles.created_at and there is no
--     row to read. useInviteRedemption fires on `status === "signed_in"`, which under a
--     provider signup is BEFORE complete_signup, and its error branch deletes the pending
--     code from AsyncStorage permanently -- so every invited provider install would lose
--     its attribution silently. The fix belongs on the client (gate that effect on the
--     profile existing, not on the session existing), and doing it here as well would
--     mean two implementers changing the same behaviour in two different ways. Named here
--     so it cannot be missed; not changed here. The client now does exactly that:
--     useInviteRedemption waits for profileStatus "loaded" (shouldRedeemInvite in
--     apps/mobile/src/lib/invite.ts).
--   * Deleting a profile-less account needs nothing from this file, and gets nothing. The
--     delete-account Edge Function, which owns every other deletion in this system, already
--     reads the profile with .maybeSingle() and so treats no row as "not banned, nothing to
--     preserve", and auth.admin.deleteUser removes the auth.users row (and, through 0068's
--     cascade, the Apple token). What was missing was a door to it: settings/account is
--     behind the tabs layout, which is behind a profile. The client now offers "Delete this
--     sign-in" on the post-auth age gate and in the onboarding wizard's exit sheet, both of
--     which call that same function. No "delete my own profile-less auth user" RPC was
--     added: a second delete path with an authenticated grant would be a liability, not a
--     feature.
