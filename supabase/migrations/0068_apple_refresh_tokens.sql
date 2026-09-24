-- 0068: somewhere to keep the one thing that can revoke a Sign in with Apple grant.
--
-- THE SAME CAVEAT 0067 OPENS WITH APPLIES HERE. Nothing below was run against the live
-- cluster: the task that produced this file forbade touching the database. Apply it with
-- scripts/db/apply-migration.ps1 and no -Commit first; the dry-run wraps it in a
-- transaction and rolls it back, and it is the only place the assumptions get checked.
--
-- That dry run has since happened (2026-09-23, after 0067 in the same rolled-back
-- transaction): has_table_privilege says neither anon nor authenticated can SELECT, a select
-- as either role raises "permission denied for table apple_refresh_tokens", RLS is on with no
-- policies, and service_role can still read it.
--
-- ============================================================================
-- D1. WHY A TABLE, AND WHY THIS ONE COLUMN
-- ============================================================================
--
-- Apple requires that an app offering Sign in with Apple call its token revocation
-- endpoint when the user deletes their account. It has been an enforced review item since
-- 30 June 2022, it is checked on the deletion flow reviewers exercise first, and Supabase
-- does none of it: auth.admin.deleteUser removes the auth.users row and stops. Without
-- this, deleting a DuoQueue account leaves the grant live in iOS Settings > Apple ID >
-- Sign in with Apple, pointing at an account that no longer exists, and the app is
-- rejected under Guideline 5.1.1(v). That was a non-issue while Sign in with Apple was
-- disabled; 0067 is what turns it on, so this is 0067's other half.
--
-- Revocation needs a refresh token. A refresh token can only be obtained by exchanging
-- the authorization code Apple hands the app at sign-in, and that code is single use and
-- expires in about five minutes. So the exchange cannot happen at deletion time and the
-- token has to be written down in between. There is nowhere in the existing schema that
-- fits: profiles is client-readable by its owner, and this value is not the owner's to
-- read -- it is a credential that acts on their Apple account.
--
-- Hence a table with nothing in it but the token, keyed on the auth user rather than on
-- the profile. AUTH.USERS AND NOT PROFILES, deliberately, and it is the whole reason this
-- migration follows 0067 rather than predating it: under the new design an Apple account
-- authenticates BEFORE it has a profile row, and the sign-in that produces the
-- authorization code happens in exactly that window. A foreign key to public.profiles
-- would fail with 23503 on every first Apple sign-in, which is the same class of bug 0067
-- section D3 spent its length enumerating. The reference is `on delete cascade` so that
-- the row disappears with the user; delete-account reads it before it deletes anything.
--
-- ============================================================================
-- D2. WHO CAN SEE IT: NOBODY
-- ============================================================================
--
-- RLS on, zero policies, zero grants to anon or authenticated. The only reader is the
-- service role, which bypasses RLS, and the only two things holding that key are the
-- apple-authorization Edge Function (which writes) and delete-account (which reads once
-- and then deletes the user). This is the same posture waitlist_signups has (0061) and
-- for the same reason: enabling RLS without writing a policy is a DENY-ALL, and a table
-- with no grants cannot be reached by PostgREST at all, so the two together mean a
-- compromised anon key cannot even name it.
--
-- The value is a credential for a THIRD PARTY, which is the part that makes it different
-- from everything else in this schema, and it is a SIGN-IN-GRADE credential, not merely a
-- revocation handle. Together with the Sign in with Apple .p8 key (the APPLE_PRIVATE_KEY
-- function secret), a refresh token can be traded at appleid.apple.com/auth/token for a
-- fresh Apple identity token for this app, and signInWithIdToken({provider:'apple'}) would
-- accept that token as a sign-in to the account it belongs to. So a leak of this table is
-- only harmless while the .p8 stays secret, and the .p8 has to be guarded as the thing that
-- turns this table into account access: it lives only in function secrets, never in the
-- client, a CI variable or a file in the repo, and a suspected exposure of either one means
-- rotating the key in the Apple Developer portal. Its own owner has no business reading it
-- either, which is why there is no self-select policy of the kind every other profile-keyed
-- table carries.
--
-- ============================================================================
-- D3. WHAT IS NOT HERE
-- ============================================================================
--
--   * No history, no `revoked_at`, no soft delete. The row's entire purpose is to be
--     spent once at account deletion, after which the user it belongs to does not exist.
--     Keeping a spent credential would be keeping a liability.
--   * No provider column. This is Apple-specific by name and by shape (the exchange, the
--     ES256 client secret, the bundle-id client_id are all Apple's), and a `provider text`
--     column on a table with one provider is an invitation to store a Google refresh token
--     next to an Apple one and revoke the wrong grant. If Google sign-in is ever enabled
--     (0067 and socialSignIn.ts both explain why it is not), it gets its own table or this
--     one grows a check constraint and a compound key, deliberately.
--   * No unique constraint beyond the primary key: one Apple grant per auth user is the
--     definition of the relationship, and re-signing in upserts over the old token rather
--     than accumulating rows. The old token is not revoked on the way out, because it is
--     the same grant -- revoking it would sign the user out of the account they are in the
--     middle of signing in to.

-- ---------------------------------------------------------------------------
-- 1. The table.
-- ---------------------------------------------------------------------------

create table if not exists public.apple_refresh_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Apple's refresh token, verbatim. Opaque, and never sent anywhere but appleid.apple.com.
  refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.apple_refresh_tokens is
  'One Apple refresh token per auth user, written by the apple-authorization Edge Function at sign-in and spent by delete-account to call https://appleid.apple.com/auth/revoke. RLS on with no policies and no grants: service role only. Keyed on auth.users, not profiles, because an Apple account authenticates before it has a profile (0067).';

comment on column public.apple_refresh_tokens.refresh_token is
  'Credential for a THIRD PARTY, and sign-in grade: with the Sign in with Apple .p8 key it can mint a fresh Apple identity token that signInWithIdToken would accept for this account. Kept only so delete-account can revoke the grant. Not readable by its own owner. See 0068 D2.';

-- ---------------------------------------------------------------------------
-- 2. Deny all.
-- ---------------------------------------------------------------------------
--
-- Both halves matter and neither is sufficient alone. RLS with no policies denies every
-- row to every non-bypassing role; revoking the grants means Postgres refuses the
-- relation before RLS is ever consulted, so an anon or authenticated caller gets
-- "permission denied for table apple_refresh_tokens" (what the dry run printed for both)
-- rather than an empty set that invites a second guess.

alter table public.apple_refresh_tokens enable row level security;

revoke all on public.apple_refresh_tokens from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. updated_at, on the house pattern.
-- ---------------------------------------------------------------------------
--
-- set_updated_at() is the trigger function 0001_init.sql installs and every mutable table
-- in this schema uses. Named per the same convention so the trigger list stays readable.

drop trigger if exists apple_refresh_tokens_set_updated_at on public.apple_refresh_tokens;

create trigger apple_refresh_tokens_set_updated_at
  before update on public.apple_refresh_tokens
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Verification.
-- ---------------------------------------------------------------------------
--
-- Fails the migration rather than reporting, because a table that holds a third-party
-- credential and is readable by `authenticated` is worse than no table at all.

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'apple_refresh_tokens' and c.relrowsecurity
  ) then
    raise exception '0068: RLS is not enabled on public.apple_refresh_tokens';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'apple_refresh_tokens'
  ) then
    raise exception '0068: public.apple_refresh_tokens must have no policies (service role only)';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'apple_refresh_tokens'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception '0068: public.apple_refresh_tokens is granted to PUBLIC, anon or authenticated';
  end if;

  raise notice '0068: apple_refresh_tokens created, RLS on, no policies, no client grants.';
end $$;
