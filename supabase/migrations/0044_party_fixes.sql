-- Fixes for two confirmed party defects, both surfaced by reading live production data
-- (see t-party-verify.md): duplicate parties from the same creator, and creator-account
-- deletion nuking the whole party for everyone else.

-- 1. Dedup guard in create_party. Proven in production: 3 identical, empty 2-person
-- parties from the same creator, 8-10 minutes apart, 0 invites/0 messages on any of
-- them. The client had no `disabled` guard on the "Invite a third" button (fixed
-- separately, app-side) and the RPC itself had no server-side check at all, so a
-- double-tap (or reopening the menu and tapping again) minted a fresh duplicate every
-- time. This adds the missing check: if the caller already created a party whose
-- *current* membership is exactly {caller, other-match-participant} -- the same duo
-- this call would otherwise produce -- hand back that existing party id instead of
-- inserting a new row. Scoped to exact 2-person membership (not "any party this pair
-- both belong to") so a party that already grew past the original duo (a third already
-- accepted) is left alone rather than silently redirecting into a bigger group; there's
-- no party status or match_id column on `parties` to key off instead. Return shape
-- (bare uuid) is unchanged so the client needs no changes.
create or replace function public.create_party(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_party_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select case when user_a_id = v_me then user_b_id when user_b_id = v_me then user_a_id end
  into v_other
  from public.matches
  where id = p_match_id and unmatched_at is null;

  if v_other is null then
    raise exception 'Not a participant in an active match';
  end if;

  select pa.id into v_party_id
  from public.parties pa
  where pa.created_by = v_me
    and (select count(*) from public.party_members pm where pm.party_id = pa.id) = 2
    and exists (
      select 1 from public.party_members pm
      where pm.party_id = pa.id and pm.profile_id = v_other
    )
  order by pa.created_at desc
  limit 1;

  if v_party_id is not null then
    return v_party_id;
  end if;

  insert into public.parties (created_by) values (v_me) returning id into v_party_id;
  insert into public.party_members (party_id, profile_id) values (v_party_id, v_me), (v_party_id, v_other);

  return v_party_id;
end;
$$;

-- 2. created_by ON DELETE CASCADE was asymmetric with every other member-departure
-- path: a non-creator deleting their account only removes their own party_members row
-- (via party_members.profile_id's own cascade) and the party survives for everyone
-- else, but the creator deleting their account cascaded the `parties` row itself away,
-- which in turn cascaded every party_members/party_swipes/party_invites/party_messages
-- row -- destroying the party, its full chat history, and every other member's
-- membership with zero notice, purely because they happened to be the one who tapped
-- "Invite a third" originally. Switch to ON DELETE SET NULL: the party and everything
-- in it survives a creator's account deletion, `created_by` just goes blank (nothing in
-- the app reads `created_by` today -- grepped -- so there's no UI to update). No RLS
-- policy on any party table keys off `created_by` (they all use is_party_member(), which
-- reads party_members), so remaining members keep read/write access exactly as before;
-- verified with a rolled-back test alongside this migration.
alter table public.parties alter column created_by drop not null;
alter table public.parties drop constraint parties_created_by_fkey;
alter table public.parties
  add constraint parties_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
