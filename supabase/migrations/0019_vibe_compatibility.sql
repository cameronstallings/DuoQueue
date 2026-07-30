-- Vibe compatibility: self-reported sliders + a tilt-handling tag, surfaced on
-- profiles so people can screen for playstyle fit beyond "we both play the same
-- game" (two ranked mid laners can still be a terrible pair). Same ownership +
-- public-view pattern as preferences/profile_playstyles.

create type tilt_handling_enum as enum (
  'stays_calm', 'gets_frustrated_sometimes', 'tilts_but_recovers_fast', 'needs_space_after_losses'
);

create table public.profile_vibe (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  -- 0 = chill / norms & ARAM, 100 = sweaty ranked grind
  intensity smallint not null default 50,
  -- 0 = mostly quiet, 100 = mic on constantly
  comms_style smallint not null default 50,
  -- 0 = please don't review my deaths, 100 = coach me, I want to improve
  coaching_pref smallint not null default 50,
  tilt_handling tilt_handling_enum not null default 'stays_calm',
  updated_at timestamptz not null default now(),
  constraint intensity_range check (intensity between 0 and 100),
  constraint comms_style_range check (comms_style between 0 and 100),
  constraint coaching_pref_range check (coaching_pref between 0 and 100)
);

create trigger set_profile_vibe_updated_at
  before update on public.profile_vibe
  for each row execute function public.set_updated_at();

alter table public.profile_vibe enable row level security;

create policy "profile_vibe_all_own" on public.profile_vibe
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

grant select, insert, update, delete on public.profile_vibe to authenticated;

create view public.public_profile_vibe as
select pv.profile_id, pv.intensity, pv.comms_style, pv.coaching_pref, pv.tilt_handling
from public.profile_vibe pv
join public.profiles p on p.id = pv.profile_id
where p.is_active = true and p.onboarding_completed = true;

grant select on public.public_profile_vibe to authenticated;

-- Auto-create a default row alongside preferences/notification_settings so every
-- profile has one to update from the onboarding/edit-details UI.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');

  insert into public.preferences (profile_id) values (new.id);
  insert into public.notification_settings (profile_id) values (new.id);
  insert into public.profile_vibe (profile_id) values (new.id);

  return new;
end;
$$;
