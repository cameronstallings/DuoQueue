-- Pause profile reuses the existing `is_active` flag (already the exclusion check in
-- every deck/candidate query and public view) — no new column needed, just a client
-- toggle. Hide-last-active is new: a private flag plus a public view that only ever
-- exposes a boolean ("recently active or not"), never the raw timestamp, to anyone
-- other than the profile's own owner.

alter table public.profiles add column hide_last_active boolean not null default false;

create view public.public_profile_activity as
select
  p.id as profile_id,
  case
    when p.hide_last_active then false
    else p.last_active_at is not null and p.last_active_at > now() - interval '24 hours'
  end as is_recently_active
from public.profiles p
where p.is_active = true and p.onboarding_completed = true;

grant select on public.public_profile_activity to authenticated;
