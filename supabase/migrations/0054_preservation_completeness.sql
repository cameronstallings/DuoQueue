-- Closes three holes the audit found in the evidence-preservation work from 0046/0050:
--
-- (1) CRITICAL — preservation only ever fired on DELETE. The app's real "replace my
--     photo" / "re-record voice intro" flows (uploadProfilePhoto in usePhotoUpload.ts,
--     the recorder in useVoiceIntro.ts) UPDATE the existing profile_media /
--     profile_voice_intro row's storage_path in place — each upload writes to a brand
--     new path (`${profileId}/${role}-${Date.now()}.${ext}`) and repoints the row at it
--     — so a flagged/rejected item could be silently orphaned with zero preservation by
--     just uploading a replacement, no delete involved. Fixed with BEFORE UPDATE
--     triggers mirroring 0050's BEFORE DELETE ones exactly: same preserved_moderation_
--     evidence column shape, same `on conflict (storage_bucket, storage_path) do
--     nothing` idempotency, firing only `when (OLD.moderation_status <> 'approved' and
--     NEW.storage_path is distinct from OLD.storage_path)` — an approved photo being
--     replaced is ordinary product use and stays untouched; only a flagged item's OLD
--     pointer gets preserved before the row moves on to the new path.
--
--     Bonus half-fix bundled in here because it defeats the whole preservation
--     guarantee otherwise: delete-account's storage-removal loop only ever skipped
--     paths it recomputed from *current* profile_media/profile_voice_intro rows at the
--     moment of account deletion. A path preserved earlier by 0050's DELETE trigger (or
--     by this migration's new UPDATE trigger) has no current row pointing at it anymore
--     — it's an intentional orphan — so if the same user later deletes their account,
--     the old loop would find that orphaned object still sitting in their storage
--     folder, see no current row claiming it, and delete it anyway, destroying the exact
--     thing 0050 was written to keep. delete-account (this migration's companion file
--     change) now also unions in every path already present in
--     preserved_moderation_evidence for this profile before it removes anything.
--
-- (2) CRITICAL — self-deleting a reported account destroyed the match and every message
--     in it. profiles.id -> auth.users(id) is `on delete cascade`, and matches.user_a_id
--     / user_b_id -> profiles(id) is also `on delete cascade` (messages.match_id ->
--     matches(id) cascades further), so auth.admin.deleteUser() on a reported account
--     wiped exactly the record docs/legal/trust-and-safety.md section 4(b) promises to
--     keep. Per that doc's own predicate (section 4b's proposed fix, and the report-
--     reason semantics in section 4 generally): an open `underage` report against this
--     profile (reported_profile_id = the deleting user, reason = 'underage', status <>
--     'dismissed') blocks a normal delete.
--
--     Chosen remedy: anonymize-but-retain, not a flat refusal. A flat "we will never
--     delete your account" has real GDPR-erasure tension (Article 17's own text
--     preserves a "legal obligation" / "public interest" exception, but a blanket
--     refusal with no minimization at all sits closer to the line than we need to). The
--     honest middle is to retain only what section 4(b) actually requires — this
--     profile's identity row (so the report keeps resolving to something), every match
--     and message it's a party to, and any flagged media (already handled by (1)) — and
--     strip what a legal hold has no use for: display_name, bio, discord_username. The
--     account is simultaneously frozen (is_active = false, is_banned = true) using the
--     exact two flags section 4(a) already names as the suspension action, so it drops
--     out of discovery and every is_banned_user()-gated RPC (swipe/rose/unmatch/
--     messaging) refuses it immediately — functionally gone to every other user, not
--     deleted out from under an open investigation.
--
--     Deliberately NOT attempted here: a full sweep of every other profile-linked table
--     (profile_games/shows/platforms/languages/playstyles/preferences/push_tokens/
--     notification_settings/subscriptions/swipes/party_*/etc — 20+ tables). Retaining a
--     few rows of game-preference data nobody will ever look at is a smaller, more
--     honest gap than a hand-rolled 20-table purge landing untested in the same
--     migration as the actual safety fix. Logged here as a follow-up, not silently
--     skipped: full data-minimization for a legal-hold profile remains open.
--
-- (3) CRITICAL — banning wasn't durable. is_banned lives only on profiles, which is
--     gone the moment the banned user deletes their own account (see (2)'s cascade
--     chain) — they walk straight back in by re-registering the same email. Fixed with
--     banned_identities: a standalone table keyed on a SHA-256 hash of the lowercased
--     email (survives both the profile AND the auth.users row being gone — nothing else
--     about an identity survives account deletion), consulted by handle_new_user on
--     every signup (rejects, same as the existing 18+ check) and populated by
--     set_profile_ban whenever an admin bans someone. delete-account also now refuses
--     outright to remove a currently-banned profile (is_banned = true), so a ban can't
--     be raced by self-deleting the instant it lands, independent of the
--     banned_identities backstop.
--
--     Session termination: an admin flipping is_banned = true previously left any
--     already-issued JWT valid until its own expiry — profiles.is_banned is checked
--     fresh on every write RPC (is_banned_user(), already live since 0042) so writes
--     were never actually exploitable mid-session, but the session itself kept working.
--     apply_durable_ban() now also sets auth.users.banned_until far in the future
--     (blocks all future sign-in/refresh — this is GoTrue's own native ban field) and
--     deletes the user's rows from auth.sessions / auth.refresh_tokens directly (the
--     same effect auth.admin.signOut(uid, 'global') has), done here in plain SQL with no
--     external HTTP call or secret material needed: the migration role already holds
--     UPDATE on auth.users and DELETE on auth.sessions/auth.refresh_tokens (confirmed via
--     information_schema.role_table_grants before writing this), and every function
--     touching the auth schema is SECURITY DEFINER owned by that same role, so nested
--     calls (set_profile_ban -> apply_durable_ban) never need a separate grant — the
--     same ownership-elevation pattern is_banned_user()/is_admin_user() already rely on
--     throughout this schema.
--
--     What an operator runs to ban someone today: the existing admin console action
--     (which already calls set_profile_ban(profile_id, true, reason) via RPC) is now
--     sufficient end-to-end — no separate manual step required. There is still no admin
--     UI *button* for it (docs/legal/trust-and-safety.md open item #5, unchanged by this
--     migration) — until then, an operator runs:
--       select set_profile_ban('<profile-id>'::uuid, true, 'reason text');
--     via scripts/db/run-sql.ps1, authenticated as an is_admin=true profile is not
--     required for a direct postgres/service-role SQL connection (RLS/is_admin_user()
--     only gate the RPC path a client would use).

-- ---------------------------------------------------------------------------
-- (1a) BEFORE UPDATE preservation triggers, mirroring 0050's BEFORE DELETE ones.
-- ---------------------------------------------------------------------------

create or replace function public.preserve_flagged_media_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.preserved_moderation_evidence (
    original_profile_id, original_media_id, media_kind, storage_bucket, storage_path,
    moderation_status, media_created_at
  ) values (
    OLD.profile_id, OLD.id, 'profile_photo', 'profile-photos', OLD.storage_path,
    OLD.moderation_status, OLD.created_at
  )
  on conflict (storage_bucket, storage_path) do nothing;
  return NEW;
end;
$$;

revoke execute on function public.preserve_flagged_media_before_update() from public, anon, authenticated;

drop trigger if exists preserve_flagged_media_before_update_trigger on public.profile_media;
create trigger preserve_flagged_media_before_update_trigger
  before update on public.profile_media
  for each row
  when (OLD.moderation_status <> 'approved' and NEW.storage_path is distinct from OLD.storage_path)
  execute function public.preserve_flagged_media_before_update();

create or replace function public.preserve_flagged_voice_intro_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.preserved_moderation_evidence (
    original_profile_id, original_media_id, media_kind, storage_bucket, storage_path,
    moderation_status, media_created_at
  ) values (
    OLD.profile_id, null, 'voice_intro', 'voice-intros', OLD.storage_path,
    OLD.moderation_status, OLD.created_at
  )
  on conflict (storage_bucket, storage_path) do nothing;
  return NEW;
end;
$$;

revoke execute on function public.preserve_flagged_voice_intro_before_update() from public, anon, authenticated;

drop trigger if exists preserve_flagged_voice_intro_before_update_trigger on public.profile_voice_intro;
create trigger preserve_flagged_voice_intro_before_update_trigger
  before update on public.profile_voice_intro
  for each row
  when (OLD.moderation_status <> 'approved' and NEW.storage_path is distinct from OLD.storage_path)
  execute function public.preserve_flagged_voice_intro_before_update();

-- ---------------------------------------------------------------------------
-- (3a) Durable, email-keyed ban record — survives both profiles and auth.users.
-- ---------------------------------------------------------------------------

create or replace function public.email_identity_hash(p_email text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex');
$$;

revoke execute on function public.email_identity_hash(text) from public, anon, authenticated;

create table public.banned_identities (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null unique,
  -- Informational only, no FK: both may be long gone by the time anyone reads this row.
  last_known_auth_user_id uuid,
  last_known_profile_id uuid,
  reason text,
  banned_at timestamptz not null default now(),
  banned_by uuid,
  unbanned_at timestamptz,
  constraint banned_identities_reason_length check (reason is null or char_length(reason) <= 500)
);

create index banned_identities_last_known_profile_id_idx
  on public.banned_identities (last_known_profile_id);

alter table public.banned_identities enable row level security;

-- Same admin-only-read, function-only-write shape as preserved_moderation_evidence
-- (0046): no insert/update/delete policy exists for anyone, including admins — the only
-- writers are apply_durable_ban() and set_profile_ban()'s unban branch below, both
-- SECURITY DEFINER owned by postgres, which bypasses RLS.
create policy "banned_identities_select_admin"
  on public.banned_identities
  for select to authenticated using (public.is_admin_user());

grant select on public.banned_identities to authenticated;
revoke select on public.banned_identities from anon;

-- ---------------------------------------------------------------------------
-- (3b) Shared helper: register the durable ban + kill the live session. Called from the
-- admin ban path (set_profile_ban) and the self-delete legal-hold freeze path below.
-- Never exposed directly — always reached through one of those two SECURITY DEFINER
-- callers, which run as postgres and so retain execute regardless of the revoke.
-- ---------------------------------------------------------------------------

create or replace function public.apply_durable_ban(p_profile_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_hash text;
begin
  select email into v_email from auth.users where id = p_profile_id;

  if v_email is not null then
    v_hash := public.email_identity_hash(v_email);
    insert into public.banned_identities
      (email_hash, last_known_auth_user_id, last_known_profile_id, reason, banned_by)
    values (v_hash, p_profile_id, p_profile_id, p_reason, auth.uid())
    on conflict (email_hash) do update
      set banned_at = now(),
          reason = coalesce(excluded.reason, public.banned_identities.reason),
          unbanned_at = null,
          banned_by = excluded.banned_by,
          last_known_auth_user_id = excluded.last_known_auth_user_id,
          last_known_profile_id = excluded.last_known_profile_id;
  end if;

  -- Native GoTrue ban field: blocks every future sign-in/refresh, independent of
  -- anything in `public` and independent of the profiles row surviving.
  update auth.users set banned_until = now() + interval '100 years' where id = p_profile_id;

  -- Terminate the live session now instead of waiting for an already-issued JWT to
  -- expire on its own — the same effect auth.admin.signOut(id, 'global') has, done in
  -- plain SQL against the auth schema tables the migration role already has DELETE on.
  delete from auth.refresh_tokens where user_id = p_profile_id::text;
  delete from auth.sessions where user_id = p_profile_id;
end;
$$;

revoke execute on function public.apply_durable_ban(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- (3c) Wire the admin ban path (0042) into the durable ban + session kill, and let
-- unbanning clear the durable record too. Same signature as 0042's original, so the
-- existing `grant execute ... to authenticated` on this function name/arg-list carries
-- forward unchanged (CREATE OR REPLACE only swaps the body).
-- ---------------------------------------------------------------------------

create or replace function public.set_profile_ban(p_profile_id uuid, p_banned boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set is_banned = p_banned,
      banned_at = case when p_banned then now() else null end,
      ban_reason = case when p_banned then p_reason else null end
  where id = p_profile_id;

  if p_banned then
    perform public.apply_durable_ban(p_profile_id, p_reason);
  else
    update public.banned_identities bi
    set unbanned_at = now()
    from auth.users u
    where u.id = p_profile_id
      and bi.email_hash = public.email_identity_hash(u.email);

    update auth.users set banned_until = null where id = p_profile_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- (3d) Consult the durable ban list at signup. Same signature/trigger as 0031's
-- handle_new_user, only the body changes — the existing `on auth.users after insert`
-- trigger keeps firing it unmodified.
-- ---------------------------------------------------------------------------

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
  if new.email is not null and exists (
    select 1 from public.banned_identities
    where email_hash = public.email_identity_hash(new.email)
      and unbanned_at is null
  ) then
    raise exception 'This account has been banned and cannot be re-created.';
  end if;

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

-- ---------------------------------------------------------------------------
-- (2a) Legal-hold freeze for delete-account's open-underage-report path. Anonymizes the
-- identifying text fields, suspends + bans the profile (removes it from discovery and
-- every is_banned_user()-gated RPC), and reuses (3b)'s durable-ban + session-kill so the
-- account can't just be raced back into use. Deliberately leaves matches, messages,
-- profile_media/profile_voice_intro rows, and their storage objects completely
-- untouched — delete-account (companion file change) skips its removal loop entirely
-- for this path rather than trying to decide which media is "safe" to remove.
-- ---------------------------------------------------------------------------

create or replace function public.freeze_account_for_legal_hold(p_profile_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set is_active = false,
      is_banned = true,
      banned_at = now(),
      ban_reason = p_reason,
      display_name = null,
      bio = null,
      discord_username = null
  where id = p_profile_id;

  perform public.apply_durable_ban(p_profile_id, p_reason);
end;
$$;

revoke execute on function public.freeze_account_for_legal_hold(uuid, text) from public, anon, authenticated;
