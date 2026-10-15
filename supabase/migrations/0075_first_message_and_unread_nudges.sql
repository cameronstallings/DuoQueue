-- 0075: a nudge for a NEW match nobody has written in yet, and daytime-only unread nudges.
--
-- WHY. Read live on 2026-10-14: 12 of 28 real matches have never had a message, and once an
-- hour passes a match rarely starts talking (13 of 16 conversations started within the first
-- hour). get_stale_unread_conversations (0038) joins the latest message, so a match with zero
-- messages is never nudged. Separately, 2 of the 16 unread nudges sent so far went out between
-- 01:00 and 03:00 the recipient's local time.
--
-- Cameron's decisions (15 Oct 2026):
--   * First-message nudge for NEW matches only, from the moment this file is applied. The
--     12 old silent matches are not nudged. Recorded as app_config 'first_message_nudge_since'
--     = now() at apply time, and the sweep ignores any match made before it.
--   * Skip blocked, unmatched and LOCKED-chat pairs. 4 of the 12 silent matches are locked for
--     one side by the free 5-chat cap; nudging that side lands them on send-message's
--     conversation_locked 403.
--   * Scheduled nudges keep the 10:00-21:00 local window (local_hour_within(tz, 10, 20), 0072).
--
-- Expect a small effect: the unread nudge, the closest existing push, got 0 replies within
-- 24 hours from 16 sends. It is cheap, bounded, and it counts in push_log (0080).
--
-- ============================================================================
-- 1. get_stale_unread_conversations (the existing unread nudge)
-- ============================================================================
--
-- Rebuilt from its live definition (0038). Signature and RETURNS columns are unchanged
-- (match_id, recipient_id, sender_id, message_id), so the deployed send-reengagement-nudges
-- keeps working with no change. New predicates, all about the RECIPIENT:
--   * local time 10:00-20:59;
--   * not blocked either way (a block also sets unmatched_at; this does not rely on it);
--   * the chat is unlocked for them (0073's is_conversation_unlocked_for);
--   * not banned, not suspended, active, and not demo.
-- A message that waits through the night is nudged at the first half-hourly run after 10:00,
-- because its match_nudges row is only written when a nudge goes out.
--
-- ============================================================================
-- 2. The first-message nudge
-- ============================================================================
--
-- send_first_message_nudges(max) is a pure-SQL sweep, scheduled hourly by 0083 after the edge
-- function knows the event. For each live match made after 'first_message_nudge_since', at
-- least 3 hours ago and less than 7 days ago, with ZERO messages in it, each side ("the
-- recipient") qualifies when:
--   * recipient: onboarded, active, not banned or suspended, not demo, has a push token,
--     nudge_unread not switched off (the "Your duo is waiting" switch; same family of push),
--     local time 10:00-20:59, chat unlocked for them;
--   * the other player: onboarded, active, not banned or suspended;
--   * the pair is not blocked either way;
--   * never nudged for this match (first_message_nudges' primary key), and no first-message
--     nudge to this recipient in the last 24 hours.
-- At most one match per recipient per run (their newest), at most p_max recipients per run
-- (clamped 1..1000). The ledger row and the push request are written in one transaction.
-- A transaction-scoped advisory lock means two overlapping runs cannot both send.
--
-- THE EDGE FUNCTION CONTRACT (send-push-notification learns this event):
--   { "type": "first_message_nudge", "matchId": <uuid>, "recipientId": <uuid>, "otherId": <uuid> }
--   setting column  nudge_unread
--   data.category   "new_match" with data.matchId: 1.0.1 routes it to that chat.
--   sound           NO. It is a scheduled nudge; a sound is kept for a person reaching you.
--   copy            "Say hi to {otherName}" / "You matched. Send the first message and pick a time to play."
--   re-check        before sending: the match is still live and still has no message. Drop if not.
--
-- Kill switch (after 0083): select cron.unschedule('first-message-nudges-hourly');
--
-- Checks: supabase/checks/0075_first_message_and_unread_nudges.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. The unread nudge: daytime, unblocked, unlocked.
-- ---------------------------------------------------------------------------
create or replace function public.get_stale_unread_conversations()
returns table (match_id uuid, recipient_id uuid, sender_id uuid, message_id uuid)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    m.id as match_id,
    r.id as recipient_id,
    latest.sender_id,
    latest.id as message_id
  from public.matches m
  join lateral (
    select msg.id, msg.sender_id, msg.created_at, msg.read_at
    from public.messages msg
    where msg.match_id = m.id
    order by msg.created_at desc
    limit 1
  ) latest on true
  join public.profiles r
    on r.id = (case when latest.sender_id = m.user_a_id then m.user_b_id else m.user_a_id end)
  left join public.match_nudges mn on mn.match_id = m.id
  left join public.notification_settings ns on ns.profile_id = r.id
  where m.unmatched_at is null
    and latest.read_at is null
    and latest.created_at <= now() - interval '1 hour'
    and (mn.unread_nudge_message_id is null or mn.unread_nudge_message_id <> latest.id)
    and coalesce(ns.nudge_unread, true) = true
    -- 0075
    and not public.is_blocked_pair(m.user_a_id, m.user_b_id)
    and r.is_active = true
    and r.is_banned = false
    and r.is_admin_suspended = false
    and r.is_demo = false
    and public.local_hour_within(r.timezone, 10, 20)
    and public.is_conversation_unlocked_for(r.id, m.id);
$fn$;

revoke execute on function public.get_stale_unread_conversations() from public, anon, authenticated;
grant execute on function public.get_stale_unread_conversations() to service_role;

-- ---------------------------------------------------------------------------
-- 2. The cutoff: only matches made from now on.
-- ---------------------------------------------------------------------------
--
-- app_config is RLS-enabled with no client policy, so this is server-only like the rest of
-- that table. `do nothing` on conflict: re-running this file must not move the cutoff.
insert into public.app_config (key, value)
values ('first_message_nudge_since', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 3. The ledger: one nudge per match and side, ever. Both ids cascade (5.1.1(v)).
-- ---------------------------------------------------------------------------
create table if not exists public.first_message_nudges (
  match_id     uuid not null references public.matches (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sent_at      timestamptz not null default now(),
  primary key (match_id, recipient_id)
);

create index if not exists first_message_nudges_recipient_sent_at_idx
  on public.first_message_nudges (recipient_id, sent_at desc);

alter table public.first_message_nudges enable row level security;
revoke all on public.first_message_nudges from public, anon, authenticated;
grant select, insert, update, delete on public.first_message_nudges to service_role;

-- ---------------------------------------------------------------------------
-- 4. The sweep.
-- ---------------------------------------------------------------------------
create or replace function public.send_first_message_nudges(p_max_recipients integer default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_since timestamptz;
  v_row record;
  v_sent integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('send_first_message_nudges', 0)) then
    return 0;
  end if;

  -- Missing or unreadable cutoff = send nothing (the safe direction).
  begin
    select value::timestamptz into v_since from public.app_config where key = 'first_message_nudge_since';
  exception
    when others then
      v_since := null;
  end;
  if v_since is null then
    return 0;
  end if;

  for v_row in
    with sides as (
      select m.id as match_id, m.matched_at, s.recipient_id, s.other_id
      from public.matches m
      cross join lateral (
        values (m.user_a_id, m.user_b_id), (m.user_b_id, m.user_a_id)
      ) as s(recipient_id, other_id)
      where m.unmatched_at is null
        and m.matched_at >= v_since
        and m.matched_at <= now() - interval '3 hours'
        and m.matched_at > now() - interval '7 days'
        and not exists (select 1 from public.messages msg where msg.match_id = m.id)
        and not public.is_blocked_pair(m.user_a_id, m.user_b_id)
    ),
    eligible as (
      select sd.match_id, sd.matched_at, sd.recipient_id, sd.other_id
      from sides sd
      join public.profiles r on r.id = sd.recipient_id
      join public.profiles o on o.id = sd.other_id
      where r.onboarding_completed = true
        and r.is_active = true
        and r.is_banned = false
        and r.is_admin_suspended = false
        and r.is_demo = false
        and o.onboarding_completed = true
        and o.is_active = true
        and o.is_banned = false
        and o.is_admin_suspended = false
        and not exists (
          select 1 from public.notification_settings ns
          where ns.profile_id = r.id and ns.nudge_unread = false
        )
        and exists (select 1 from public.push_tokens t where t.profile_id = r.id)
        and public.local_hour_within(r.timezone, 10, 20)
        and not exists (
          select 1 from public.first_message_nudges f
          where f.match_id = sd.match_id and f.recipient_id = sd.recipient_id
        )
        and not exists (
          select 1 from public.first_message_nudges f
          where f.recipient_id = sd.recipient_id and f.sent_at > now() - interval '24 hours'
        )
        and public.is_conversation_unlocked_for(sd.recipient_id, sd.match_id)
    )
    select distinct on (e.recipient_id) e.match_id, e.recipient_id, e.other_id
    from eligible e
    order by e.recipient_id, e.matched_at desc
    limit greatest(least(coalesce(p_max_recipients, 200), 1000), 1)
  loop
    insert into public.first_message_nudges (match_id, recipient_id)
    values (v_row.match_id, v_row.recipient_id)
    on conflict (match_id, recipient_id) do nothing;
    if found then
      perform public.notify_via_edge_function(
        jsonb_build_object(
          'type', 'first_message_nudge',
          'matchId', v_row.match_id,
          'recipientId', v_row.recipient_id,
          'otherId', v_row.other_id
        )
      );
      v_sent := v_sent + 1;
    end if;
  end loop;

  return v_sent;
end;
$fn$;

revoke execute on function public.send_first_message_nudges(integer) from public, anon, authenticated;
grant execute on function public.send_first_message_nudges(integer) to service_role;
