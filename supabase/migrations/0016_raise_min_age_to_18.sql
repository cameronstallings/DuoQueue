-- Raise the minimum age back to 18 (previously lowered to 15 with age-banding in
-- 0007_age_banding.sql). The age-banding infrastructure — is_minor(), same_age_band(),
-- the cross-band guard in perform_swipe, and the minor-specific age range in get_deck —
-- is left in place rather than removed: with no one under 18 able to sign up, is_minor()
-- can never return true, so those checks simply become permanently dormant rather than
-- needing to be rebuilt if a lower age band is revisited later once real photo
-- moderation and a legal review are in place.

alter table public.profiles drop constraint profile_must_be_15;
alter table public.profiles add constraint profile_must_be_18
  check (dob is null or dob <= (current_date - interval '18 years')::date);

alter table public.preferences drop constraint age_range_valid;
alter table public.preferences add constraint age_range_valid
  check (min_age >= 18 and max_age >= min_age);
