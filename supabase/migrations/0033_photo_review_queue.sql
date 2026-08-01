-- Give photos the same manual-review backstop voice intros already have.
--
-- The README describes the admin moderation queue as the manual-review backstop behind
-- the automated photo check, but that backstop did not exist for photos: admin/index.html
-- only ever queried profile_voice_intro and reports. Worse, it could not have worked if
-- someone had written the UI — profile_media has no admin SELECT policy (only
-- profile_media_select_own), and profile-photos storage only grants an admin access to
-- their own folder or to already-approved objects. A pending photo, which is exactly what
-- needs reviewing, was unreadable by anyone but its owner.
--
-- This matters more now that the automated check fails closed: a provider outage parks
-- photos in `pending`, and without a queue there is no way to get them out.
--
-- Mirrors 0024's voice-intro treatment exactly, so the two review paths behave the same.

-- Admins can read every media row (the queue lists pending ones).
create policy "profile_media_select_admin" on public.profile_media
  for select to authenticated using (public.is_admin_user());

-- ...and read the underlying object, whatever its moderation status, so the queue can
-- sign a URL and actually display the photo being judged.
drop policy if exists "profile_photos_select_admin" on storage.objects;
create policy "profile_photos_select_admin" on storage.objects
  for select to authenticated using (
    bucket_id = 'profile-photos' and public.is_admin_user()
  );

-- The only way an admin can change a photo's moderation status. Clients still have no
-- write path to moderation_status at all (0006 + 0031), so approval remains reachable
-- only through this function or the moderate-photo Edge Function's service role.
create or replace function public.review_photo(p_media_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  update public.profile_media
  set moderation_status = case
        when p_approve then 'approved'::moderation_status_enum
        else 'rejected'::moderation_status_enum
      end
  where id = p_media_id;
end;
$$;

revoke execute on function public.review_photo(uuid, boolean) from public, anon;
grant execute on function public.review_photo(uuid, boolean) to authenticated;
