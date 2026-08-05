-- Correction to 0042_audit_hardening.sql's storage-policy fix, found while verifying
-- it. This repo's convention is "never edited after being applied — add a new one
-- instead" (.claude/skills/db/SKILL.md), so this lands as its own migration rather
-- than rewriting 0042 in place.
--
-- 0042 ported 0035's block-exclusion predicate into profile_photos_select_approved and
-- voice_intros_select_approved by joining straight to profile_media/profile_voice_intro
-- + profiles (base tables) inside the policy's EXISTS clause, mirroring the shape those
-- two policies already had since 0031. Verifying it (begin/rollback + set local role
-- authenticated + request.jwt.claims, as two real accounts) surfaced that this join
-- can never resolve true for a genuine cross-user request, block or no block:
-- profile_media/profiles restrict SELECT to the owning row (profile_id = auth.uid()) or
-- an admin, and — unlike a VIEW, which Postgres evaluates against the underlying tables
-- using the view OWNER's privileges regardless of where the view is referenced — a
-- plain RLS POLICY's USING clause has no such privilege escalation: a table referenced
-- inside it is subject to that table's own RLS, evaluated as the CURRENT querying role.
-- So the nested profile_media/profiles lookup was being run as the viewer (e.g.
-- KittyKat), whose only visible profile_media/profiles row is her own, not the
-- photo-owner's — making the EXISTS false for anyone but the object's owner.
--
-- This traces back to before this migration: re-running the identical check against
-- the exact pre-audit (0031) policy text produced the same empty result, so it is not
-- something 0042 introduced — it means a cross-user profile_photos_select_approved /
-- voice_intros_select_approved read may never have actually authorized via
-- storage.objects RLS the way apps/mobile/src/lib/storage.ts's signPhotoUrls /
-- signVoiceIntroUrl (client-side createSignedUrl(s), gated by the caller's own
-- storage.objects RLS per that file's own header comment) expects. Left as-is, 0042's
-- new block predicate would have been unreachable dead code sitting behind an
-- already-closed door, and the door being closed for everyone (not just a blocked
-- pair) is worse than what 0042 was asked to fix.
--
-- Fix: join through public_profile_media / public_profile_voice_intro instead of the
-- base tables — the same already-block-aware (0035) views the rest of the app already
-- reads other users' profile data through. A view's underlying-table access runs as the
-- view owner even when the view is referenced from inside another table's RLS policy
-- (confirmed live: querying public_profile_media directly, or via a nested EXISTS, as a
-- non-owner authenticated user resolves the other profile's row; querying profile_media
-- itself the same way resolves nothing). One join swap restores real cross-user
-- visibility and keeps the block predicate, moderation/active/onboarding checks, and
-- folder-ownership check, since the view already encodes all of them.

drop policy if exists "profile_photos_select_approved" on storage.objects;
create policy "profile_photos_select_approved" on storage.objects
  for select to authenticated using (
    bucket_id = 'profile-photos'
    and exists (
      select 1 from public.public_profile_media pm
      where pm.storage_path = storage.objects.name
        and (storage.foldername(storage.objects.name))[1] = pm.profile_id::text
    )
  );

drop policy if exists "voice_intros_select_approved" on storage.objects;
create policy "voice_intros_select_approved" on storage.objects
  for select to authenticated using (
    bucket_id = 'voice-intros'
    and exists (
      select 1 from public.public_profile_voice_intro pvi
      where pvi.storage_path = storage.objects.name
        and (storage.foldername(storage.objects.name))[1] = pvi.profile_id::text
    )
  );
