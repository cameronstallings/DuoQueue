-- Require a verified email before a profile can become visible to anyone else.
--
-- Rather than adding an email check to all six discovery surfaces (get_deck,
-- get_online_now, get_party_deck, get_standouts, get_admirers, public_profiles) —
-- which would mean re-pasting several hundred lines of function body and leaving six
-- places for a future surface to forget the check — this enforces the invariant at the
-- single gate every one of those surfaces already depends on: onboarding_completed.
--
-- Every discovery query filters `onboarding_completed = true`. So making it impossible
-- to *set* that flag without a confirmed email means an unverified account is
-- automatically invisible everywhere, including in any surface added later.
--
-- Note: this is the in-database backstop. The primary control is Supabase Auth's
-- "Confirm email" setting (Dashboard -> Authentication -> Providers -> Email), which
-- withholds a session entirely until the address is confirmed. Turn that on too — this
-- migration is what makes the guarantee hold even if that setting is ever flipped off.

create or replace function public.is_email_verified(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_profile_id and u.email_confirmed_at is not null
  );
$$;

grant execute on function public.is_email_verified(uuid) to authenticated;

create or replace function public.enforce_verified_email_before_visible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only guards the false -> true transition. Already-completed profiles are left
  -- alone so this can't retroactively lock out existing users mid-session.
  if new.onboarding_completed = true
     and coalesce(old.onboarding_completed, false) = false
     and not public.is_email_verified(new.id) then
    raise exception 'email_not_verified'
      using hint = 'Confirm your email address before finishing your profile.';
  end if;
  return new;
end;
$$;

create trigger enforce_verified_email_before_visible_trigger
  before update on public.profiles
  for each row execute function public.enforce_verified_email_before_visible();
