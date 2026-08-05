-- Track A follow-up. 0053 fixed handle_new_user()'s NULL-dob bypass (item 3 of this
-- track's brief: `v_dob !~ pattern` is SQL NULL, not TRUE, when v_dob is NULL, so the
-- guard silently no-op'd for an omitted/null dob). 0054_preservation_completeness.sql
-- (a different track, applied after 0053) redefined handle_new_user() again to add the
-- banned_identities re-signup check, but built its new body from the pre-0053 baseline
-- ("only the body changes" — true relative to 0031, not relative to 0053), so it
-- silently reverted the NULL-dob fix: live pg_proc.prosrc after 0054 showed
-- `if v_dob !~ '^\d{4}-\d{2}-\d{2}$' then` again, no `v_dob is null or`. Confirmed live
-- in a rolled-back transaction: an auth.users insert with no `dob` key in
-- raw_user_meta_data succeeded and produced a profiles row instead of raising — the
-- exact regression 0053 closed, reopened by an unrelated migration.
--
-- This re-applies just that one condition on top of 0054's current body (banned-
-- identity check kept verbatim, in the same position) rather than reverting anything
-- 0054 added. Also drops-and-recreates a NOT NULL/CHECK pair 0053 already added to
-- profiles.dob, which 0054 did not touch — restated here as `if not exists` guards so
-- this migration is safe to run whether or not that part of 0053 is still standing.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob text := new.raw_user_meta_data ->> 'dob';
  v_timezone text := new.raw_user_meta_data ->> 'timezone';
  v_parsed_dob date;
begin
  if new.email is not null and exists (
    select 1 from public.banned_identities
    where email_hash = public.email_identity_hash(new.email)
      and unbanned_at is null
  ) then
    raise exception 'This account has been banned and cannot be re-created.';
  end if;

  if v_dob is null or v_dob !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'A valid date of birth is required to create an account';
  end if;

  v_parsed_dob := v_dob::date;

  if v_parsed_dob > (current_date - interval '18 years')::date then
    raise exception 'You must be at least 18 to create an account';
  end if;

  insert into public.profiles (id, display_name, dob, timezone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    v_parsed_dob,
    case when public.is_valid_timezone(v_timezone) then v_timezone else null end
  );

  insert into public.preferences (profile_id) values (new.id);
  insert into public.notification_settings (profile_id) values (new.id);
  insert into public.profile_vibe (profile_id) values (new.id);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Belt and suspenders, idempotent: 0053 already did this, but restate defensively in
-- case any later migration touches profiles.dob without knowing about it.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'dob' and is_nullable = 'NO'
  ) then
    alter table public.profiles alter column dob set not null;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profile_must_be_18'
      and pg_get_constraintdef(oid) not ilike '%dob is not null%'
  ) then
    alter table public.profiles drop constraint profile_must_be_18;
    alter table public.profiles add constraint profile_must_be_18
      check (dob is not null and dob <= (current_date - interval '18 years')::date);
  end if;
end;
$$;
