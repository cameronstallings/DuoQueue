-- Voice intro clips: a short (client-enforced ≤10s) recording on a profile, since
-- gaming is a voice activity and a bio doesn't convey that. There's no automated audio
-- moderation available (unlike moderate-photo's image check), so clips go through
-- manual admin review via the admin web page instead — same "pending until reviewed,
-- invisible to other users until then" shape as photo moderation, just a human in the
-- loop rather than a model.

create table public.profile_voice_intro (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  storage_path text not null,
  duration_seconds smallint not null,
  moderation_status moderation_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  constraint voice_intro_duration_range check (duration_seconds between 1 and 10)
);

alter table public.profile_voice_intro enable row level security;

create policy "profile_voice_intro_select_own" on public.profile_voice_intro
  for select using (auth.uid() = profile_id);

create policy "profile_voice_intro_select_admin" on public.profile_voice_intro
  for select using (public.is_admin_user());

create policy "profile_voice_intro_insert_own" on public.profile_voice_intro
  for insert with check (auth.uid() = profile_id);

create policy "profile_voice_intro_delete_own" on public.profile_voice_intro
  for delete using (auth.uid() = profile_id);

-- Owners can replace their clip (goes back to pending) but can't self-approve;
-- moderation_status is only ever written by an admin, same guard as profile_media.
create policy "profile_voice_intro_update_own" on public.profile_voice_intro
  for update using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Column-restricted grants, both for insert and update: moderation_status is never
-- client-writable via a plain grant (RLS controls which *rows* a policy allows, not
-- which *columns* — a broader column grant would let an owner "update their own row"
-- straight to 'approved' through profile_voice_intro_update_own, RLS or no RLS). Admin
-- review therefore goes through review_voice_intro() below instead of a direct column
-- grant, the same SECURITY DEFINER pattern used for every other privileged write in
-- this schema.
grant select, delete on public.profile_voice_intro to authenticated;
grant insert (profile_id, storage_path, duration_seconds) on public.profile_voice_intro to authenticated;
grant update (storage_path, duration_seconds) on public.profile_voice_intro to authenticated;

create or replace function public.review_voice_intro(p_profile_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  update public.profile_voice_intro
  set moderation_status = case when p_approve then 'approved'::moderation_status_enum else 'rejected'::moderation_status_enum end
  where profile_id = p_profile_id;
end;
$$;

grant execute on function public.review_voice_intro(uuid, boolean) to authenticated;

create or replace function public.reset_voice_intro_moderation()
returns trigger
language plpgsql
as $$
begin
  if new.storage_path is distinct from old.storage_path then
    new.moderation_status := 'pending';
  end if;
  return new;
end;
$$;

create trigger reset_voice_intro_moderation_trigger
  before update on public.profile_voice_intro
  for each row execute function public.reset_voice_intro_moderation();

create view public.public_profile_voice_intro as
select pvi.profile_id, pvi.storage_path, pvi.duration_seconds
from public.profile_voice_intro pvi
join public.profiles p on p.id = pvi.profile_id
where pvi.moderation_status = 'approved' and p.is_active = true;

grant select on public.public_profile_voice_intro to authenticated;

-- Storage bucket + object policies. Expected object path convention:
-- `${profile_id}/${filename}`, same as profile-photos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-intros', 'voice-intros', false, 3145728, array['audio/m4a', 'audio/mp4', 'audio/aac', 'audio/x-m4a'])
on conflict (id) do nothing;

create policy "voice_intros_select_own_folder" on storage.objects
  for select using (
    bucket_id = 'voice-intros' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "voice_intros_select_approved" on storage.objects
  for select using (
    bucket_id = 'voice-intros'
    and exists (
      select 1
      from public.profile_voice_intro pvi
      join public.profiles p on p.id = pvi.profile_id
      where pvi.storage_path = storage.objects.name
        and pvi.moderation_status = 'approved'
        and p.is_active = true
    )
  );

create policy "voice_intros_select_admin" on storage.objects
  for select using (bucket_id = 'voice-intros' and public.is_admin_user());

create policy "voice_intros_insert_own_folder" on storage.objects
  for insert with check (
    bucket_id = 'voice-intros' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "voice_intros_delete_own_folder" on storage.objects
  for delete using (
    bucket_id = 'voice-intros' and (storage.foldername(name))[1] = auth.uid()::text
  );
