-- Scheduled sessions ("play Thursday at 8pm?") — the "play now" ping itself needs no
-- new schema: it's just a canned chat message sent through the existing send-message
-- flow, which already triggers a push notification via notify_new_message() from
-- 0006_moderation_and_notifications.sql. This migration only covers scheduling, which
-- needs actual state (pending/confirmed/declined) that a plain message can't carry.

create type match_session_status_enum as enum ('pending', 'confirmed', 'declined', 'cancelled');

create table public.match_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  scheduled_at timestamptz not null,
  status match_session_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index match_sessions_match_id_idx on public.match_sessions (match_id, created_at desc);

create trigger set_match_sessions_updated_at
  before update on public.match_sessions
  for each row execute function public.set_updated_at();

alter table public.match_sessions enable row level security;

create policy "match_sessions_select_participant" on public.match_sessions
  for select using (
    exists (
      select 1 from public.matches m
      where m.id = match_sessions.match_id
        and (auth.uid() = m.user_a_id or auth.uid() = m.user_b_id)
    )
  );

-- No insert/update grant: all writes go through the RPCs below, which verify match
-- participancy (and, for respond_session, that the caller isn't the proposer).
grant select on public.match_sessions to authenticated;

create or replace function public.propose_session(p_match_id uuid, p_scheduled_at timestamptz)
returns public.match_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.match_sessions;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id and m.unmatched_at is null
      and (m.user_a_id = v_me or m.user_b_id = v_me)
  ) then
    raise exception 'Not a participant in this match';
  end if;

  -- Only one live proposal per match at a time.
  update public.match_sessions
  set status = 'cancelled'
  where match_id = p_match_id and status = 'pending';

  insert into public.match_sessions (match_id, proposed_by, scheduled_at)
  values (p_match_id, v_me, p_scheduled_at)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.propose_session(uuid, timestamptz) to authenticated;

create or replace function public.respond_session(p_session_id uuid, p_accept boolean)
returns public.match_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.match_sessions;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select ms.* into v_row
  from public.match_sessions ms
  join public.matches m on m.id = ms.match_id
  where ms.id = p_session_id
    and ms.status = 'pending'
    and ms.proposed_by <> v_me
    and (m.user_a_id = v_me or m.user_b_id = v_me);

  if v_row.id is null then
    raise exception 'No pending proposal to respond to';
  end if;

  update public.match_sessions
  set status = case when p_accept then 'confirmed'::match_session_status_enum else 'declined'::match_session_status_enum end
  where id = p_session_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.respond_session(uuid, boolean) to authenticated;

create or replace function public.cancel_session(p_session_id uuid)
returns void
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

  update public.match_sessions ms
  set status = 'cancelled'
  from public.matches m
  where ms.id = p_session_id
    and ms.match_id = m.id
    and ms.status in ('pending', 'confirmed')
    and (m.user_a_id = v_me or m.user_b_id = v_me);
end;
$$;

grant execute on function public.cancel_session(uuid) to authenticated;
