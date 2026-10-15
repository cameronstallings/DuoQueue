-- 0087: Steam linking never started. start_steam_link() called gen_random_bytes() unqualified
-- with `search_path = public`, but on the hosted project pgcrypto lives in the `extensions`
-- schema, so every call raised 42883 "function gen_random_bytes(integer) does not exist".
--
-- Found 15 Oct 2026 when Cameron reported that tapping Connect next to Steam (Settings >
-- Connections) did nothing. The client did catch the error, but showed the raw Postgres text
-- in a small caption, and Steam's login sheet never opened. steam_link_state held 0 rows and
-- linked_accounts had no Steam row, i.e. nobody has ever linked Steam on the hosted project.
-- Reproduced by running the function as a real authenticated user inside a rolled-back
-- transaction (the same 42883). The only other public function that uses a pgcrypto function,
-- email_identity_hash, already schema-qualifies it (extensions.digest).
--
-- The fix qualifies the call (extensions.gen_random_bytes), the way email_identity_hash does,
-- rather than widening search_path: a SECURITY DEFINER function keeps the narrowest path.
-- Same signature, return type, body otherwise and ACL (authenticated, service_role; never
-- anon). Safe for the shipped 1.0.1 client, which calls it unchanged; it now simply works.
--
-- Checks: supabase/checks/0087_fix_start_steam_link.sql.

set local lock_timeout = '5s';

create or replace function public.start_steam_link()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_state text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.steam_link_state where profile_id = v_me;

  v_state := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.steam_link_state (state, profile_id) values (v_state, v_me);

  return v_state;
end;
$$;

revoke execute on function public.start_steam_link() from public, anon;
grant execute on function public.start_steam_link() to authenticated, service_role;
