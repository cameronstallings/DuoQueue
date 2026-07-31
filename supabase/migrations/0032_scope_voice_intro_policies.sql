-- Follow-up to 0031: scope the remaining voice-intro storage policies to
-- `authenticated`.
--
-- 0031 fixed voice_intros_select_approved (the one that actually exposed data) but
-- left these four applying to PUBLIC, which includes anon. They aren't exploitable —
-- each predicate compares the object's folder to auth.uid(), which is null for anon,
-- so nothing matches. Two reasons to fix them anyway:
--
--   * voice_intros_select_admin calls is_admin_user(), and 0031 revoked EXECUTE on it
--     from anon. Evaluating that policy as anon now raises "permission denied" instead
--     of simply not matching — an error where a clean denial belongs.
--   * Leaving policies at PUBLIC means the next person reading this file has to re-derive
--     "is this safe?" from the predicate rather than seeing the intended audience.

drop policy if exists "voice_intros_select_own_folder" on storage.objects;
create policy "voice_intros_select_own_folder" on storage.objects
  for select to authenticated using (
    bucket_id = 'voice-intros' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "voice_intros_insert_own_folder" on storage.objects;
create policy "voice_intros_insert_own_folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'voice-intros' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "voice_intros_delete_own_folder" on storage.objects;
create policy "voice_intros_delete_own_folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'voice-intros' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "voice_intros_select_admin" on storage.objects;
create policy "voice_intros_select_admin" on storage.objects
  for select to authenticated using (
    bucket_id = 'voice-intros' and public.is_admin_user()
  );
