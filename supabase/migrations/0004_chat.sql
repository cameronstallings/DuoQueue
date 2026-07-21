-- Phase 3: real-time chat support. Message INSERT still has no client grant (all sends
-- go through the send-message Edge Function so the profanity filter always runs before
-- delivery); this migration adds read-receipt marking, the free-tier "5 active
-- conversations" gate, the matches list RPC, and enables Realtime on messages.

-- =========================================================================
-- Realtime: broadcast INSERT/UPDATE on messages to subscribed clients. RLS
-- (messages_select_participant) still governs who actually receives which rows.
-- =========================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- =========================================================================
-- Read receipts: recipients may flip read_at on messages they didn't send, in
-- matches they're a participant of. Column-level grant means even a crafted
-- UPDATE can't touch content/sender_id/is_flagged — only read_at.
-- =========================================================================

create policy "messages_mark_read" on public.messages
  for update using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and (auth.uid() = m.user_a_id or auth.uid() = m.user_b_id)
    )
  );

grant update (read_at) on public.messages to authenticated;

-- =========================================================================
-- unmatch: participant-only, idempotent (no-op if already unmatched). Reuses
-- the on_match_unmatched trigger from 0001_init.sql to revoke Discord shares.
-- =========================================================================

create or replace function public.unmatch(p_match_id uuid)
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

  update public.matches
  set unmatched_at = now(), unmatched_by = v_me
  where id = p_match_id
    and (user_a_id = v_me or user_b_id = v_me)
    and unmatched_at is null;

  if not found then
    raise exception 'match_not_found_or_already_unmatched';
  end if;
end;
$$;

grant execute on function public.unmatch(uuid) to authenticated;

-- =========================================================================
-- is_conversation_unlocked: free tier gets 5 concurrent "active" conversation
-- slots, ranked by most recent activity (last message, or match time if no
-- messages yet). Premium is always unlocked. Called both by send-message (as
-- the send-time gate) and get_matches_summary (to flag locked rows in the UI).
-- =========================================================================

create or replace function public.is_conversation_unlocked(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_premium(v_me) then
    return true;
  end if;

  return exists (
    select 1
    from (
      select
        m.id,
        greatest(m.matched_at, coalesce(lm.last_message_at, m.matched_at)) as activity
      from public.matches m
      left join (
        select match_id, max(created_at) as last_message_at
        from public.messages
        group by match_id
      ) lm on lm.match_id = m.id
      where (m.user_a_id = v_me or m.user_b_id = v_me)
        and m.unmatched_at is null
      order by activity desc
      limit 5
    ) top5
    where top5.id = p_match_id
  );
end;
$$;

grant execute on function public.is_conversation_unlocked(uuid) to authenticated;

-- =========================================================================
-- get_matches_summary: everything the matches list screen needs in one call.
-- =========================================================================

create or replace function public.get_matches_summary()
returns table (
  match_id uuid,
  other_profile_id uuid,
  other_display_name text,
  other_photo_path text,
  last_message text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count int,
  is_locked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_is_premium boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  v_is_premium := public.is_premium(v_me);

  return query
  with my_matches as (
    select
      m.id,
      case when m.user_a_id = v_me then m.user_b_id else m.user_a_id end as other_id,
      m.matched_at
    from public.matches m
    where (m.user_a_id = v_me or m.user_b_id = v_me) and m.unmatched_at is null
  ),
  last_msgs as (
    select distinct on (msg.match_id) msg.match_id, msg.content, msg.created_at, msg.sender_id
    from public.messages msg
    where msg.match_id in (select id from my_matches)
    order by msg.match_id, msg.created_at desc
  ),
  unread as (
    select msg.match_id, count(*) as cnt
    from public.messages msg
    where msg.match_id in (select id from my_matches)
      and msg.sender_id <> v_me
      and msg.read_at is null
    group by msg.match_id
  ),
  ranked as (
    select
      mm.id,
      greatest(mm.matched_at, coalesce(lm.created_at, mm.matched_at)) as activity
    from my_matches mm
    left join last_msgs lm on lm.match_id = mm.id
  ),
  unlocked_ids as (
    select id from ranked order by activity desc limit 5
  )
  select
    mm.id,
    mm.other_id,
    p.display_name,
    (
      select pmedia.storage_path from public.profile_media pmedia
      where pmedia.profile_id = mm.other_id and pmedia.moderation_status = 'approved'
      order by pmedia.position
      limit 1
    ),
    lm.content,
    lm.created_at,
    lm.sender_id,
    coalesce(u.cnt, 0)::int,
    not (v_is_premium or mm.id in (select id from unlocked_ids))
  from my_matches mm
  join public.profiles p on p.id = mm.other_id
  left join last_msgs lm on lm.match_id = mm.id
  left join unread u on u.match_id = mm.id
  order by greatest(mm.matched_at, coalesce(lm.created_at, mm.matched_at)) desc;
end;
$$;

grant execute on function public.get_matches_summary() to authenticated;

-- =========================================================================
-- get_shared_discord_username: the only way to read someone else's
-- discord_username. profiles.discord_username has no exposure anywhere else
-- (not in public_profiles, not in any grant) — this function is the sole,
-- consent-gated read path, and it re-checks the share exists and isn't
-- revoked on every call rather than trusting the client's cached state.
-- =========================================================================

create or replace function public.get_shared_discord_username(p_match_id uuid, p_shared_by uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_username text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id and (m.user_a_id = v_me or m.user_b_id = v_me)
  ) then
    raise exception 'Not a participant of this match';
  end if;

  if not exists (
    select 1 from public.discord_shares ds
    where ds.match_id = p_match_id and ds.shared_by = p_shared_by and ds.revoked = false
  ) then
    return null;
  end if;

  select p.discord_username into v_username from public.profiles p where p.id = p_shared_by;
  return v_username;
end;
$$;

grant execute on function public.get_shared_discord_username(uuid, uuid) to authenticated;
