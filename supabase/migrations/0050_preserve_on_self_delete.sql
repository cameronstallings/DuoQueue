-- Closes the gap left by 0046_preserve_safety_evidence.sql: that migration made
-- flagged/rejected media survive ACCOUNT deletion (delete-account copies every
-- non-'approved' profile_media/profile_voice_intro row into
-- preserved_moderation_evidence before deleting anything), but did nothing to stop a
-- user from just deleting the flagged item itself, any time, with no account deletion
-- involved.
--
-- Confirmed live before this migration: profile_media_delete_own is
-- `for delete using (profile_id = auth.uid())` (0029_split_for_all_policies.sql) and
-- profile_voice_intro_delete_own is `for delete using (auth.uid() = profile_id)`
-- (0024_voice_intros.sql) — neither restricts on moderation_status. The client reaches
-- this directly (useRemoveGalleryPhoto in usePhotoUpload.ts, useDeleteVoiceIntro in
-- useVoiceIntro.ts), and the owner can already see the rejected/pending chip on their
-- own item, so they know exactly what to remove. The storage-side delete policies
-- (profile_photos_delete_own_folder / voice_intros_delete_own_folder, both from
-- 0031_security_hardening.sql) are folder-ownership-only, so the underlying object goes
-- with it. Net effect: a user could destroy the one thing 0046 was written to keep —
-- and, per the T&S doc this schema already cites, under-preserving here is the
-- dangerous failure mode.
--
-- Fix is server-side only; the client keeps working unmodified. A user may still remove
-- a flagged item from their own profile (they shouldn't be stuck displaying a rejected
-- photo) — the row delete keeps succeeding either way — but the evidence a moderator
-- needs is no longer destroyable by them:
--
--   1. A BEFORE DELETE trigger on profile_media / profile_voice_intro that, only when
--      the row being removed has moderation_status <> 'approved', inserts the same
--      pointer 0046's delete-account flow would have written, into the same table with
--      the same columns. `on conflict (storage_bucket, storage_path) do nothing`
--      (0046's own unique constraint) makes it idempotent — including against 0046's
--      own preservation, since an account-deletion cascade delete on profile_media now
--      also fires this trigger for each row, redundantly with delete-account's upsert.
--   2. storage.objects DELETE policies gain `and not
--      is_preserved_moderation_path(bucket_id, name)`. preserved_moderation_evidence's
--      only SELECT policy is admin-only (0046), so — per 0043_storage_block_view_join's
--      finding that a plain RLS policy's USING clause runs any base-table reference as
--      the *querying* role, not the object owner — a naive join straight to
--      preserved_moderation_evidence from inside the policy would always resolve empty
--      for a non-admin and the block would be unreachable dead code. 0043 solved that
--      shape (returning filtered rows) by routing through a view, whose underlying-table
--      access runs as the view owner; this is a single boolean point-lookup instead, so
--      it uses this schema's other established tool for the exact same privilege
--      problem — a SECURITY DEFINER function referenced directly inside the policy
--      (is_admin_user, is_blocked_pair), which 0031's header comment confirms is
--      evaluated with the querying role's EXECUTE privilege but the function *body* runs
--      as the owner (postgres, confirmed rolbypassrls = true), bypassing
--      preserved_moderation_evidence's RLS from inside. Preferred over a view here
--      because a view would need `grant select ... to authenticated` to be usable from
--      the policy, which would let any signed-in user enumerate every preserved
--      bucket/path pair across the whole app; the function only ever answers "is this
--      one path preserved", for a path the caller already supplied.
--      service_role bypasses storage.objects RLS entirely (rolbypassrls = true, same as
--      delete-account's existing storage.remove() calls), so moderator/admin cleanup is
--      unaffected.
--   3. preserved_moderation_evidence keeps no FK to profiles (verified still true below
--      the constraint list has never gained one) — cascading a profile delete cannot
--      orphan or block-delete a preservation row, by construction.

-- ---------------------------------------------------------------------------
-- 1. Row-level self-delete: preserve before the row (and its trigger-eligible cascade
--    counterpart from account deletion) goes away.
-- ---------------------------------------------------------------------------

create or replace function public.preserve_flagged_media_before_delete()
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
  return OLD;
end;
$$;

revoke execute on function public.preserve_flagged_media_before_delete() from public, anon, authenticated;

drop trigger if exists preserve_flagged_media_before_delete_trigger on public.profile_media;
create trigger preserve_flagged_media_before_delete_trigger
  before delete on public.profile_media
  for each row
  when (OLD.moderation_status <> 'approved')
  execute function public.preserve_flagged_media_before_delete();

create or replace function public.preserve_flagged_voice_intro_before_delete()
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
  return OLD;
end;
$$;

revoke execute on function public.preserve_flagged_voice_intro_before_delete() from public, anon, authenticated;

drop trigger if exists preserve_flagged_voice_intro_before_delete_trigger on public.profile_voice_intro;
create trigger preserve_flagged_voice_intro_before_delete_trigger
  before delete on public.profile_voice_intro
  for each row
  when (OLD.moderation_status <> 'approved')
  execute function public.preserve_flagged_voice_intro_before_delete();

-- ---------------------------------------------------------------------------
-- 2. Storage object can't be removed once its path is preserved evidence.
-- ---------------------------------------------------------------------------

create or replace function public.is_preserved_moderation_path(p_bucket text, p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.preserved_moderation_evidence
    where storage_bucket = p_bucket and storage_path = p_path
  );
$$;

grant execute on function public.is_preserved_moderation_path(text, text) to authenticated;
revoke execute on function public.is_preserved_moderation_path(text, text) from public, anon;

drop policy if exists "profile_photos_delete_own_folder" on storage.objects;
create policy "profile_photos_delete_own_folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.is_preserved_moderation_path(bucket_id, name)
  );

drop policy if exists "voice_intros_delete_own_folder" on storage.objects;
create policy "voice_intros_delete_own_folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'voice-intros'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.is_preserved_moderation_path(bucket_id, name)
  );
