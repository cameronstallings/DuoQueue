-- Reputation tags: "did they actually show up" instead of a gameable star rating.
-- Tags can only be submitted for a real match the rater participated in (enforced in
-- the RPC, not left to the client), preventing fabricated feedback about someone you
-- were never actually paired with.

create type match_feedback_tag_enum as enum (
  'good_comms', 'chill_after_losses', 'showed_up_on_time', 'flaked'
);

create table public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  ratee_id uuid not null references public.profiles (id) on delete cascade,
  tag match_feedback_tag_enum not null,
  created_at timestamptz not null default now(),
  constraint match_feedback_not_self check (rater_id <> ratee_id),
  constraint unique_feedback_tag unique (match_id, rater_id, ratee_id, tag)
);

create index match_feedback_ratee_id_idx on public.match_feedback (ratee_id);

alter table public.match_feedback enable row level security;

create policy "match_feedback_select_own" on public.match_feedback
  for select using (auth.uid() = rater_id);

-- No insert grant for `authenticated`: writes only via submit_match_feedback(), which
-- verifies match participancy before inserting (SECURITY DEFINER bypasses this).
grant select on public.match_feedback to authenticated;

create or replace function public.submit_match_feedback(p_match_id uuid, p_tags match_feedback_tag_enum[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_other_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select case when user_a_id = v_me then user_b_id when user_b_id = v_me then user_a_id end
  into v_other_id
  from public.matches
  where id = p_match_id;

  if v_other_id is null then
    raise exception 'Not a participant in this match';
  end if;

  delete from public.match_feedback where match_id = p_match_id and rater_id = v_me and ratee_id = v_other_id;

  insert into public.match_feedback (match_id, rater_id, ratee_id, tag)
  select p_match_id, v_me, v_other_id, tag
  from unnest(p_tags) as tag;
end;
$$;

grant execute on function public.submit_match_feedback(uuid, match_feedback_tag_enum[]) to authenticated;

-- Aggregate counts per tag for a profile — the client decides how to render them
-- (e.g. only showing positive tags above a threshold on someone else's card, while a
-- user can see their own full breakdown including "flaked" as private feedback).
create or replace function public.get_reputation(p_profile_id uuid)
returns table (tag match_feedback_tag_enum, tag_count int)
language sql
stable
security definer
set search_path = public
as $$
  select mf.tag, count(*)::int
  from public.match_feedback mf
  where mf.ratee_id = p_profile_id
  group by mf.tag;
$$;

grant execute on function public.get_reputation(uuid) to authenticated;
