-- Security hardening pass, from a full audit of the schema, Edge Functions and client.
--
-- Each section below closes a hole where the database was relying on the client to
-- behave. The theme is the same one the rest of this schema follows: RLS decides which
-- ROWS you can touch, but only column-level grants decide which COLUMNS — and a
-- SECURITY DEFINER function is only as safe as the set of roles allowed to execute it.

-- ---------------------------------------------------------------------------
-- 1. CRITICAL — profiles: is_admin (and dob/timezone) were client-writable.
--
-- 0001 granted table-level UPDATE on profiles, and profiles_update_own only checks
-- `auth.uid() = id` — which constrains the row, not the columns. Every column added
-- later inherited that grant, so once 0006 added is_admin, any user could
-- `update profiles set is_admin = true where id = auth.uid()` straight through
-- PostgREST with the public anon key and their own JWT. That unlocks every admin
-- policy at once: all reports, every user's dob/discord_username, and — via
-- messages_select_admin — every private message in the app.
--
-- dob is excluded because it is the 18+ age gate (set once from signup metadata by
-- handle_new_user; a user must not be able to re-age themselves).
-- timezone is excluded because the daily swipe/Super Ping quota is keyed on the
-- user's local day: flipping between Etc/GMT+12 and Pacific/Kiritimati spans 26 hours
-- and hands out a second full quota bucket on demand (see also section 6).
-- is_looking_now/looking_now_expires_at already have set_looking_now().
revoke update on public.profiles from authenticated;
grant update (
  display_name,
  gender,
  region,
  bio,
  discord_username,
  onboarding_completed,
  is_active,
  hide_last_active,
  last_active_at,
  usual_play_start_hour,
  usual_play_end_hour
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. HIGH — SECURITY DEFINER helpers were executable by PUBLIC (including anon).
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, and only
-- grant_consumable_credits (0013) ever revoked it. The worst case was
-- notify_via_edge_function: it reads internal_trigger_token out of app_config — a
-- table with no grants at all — and POSTs a caller-supplied body to
-- send-push-notification with that token attached. Anyone holding just the anon key
-- could forge unlimited push notifications to any user ("You matched with X"), a
-- ready-made phishing channel, and the function's `exception when others` swallow
-- made it silent.
--
-- The rest are internal predicates that take a caller-supplied uuid and answer
-- questions about strangers (is this account premium / a minor / email-verified,
-- have these two blocked each other) — reconnaissance building blocks that no client
-- has any reason to call directly.
alter default privileges in schema public revoke execute on functions from public;

revoke execute on function public.notify_via_edge_function(jsonb) from public, anon, authenticated;
revoke execute on function public.is_premium(uuid) from public, anon, authenticated;
revoke execute on function public.is_minor(uuid) from public, anon, authenticated;
revoke execute on function public.same_age_band(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_blocked_pair(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_email_verified(uuid) from public, anon, authenticated;
revoke execute on function public.is_conversation_unlocked(uuid) from public, anon, authenticated;

-- is_admin_user and is_party_member are referenced inside RLS policy expressions,
-- which are evaluated with the *querying* role's privileges — revoking EXECUTE from
-- authenticated would make every policy that calls them raise "permission denied"
-- and lock users out of their own rows. They stay granted; only anon loses access.
revoke execute on function public.is_admin_user() from public, anon;
revoke execute on function public.is_party_member(uuid, uuid) from public, anon;
revoke execute on function public.play_window_overlap_hours(smallint, smallint, text, smallint, smallint, text)
  from public, anon, authenticated;
revoke execute on function public.get_profiles_needing_swipe_refresh_notification()
  from public, anon, authenticated;

-- Trigger functions: only ever invoked by the trigger machinery as the table owner.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_block() from public, anon, authenticated;
revoke execute on function public.handle_match_unmatched() from public, anon, authenticated;
revoke execute on function public.notify_new_match() from public, anon, authenticated;
revoke execute on function public.notify_new_message() from public, anon, authenticated;
revoke execute on function public.notify_super_ping() from public, anon, authenticated;
revoke execute on function public.reset_voice_intro_moderation() from public, anon, authenticated;
revoke execute on function public.enforce_verified_email_before_visible() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Client-facing RPCs keep their explicit `authenticated` grant, but lose PUBLIC/anon:
-- every one of them derives identity from auth.uid() and is useless (or worse) to an
-- unauthenticated caller.
revoke execute on function public.get_deck(int) from public, anon;
revoke execute on function public.perform_swipe(uuid, swipe_action_enum) from public, anon;
revoke execute on function public.get_swipe_quota() from public, anon;
revoke execute on function public.get_standouts(int) from public, anon;
revoke execute on function public.get_matches_summary() from public, anon;
revoke execute on function public.unmatch(uuid) from public, anon;
revoke execute on function public.get_shared_discord_username(uuid, uuid) from public, anon;
revoke execute on function public.get_admirers() from public, anon;
revoke execute on function public.get_admirers_count() from public, anon;
revoke execute on function public.send_super_ping(uuid) from public, anon;
revoke execute on function public.get_blocked_users() from public, anon;
revoke execute on function public.get_consumable_credits() from public, anon;
revoke execute on function public.activate_boost() from public, anon;
revoke execute on function public.send_rose(uuid) from public, anon;
revoke execute on function public.get_online_now(int) from public, anon;
revoke execute on function public.set_looking_now(boolean) from public, anon;
revoke execute on function public.heartbeat() from public, anon;
revoke execute on function public.get_reputation(uuid) from public, anon;
revoke execute on function public.submit_match_feedback(uuid, match_feedback_tag_enum[]) from public, anon;
revoke execute on function public.propose_session(uuid, timestamptz) from public, anon;
revoke execute on function public.respond_session(uuid, boolean) from public, anon;
revoke execute on function public.cancel_session(uuid) from public, anon;
revoke execute on function public.review_voice_intro(uuid, boolean) from public, anon;
revoke execute on function public.start_steam_link() from public, anon;
revoke execute on function public.create_party(uuid) from public, anon;
revoke execute on function public.get_my_parties() from public, anon;
revoke execute on function public.get_my_party_invites() from public, anon;
revoke execute on function public.respond_party_invite(uuid, boolean) from public, anon;
revoke execute on function public.get_party_deck(uuid, int) from public, anon;
revoke execute on function public.perform_party_swipe(uuid, uuid, swipe_action_enum) from public, anon;
revoke execute on function public.send_party_message(uuid, text) from public, anon;

-- ---------------------------------------------------------------------------
-- 3. HIGH — profile_media: moderation could be skipped entirely, and storage_path
--    was unconstrained.
--
-- 0006 narrowed the UPDATE grant so a client couldn't self-approve a photo, but the
-- table-level INSERT grant from 0001 still covered moderation_status — so a client
-- could simply INSERT the row pre-approved and never call moderate-photo at all,
-- skipping NSFW review, format validation, and the server-side EXIF/GPS strip. On a
-- profile photo, intact GPS is a live doxxing vector.
--
-- Worse, storage_path was never tied to the owning profile even though every storage
-- policy is built on the `${profile_id}/${filename}` convention. A user could point
-- their own row at *another user's* object path; moderate-photo would then use the
-- service role (bypassing storage RLS) to download it, overwrite it in place, and mark
-- it approved — publishing a victim's pending/rejected photo to the whole app under
-- the attacker's name.
revoke insert on public.profile_media from authenticated;
grant insert (profile_id, storage_path, photo_role) on public.profile_media to authenticated;

alter table public.profile_media
  add constraint profile_media_storage_path_owned
  check (storage_path like profile_id::text || '/%') not valid;

alter table public.profile_voice_intro
  add constraint profile_voice_intro_storage_path_owned
  check (storage_path like profile_id::text || '/%') not valid;

-- Repointing a photo must send it back through moderation. profile_voice_intro has
-- had this since 0024 (reset_voice_intro_moderation); profile_media never did, which
-- meant an approved row could be aimed at new bytes and stay approved.
create or replace function public.reset_media_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.storage_path is distinct from old.storage_path then
    new.moderation_status := 'pending';
  end if;
  return new;
end;
$$;

revoke execute on function public.reset_media_moderation() from public, anon, authenticated;

drop trigger if exists reset_media_moderation_trigger on public.profile_media;
create trigger reset_media_moderation_trigger
  before update on public.profile_media
  for each row execute function public.reset_media_moderation();

-- 0029 decided whether to create profile_media_update_own by checking
-- information_schema.role_table_grants, which lists table-level privileges only —
-- profile_media's UPDATE has been column-level since 0006, so the row read as
-- "no grant" and no UPDATE policy was ever created. Replacing a photo has been
-- failing with a permission error ever since. Create it unconditionally; the column
-- grant (storage_path only) is what keeps moderation_status out of reach.
drop policy if exists "profile_media_update_own" on public.profile_media;
create policy "profile_media_update_own" on public.profile_media
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. HIGH — storage read policies applied to PUBLIC, so the anon key alone could
--    scrape every approved photo and voice intro.
--
-- These policies were created with no TO clause, which means PUBLIC — and Supabase
-- grants anon SELECT on storage.objects. The anon key ships inside the mobile bundle
-- by design, so anyone who pulled it out could enumerate and download the entire
-- corpus of user photos and voice recordings from these "private" buckets without
-- ever creating an account. 0002's header comment says read access goes to "anyone
-- when the photo has been through moderation"; that plainly meant any signed-in user.
--
-- The approved-photo policy also now re-checks the folder convention, so a mismatched
-- profile_media.storage_path row can't be used to unlock somebody else's object.
drop policy if exists "profile_photos_select_own_folder" on storage.objects;
create policy "profile_photos_select_own_folder" on storage.objects
  for select to authenticated using (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_photos_select_approved" on storage.objects;
create policy "profile_photos_select_approved" on storage.objects
  for select to authenticated using (
    bucket_id = 'profile-photos'
    and exists (
      select 1
      from public.profile_media pm
      join public.profiles p on p.id = pm.profile_id
      where pm.storage_path = storage.objects.name
        and pm.moderation_status = 'approved'
        and p.is_active = true
        and p.onboarding_completed = true
        and (storage.foldername(storage.objects.name))[1] = pm.profile_id::text
    )
  );

drop policy if exists "profile_photos_insert_own_folder" on storage.objects;
create policy "profile_photos_insert_own_folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No UPDATE policy on profile-photos: objects are write-once.
--
-- Moderation approves a specific object, but approval was recorded against a path the
-- uploader could still overwrite — upload something benign, get approved, then PUT
-- arbitrary bytes to the same key and keep the approved flag. The client already
-- writes a fresh timestamped path per upload, so nothing legitimate needs to overwrite
-- in place; dropping the policy makes approved bytes immutable and closes that gap.
drop policy if exists "profile_photos_update_own_folder" on storage.objects;

drop policy if exists "profile_photos_delete_own_folder" on storage.objects;
create policy "profile_photos_delete_own_folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "voice_intros_select_approved" on storage.objects;
create policy "voice_intros_select_approved" on storage.objects
  for select to authenticated using (
    bucket_id = 'voice-intros'
    and exists (
      select 1
      from public.profile_voice_intro pvi
      join public.profiles p on p.id = pvi.profile_id
      where pvi.storage_path = storage.objects.name
        and pvi.moderation_status = 'approved'
        and p.is_active = true
        and p.onboarding_completed = true
        and (storage.foldername(storage.objects.name))[1] = pvi.profile_id::text
    )
  );

-- ---------------------------------------------------------------------------
-- 5. HIGH — party invites routed around blocks.
--
-- get_party_deck filters blocked users, but perform_party_swipe took an arbitrary
-- p_target_id and checked only party membership and self-swipe. Two party members
-- could therefore call the RPC directly against someone who had blocked one of them,
-- reach unanimity, and land a party invite in that person's app — putting a blocker
-- and their blocked user into a shared party chat, which has no profanity filter.
-- Blocking is the app's primary safety control; nothing may route around it.
-- The age-band partition is re-applied here for the same reason.
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
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
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

  insert into public.party_swipes (party_id, member_id, target_id, action)
  values (p_party_id, v_me, p_target_id, p_action)
  on conflict (party_id, member_id, target_id) do update set action = excluded.action, created_at = now();

  invited := false;

  if p_action = 'like' then
    select count(*) into v_member_count from public.party_members where party_id = p_party_id;
    select count(*) into v_like_count
    from public.party_swipes ps
    where ps.party_id = p_party_id and ps.target_id = p_target_id and ps.action = 'like'
      and ps.member_id in (select profile_id from public.party_members where party_id = p_party_id);

    if v_member_count > 0 and v_like_count >= v_member_count then
      insert into public.party_invites (party_id, target_id) values (p_party_id, p_target_id)
      on conflict (party_id, target_id) do nothing;
      invited := true;
    end if;
  end if;

  return next;
end;
$$;

grant execute on function public.perform_party_swipe(uuid, uuid, swipe_action_enum) to authenticated;

-- Blocking someone already unmatches them; it must also pull the two of you out of
-- any shared party and cancel any pending invite between you.
create or replace function public.handle_new_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.matches
  set unmatched_at = now(), unmatched_by = new.blocker_id
  where unmatched_at is null
    and ((user_a_id = new.blocker_id and user_b_id = new.blocked_id)
      or (user_a_id = new.blocked_id and user_b_id = new.blocker_id));

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
$$;

revoke execute on function public.handle_new_block() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. MEDIUM — an unvalidated timezone string was both a quota bypass and a
--    cross-user denial of service.
--
-- profiles.timezone is free-form text. perform_swipe/send_super_ping key the daily
-- counter on `(now() at time zone timezone)::date`, so a user who could edit it got
-- extra quota buckets (closed by section 1's grant). Independently,
-- play_window_overlap_hours dereferences each *candidate's* timezone inside get_deck:
-- one account with a bogus value made `at time zone` raise, breaking the deck for
-- every viewer whose candidate pool contained it, and likewise killing the scheduled
-- notification run for everyone. Validate the column, and make the read path
-- fail-soft to UTC so bad data can never take the deck down again.
create or replace function public.is_valid_timezone(p_tz text)
returns boolean
language sql
stable
as $$
  select p_tz is null or exists (select 1 from pg_timezone_names where name = p_tz);
$$;

-- Referenced from a CHECK constraint, so it is evaluated as the writing role and must
-- stay executable by authenticated. It reveals nothing — it only answers "is this a
-- real IANA timezone name".
revoke execute on function public.is_valid_timezone(text) from public, anon;
grant execute on function public.is_valid_timezone(text) to authenticated;

alter table public.profiles
  add constraint profiles_timezone_valid check (public.is_valid_timezone(timezone)) not valid;

-- Identical scoring to 0020; the only change is that resolving each side's UTC offset
-- now falls back to 0 instead of propagating an exception out of get_deck.
create or replace function public.play_window_overlap_hours(
  a_start smallint, a_end smallint, a_tz text,
  b_start smallint, b_end smallint, b_tz text
)
returns smallint
language plpgsql
stable
set search_path = public
as $$
declare
  a_offset numeric;
  b_offset numeric;
  a_hours int[];
  b_hours int[];
  overlap_count int;
begin
  if a_start is null or a_end is null or b_start is null or b_end is null then
    return 0;
  end if;

  begin
    a_offset := extract(epoch from ((now() at time zone coalesce(a_tz, 'utc')) - (now() at time zone 'utc'))) / 3600;
  exception when others then
    a_offset := 0;
  end;

  begin
    b_offset := extract(epoch from ((now() at time zone coalesce(b_tz, 'utc')) - (now() at time zone 'utc'))) / 3600;
  exception when others then
    b_offset := 0;
  end;

  select array_agg((((h - a_offset)::int % 24) + 24) % 24) into a_hours
  from generate_series(0, 23) as h
  where (a_start <= a_end and h between a_start and a_end)
     or (a_start > a_end and (h >= a_start or h <= a_end));

  select array_agg((((h - b_offset)::int % 24) + 24) % 24) into b_hours
  from generate_series(0, 23) as h
  where (b_start <= b_end and h between b_start and b_end)
     or (b_start > b_end and (h >= b_start or h <= b_end));

  select count(*) into overlap_count from unnest(a_hours) au where au = any (b_hours);

  return coalesce(overlap_count, 0);
end;
$$;

revoke execute on function public.play_window_overlap_hours(smallint, smallint, text, smallint, smallint, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. MEDIUM — the 18+ gate had a NULL hole.
--
-- The age CHECK reads `dob is null or dob <= ...`, so "no date of birth" always
-- satisfies it, and handle_new_user silently stored NULL for any unparseable dob in
-- the signup metadata. Downstream, is_minor() returns NULL for such a profile, so
-- same_age_band() returns NULL, and `if not same_age_band(...)` is NULL — which does
-- not raise. The account is hidden from get_deck but can still swipe, rose, match and
-- chat by target id. Fail closed instead: unknown age is treated as a mismatch.
create or replace function public.same_age_band(user1 uuid, user2 uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_minor(user1) = public.is_minor(user2), false);
$$;

revoke execute on function public.same_age_band(uuid, uuid) from public, anon, authenticated;

-- Reject signups that don't carry a valid, 18+ date of birth, rather than storing
-- NULL and letting the account through in an ambiguous state.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob text := new.raw_user_meta_data ->> 'dob';
  v_timezone text := new.raw_user_meta_data ->> 'timezone';
  v_parsed_dob date;
begin
  if v_dob !~ '^\d{4}-\d{2}-\d{2}$' then
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
-- 8. MEDIUM — get_reputation published private negative feedback about anyone.
--
-- 0022 describes "flaked" as private feedback a user sees only about themselves, but
-- that was enforced only in the client: the RPC took any profile id and returned all
-- tag counts. Anyone could walk the ids in public_profiles and build a per-user
-- flake dossier. Enforce the intent server-side.
create or replace function public.get_reputation(p_profile_id uuid)
returns table (tag match_feedback_tag_enum, tag_count int)
language sql
stable
security definer
set search_path = public
as $$
  select mf.tag, count(*)::int
  from public.match_feedback mf
  where mf.ratee_id = p_profile_id
    and (p_profile_id = auth.uid() or mf.tag <> 'flaked')
  group by mf.tag;
$$;

grant execute on function public.get_reputation(uuid) to authenticated;
revoke execute on function public.get_reputation(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- 9. LOW — five public sub-profile views omitted the onboarding_completed filter.
--
-- 0028 hangs the email-verification guarantee entirely on onboarding_completed ("an
-- unverified account is automatically invisible everywhere, including in any surface
-- added later"). These five views only filtered is_active, so a half-registered or
-- unverified account's games, shows, platforms, languages, playstyles and photos were
-- still readable. Bring them in line with public_profiles.
create or replace view public.public_profile_games as
  select pg.profile_id, pg.game_id, g.name as game_name, pg.skill_level, pg.rank_text, pg.priority
  from public.profile_games pg
  join public.games g on g.id = pg.game_id
  join public.profiles p on p.id = pg.profile_id
  where p.is_active = true and p.onboarding_completed = true;

create or replace view public.public_profile_shows as
  select ps.profile_id, ps.show_id, s.name as show_name, s.category, ps.priority
  from public.profile_shows ps
  join public.shows s on s.id = ps.show_id
  join public.profiles p on p.id = ps.profile_id
  where p.is_active = true and p.onboarding_completed = true;

create or replace view public.public_profile_platforms as
  select pp.profile_id, pp.platform
  from public.profile_platforms pp
  join public.profiles p on p.id = pp.profile_id
  where p.is_active = true and p.onboarding_completed = true;

create or replace view public.public_profile_languages as
  select pl.profile_id, pl.language_code
  from public.profile_languages pl
  join public.profiles p on p.id = pl.profile_id
  where p.is_active = true and p.onboarding_completed = true;

create or replace view public.public_profile_playstyles as
  select pps.profile_id, pps.tag
  from public.profile_playstyles pps
  join public.profiles p on p.id = pps.profile_id
  where p.is_active = true and p.onboarding_completed = true;

create or replace view public.public_profile_media as
  select pm.id, pm.profile_id, pm.storage_path, pm.photo_role
  from public.profile_media pm
  join public.profiles p on p.id = pm.profile_id
  where pm.moderation_status = 'approved'
    and p.is_active = true
    and p.onboarding_completed = true;

grant select on public.public_profile_games to authenticated;
grant select on public.public_profile_shows to authenticated;
grant select on public.public_profile_platforms to authenticated;
grant select on public.public_profile_languages to authenticated;
grant select on public.public_profile_playstyles to authenticated;
grant select on public.public_profile_media to authenticated;

-- No view in this schema should be readable without an account. The anon key is
-- public by design (it ships in the app bundle), so anon SELECT on a profile view is
-- an open scraping endpoint.
revoke select on public.public_profiles from anon;
revoke select on public.public_profile_games from anon;
revoke select on public.public_profile_shows from anon;
revoke select on public.public_profile_platforms from anon;
revoke select on public.public_profile_languages from anon;
revoke select on public.public_profile_playstyles from anon;
revoke select on public.public_profile_media from anon;
revoke select on public.public_profile_prompts from anon;
revoke select on public.public_profile_vibe from anon;
revoke select on public.public_profile_schedule from anon;
revoke select on public.public_profile_activity from anon;
revoke select on public.public_profile_voice_intro from anon;
revoke select on public.public_linked_accounts from anon;

-- ---------------------------------------------------------------------------
-- 10. LOW — the shared games/shows catalogs accepted unbounded user-authored rows.
--
-- Any account could insert unlimited custom entries with arbitrary text into tables
-- every other user reads, with no length limit, no moderation and no delete path —
-- a cheap slur/spam injection straight into everyone's game picker.
alter table public.games
  add constraint games_name_length check (char_length(name) between 1 and 80) not valid;
alter table public.shows
  add constraint shows_name_length check (char_length(name) between 1 and 80) not valid;

-- ---------------------------------------------------------------------------
-- 11. LOW — Steam link state tokens never expired.
--
-- 0025 calls them "short-lived, single-use" and stores created_at, but nothing ever
-- enforced a TTL, so an abandoned link attempt left a token valid forever. The token
-- travels in a URL to Steam, so it can survive in browser history or proxy logs.
create or replace function public.consume_steam_link_state(p_state text)
returns uuid
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.steam_link_state
  where state = p_state
    and created_at > now() - interval '15 minutes'
  returning profile_id;
$$;

revoke execute on function public.consume_steam_link_state(text) from public, anon, authenticated;
grant execute on function public.consume_steam_link_state(text) to service_role;
