-- Profile photo storage: bucket + RLS on storage.objects.
-- Bucket is private; read access is granted either to the owner (any moderation
-- status, so you can see your own pending/rejected uploads) or to anyone when the
-- photo has been through moderation and belongs to an active profile (needed so
-- other users can see approved photos in the deck/matches).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Expected object path convention: `${profile_id}/${filename}`.

create policy "profile_photos_select_own_folder" on storage.objects
  for select using (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile_photos_select_approved" on storage.objects
  for select using (
    bucket_id = 'profile-photos'
    and exists (
      select 1
      from public.profile_media pm
      join public.profiles p on p.id = pm.profile_id
      where pm.storage_path = storage.objects.name
        and pm.moderation_status = 'approved'
        and p.is_active = true
    )
  );

create policy "profile_photos_insert_own_folder" on storage.objects
  for insert with check (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile_photos_update_own_folder" on storage.objects
  for update using (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile_photos_delete_own_folder" on storage.objects
  for delete using (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
