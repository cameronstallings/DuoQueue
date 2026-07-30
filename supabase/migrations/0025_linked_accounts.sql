-- Verified game accounts: pull in rank/username automatically instead of trusting a
-- self-reported text field, per the brief ("if ranks are self-reported, half the
-- profiles are lying"). Steam is wired up for real (OpenID + Web API, both free and
-- instantly self-serve — see supabase/functions/link-steam-callback). Riot and Xbox
-- share the same `linked_accounts` shape but their Edge Functions are scaffolds: Riot
-- requires a production API key from the Riot Developer Portal (manual approval) and
-- Xbox requires an Azure AD app + Xbox Live API access, both of which only the
-- project owner can register — this migration doesn't (and can't) fake that
-- verification, since a fake "verified" badge would be worse than none.

create type linked_account_provider_enum as enum ('steam', 'riot', 'xbox');

create table public.linked_accounts (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider linked_account_provider_enum not null,
  external_id text not null,
  display_name text not null,
  rank_tier text,
  avatar_url text,
  raw_data jsonb,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, provider)
);

create trigger set_linked_accounts_updated_at
  before update on public.linked_accounts
  for each row execute function public.set_updated_at();

alter table public.linked_accounts enable row level security;

create policy "linked_accounts_select_own" on public.linked_accounts
  for select using (auth.uid() = profile_id);

create policy "linked_accounts_delete_own" on public.linked_accounts
  for delete using (auth.uid() = profile_id);

-- No insert/update grant: only the linking Edge Functions (service role, after
-- verifying the external account for real) ever write a row here.
grant select, delete on public.linked_accounts to authenticated;

create view public.public_linked_accounts as
select la.profile_id, la.provider, la.display_name, la.rank_tier
from public.linked_accounts la
join public.profiles p on p.id = la.profile_id
where p.is_active = true and p.onboarding_completed = true;

grant select on public.public_linked_accounts to authenticated;

-- Short-lived, single-use state tokens tying a Steam OpenID redirect back to the
-- profile that started it — the callback can't trust a client-supplied profile_id
-- (that would let anyone attach a Steam account to someone else's profile), so it
-- looks the caller up server-side by this token instead. Internal only: no RLS
-- policies/grants for authenticated at all, only the SECURITY DEFINER RPC below and
-- the callback Edge Function's service-role client can touch it.
create table public.steam_link_state (
  state text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.steam_link_state enable row level security;

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

  v_state := encode(gen_random_bytes(24), 'hex');
  insert into public.steam_link_state (state, profile_id) values (v_state, v_me);

  return v_state;
end;
$$;

grant execute on function public.start_steam_link() to authenticated;
