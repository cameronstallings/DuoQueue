-- Squad/group swiping MVP: an existing matched pair can spin up a "party" and swipe
-- together on a shared candidate stream to find a third. Scoped deliberately smaller
-- than full 5-person group formation (which would need N-way invites, roles, etc.) —
-- a party starts as a duo (from a real 1:1 match) and grows by one person at a time:
-- swipe together -> everyone currently in the party likes the same candidate -> that
-- candidate gets a party invite -> accepting adds them as a member and unlocks party
-- chat. Known gap versus 1:1 messages: party_messages has no profanity/hidden-word
-- filter yet (that lives in the send-message Edge Function, not reused here) — flagged
-- rather than silently shipped.

create type party_invite_status_enum as enum ('pending', 'accepted', 'declined');

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.party_members (
  party_id uuid not null references public.parties (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, profile_id)
);

create table public.party_swipes (
  party_id uuid not null references public.parties (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  action swipe_action_enum not null,
  created_at timestamptz not null default now(),
  primary key (party_id, member_id, target_id)
);

create table public.party_invites (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  status party_invite_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  constraint unique_party_invite unique (party_id, target_id)
);

create table public.party_messages (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index party_members_profile_id_idx on public.party_members (profile_id);
create index party_swipes_target_id_idx on public.party_swipes (party_id, target_id);
create index party_invites_target_id_idx on public.party_invites (target_id);
create index party_messages_party_id_created_at_idx on public.party_messages (party_id, created_at);

create or replace function public.is_party_member(p_party_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.party_members
    where party_id = p_party_id and profile_id = p_profile_id
  );
$$;

grant execute on function public.is_party_member(uuid, uuid) to authenticated;

alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_swipes enable row level security;
alter table public.party_invites enable row level security;
alter table public.party_messages enable row level security;

create policy "parties_select_member" on public.parties
  for select using (public.is_party_member(id, auth.uid()));

create policy "party_members_select_member" on public.party_members
  for select using (public.is_party_member(party_id, auth.uid()));

-- Lets an invitee preview who's in the party before deciding whether to accept.
create policy "party_members_select_invited" on public.party_members
  for select using (
    exists (
      select 1 from public.party_invites pi
      where pi.party_id = party_members.party_id and pi.target_id = auth.uid() and pi.status = 'pending'
    )
  );

create policy "party_swipes_select_own" on public.party_swipes
  for select using (auth.uid() = member_id);

create policy "party_invites_select_member_or_target" on public.party_invites
  for select using (public.is_party_member(party_id, auth.uid()) or target_id = auth.uid());

create policy "party_messages_select_member" on public.party_messages
  for select using (public.is_party_member(party_id, auth.uid()));

-- No insert/update grants anywhere in this feature: every write (creating a party,
-- swiping, inviting, accepting/declining, messaging) goes through a RPC below that
-- checks real membership/participancy first, same pattern as swipes/matches/messages.
grant select on public.parties to authenticated;
grant select on public.party_members to authenticated;
grant select on public.party_swipes to authenticated;
grant select on public.party_invites to authenticated;
grant select on public.party_messages to authenticated;

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

  insert into public.parties (created_by) values (v_me) returning id into v_party_id;
  insert into public.party_members (party_id, profile_id) values (v_party_id, v_me), (v_party_id, v_other);

  return v_party_id;
end;
$$;

grant execute on function public.create_party(uuid) to authenticated;

create or replace function public.get_my_parties()
returns table (party_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.created_at
  from public.parties p
  where public.is_party_member(p.id, auth.uid())
  order by p.created_at desc;
$$;

grant execute on function public.get_my_parties() to authenticated;

create or replace function public.get_party_deck(p_party_id uuid, p_limit int default 20)
returns table (
  profile_id uuid,
  display_name text,
  age int,
  gender gender_enum,
  region region_enum,
  bio text,
  shared_games_count int,
  shared_shows_count int,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;

  return query
  with party_member_ids as (
    select pm.profile_id as member_profile_id from public.party_members pm where pm.party_id = p_party_id
  ),
  candidates as (
    select p.id, p.display_name, extract(year from age(current_date, p.dob))::int as c_age, p.gender, p.region, p.bio
    from public.profiles p
    where p.is_active = true
      and p.onboarding_completed = true
      and p.id not in (select member_profile_id from party_member_ids)
      and not exists (
        select 1 from public.party_swipes ps
        where ps.party_id = p_party_id and ps.member_id = v_me and ps.target_id = p.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = p.id and b.blocked_id in (select member_profile_id from party_member_ids))
           or (b.blocked_id = p.id and b.blocker_id in (select member_profile_id from party_member_ids))
      )
      and extract(year from age(current_date, p.dob))::int between 18 and 99
  ),
  shared_games as (
    select c.id as candidate_id, count(*)::int as shared_count
    from candidates c
    join public.profile_games theirs on theirs.profile_id = c.id
    join public.profile_games mine on mine.game_id = theirs.game_id
      and mine.profile_id in (select member_profile_id from party_member_ids)
    group by c.id
  ),
  shared_shows as (
    select c.id as candidate_id, count(*)::int as shared_count
    from candidates c
    join public.profile_shows theirs on theirs.profile_id = c.id
    join public.profile_shows mine on mine.show_id = theirs.show_id
      and mine.profile_id in (select member_profile_id from party_member_ids)
    group by c.id
  )
  select
    c.id, c.display_name, c.c_age, c.gender, c.region, c.bio,
    coalesce(sg.shared_count, 0), coalesce(ss.shared_count, 0),
    coalesce(sg.shared_count, 0)::numeric * 5 + coalesce(ss.shared_count, 0)::numeric
  from candidates c
  left join shared_games sg on sg.candidate_id = c.id
  left join shared_shows ss on ss.candidate_id = c.id
  order by coalesce(sg.shared_count, 0) desc
  limit p_limit;
end;
$$;

grant execute on function public.get_party_deck(uuid, int) to authenticated;

create or replace function public.perform_party_swipe(p_party_id uuid, p_target_id uuid, p_action swipe_action_enum)
returns table (invited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_member_count int;
  v_like_count int;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;
  if v_me = p_target_id then
    raise exception 'Cannot swipe on yourself';
  end if;

  insert into public.party_swipes (party_id, member_id, target_id, action)
  values (p_party_id, v_me, p_target_id, p_action)
  on conflict (party_id, member_id, target_id) do update set action = excluded.action, created_at = now();

  invited := false;

  if p_action = 'like' then
    select count(*) into v_member_count from public.party_members where party_id = p_party_id;
    select count(*) into v_like_count
    from public.party_swipes ps
    where ps.party_id = p_party_id and ps.target_id = p_target_id and ps.action = 'like'
      and ps.member_id in (select profile_id from public.party_members where party_id = p_party_id);

    if v_member_count > 0 and v_like_count >= v_member_count then
      insert into public.party_invites (party_id, target_id) values (p_party_id, p_target_id)
      on conflict (party_id, target_id) do nothing;
      invited := true;
    end if;
  end if;

  return next;
end;
$$;

grant execute on function public.perform_party_swipe(uuid, uuid, swipe_action_enum) to authenticated;

create or replace function public.get_my_party_invites()
returns table (invite_id uuid, party_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select id, party_id, created_at
  from public.party_invites
  where target_id = auth.uid() and status = 'pending';
$$;

grant execute on function public.get_my_party_invites() to authenticated;

create or replace function public.respond_party_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_party_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select party_id into v_party_id
  from public.party_invites
  where id = p_invite_id and target_id = v_me and status = 'pending';

  if v_party_id is null then
    raise exception 'No pending invite';
  end if;

  if p_accept then
    insert into public.party_members (party_id, profile_id) values (v_party_id, v_me)
    on conflict do nothing;
    update public.party_invites set status = 'accepted' where id = p_invite_id;
  else
    update public.party_invites set status = 'declined' where id = p_invite_id;
  end if;
end;
$$;

grant execute on function public.respond_party_invite(uuid, boolean) to authenticated;

create or replace function public.send_party_message(p_party_id uuid, p_content text)
returns public.party_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.party_messages;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;
  if char_length(trim(p_content)) = 0 then
    raise exception 'Message cannot be empty';
  end if;

  insert into public.party_messages (party_id, sender_id, content)
  values (p_party_id, v_me, p_content)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.send_party_message(uuid, text) to authenticated;

alter publication supabase_realtime add table public.party_messages;
