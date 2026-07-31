-- Persist dob/timezone at user-creation time instead of via a follow-up UPDATE.
--
-- Why this is needed now: with email confirmation required (0028 + the Supabase Auth
-- setting), signUp() no longer returns a session — the user has to confirm first. The
-- old sign-up flow wrote dob/timezone with a separate authenticated UPDATE, which
-- can't run without a session, so those fields would silently never be set.
--
-- Passing them through signUp's options.data lands them in raw_user_meta_data, which
-- this trigger reads while creating the profile row. No session required, and it stays
-- correct whether or not email confirmation is enabled.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob text := new.raw_user_meta_data ->> 'dob';
  v_timezone text := new.raw_user_meta_data ->> 'timezone';
begin
  insert into public.profiles (id, display_name, dob, timezone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    -- Metadata is user-supplied, so a malformed date must not abort user creation.
    -- The 18+ CHECK constraint on profiles still applies to whatever lands here.
    case when v_dob ~ '^\d{4}-\d{2}-\d{2}$' then v_dob::date else null end,
    v_timezone
  );

  insert into public.preferences (profile_id) values (new.id);
  insert into public.notification_settings (profile_id) values (new.id);
  insert into public.profile_vibe (profile_id) values (new.id);

  return new;
end;
$$;
