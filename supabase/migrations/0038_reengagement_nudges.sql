-- Re-engagement nudges: two new push categories layered on the existing
-- notify_via_edge_function/send-push-notification machinery (0006/0031).
--
-- 1. "Your duo is waiting" — a scheduled sweep (send-reengagement-nudges, invoked
--    every 30 minutes the same way daily-swipes-refreshed is: a Supabase Cron Trigger
--    or external scheduler hitting the function URL with the internal bearer token) for
--    matches sitting on an unread message that's gone stale for an hour. This needs no
--    trigger because nothing "happens" to notify on — it's the absence of a read, only
--    visible by polling.
-- 2. "X is free to duo right now" — trigger-based, firing the moment a profile flips
--    is_looking_now false -> true, notifying every active match partner. Unlike the
--    unread nudge this *is* an event, so it reuses the same pg_net -> edge-function path
--    as new_match/new_message/super_ping instead of waiting on the next sweep.
--
-- State for both lives in one new table, match_nudges, rather than two near-identical
-- ones: both nudges are naturally scoped to a single match (a pair of profiles), so one
-- row per match holds "what did we last nudge this pair about, and when" for either
-- category. This mirrors swipe_refresh_notifications (0031) — dedupe state that exists
-- solely so a re-run or a skipped scheduler beat can't double-send — except keyed by
-- match instead of profile, and covering two independent nudge kinds instead of one.
--
-- Both categories are opt-outable via notification_settings, following the boolean-
-- per-category convention new_match/new_message/super_ping/daily_swipes_refreshed
-- already use (no enum involved, so nothing needs its own migration file here).

-- =========================================================================
-- Preferences: two new opt-outable categories, default on like every existing one.
-- Table-level grants from 0001 already cover authenticated read/write of these columns
-- (notification_settings_all_own scopes rows to auth.uid() = profile_id) — no new
-- grants needed.
-- =========================================================================

alter table public.notification_settings add column nudge_unread boolean not null default true;
alter table public.notification_settings add column nudge_online boolean not null default true;

-- =========================================================================
-- match_nudges: per-match dedupe/rate-limit state, service-role only (no grants, no
-- policies beyond RLS-enabled-with-nothing-granted — same posture as
-- swipe_refresh_notifications). unread_nudge_message_id anchors "one nudge per stale
-- conversation": a nudge already sent for a given message id blocks re-sending until a
-- *newer* message arrives and goes stale in turn, but never blocks the next distinct
-- conversation from nudging.
-- =========================================================================

create table public.match_nudges (
  match_id uuid primary key references public.matches (id) on delete cascade,
  unread_nudge_sent_at timestamptz,
  unread_nudge_message_id uuid references public.messages (id) on delete set null,
  looking_now_notified_at timestamptz
);

alter table public.match_nudges enable row level security;

-- =========================================================================
-- "Your duo is waiting": candidate query for the scheduled sweep.
--
-- For each active match, look at only the newest message (a stale *older* message
-- whose thread has since moved on isn't what "waiting" means). It's a nudge candidate
-- when that message is still unread, is at least an hour old, and either no nudge has
-- gone out for this match yet or the last one was for a different (older) message.
-- notification_settings is joined here (not left to the edge function alone, unlike
-- the existing notify_via_edge_function categories) so an opted-out recipient's row
-- never becomes an edge-function call in the first place — the sweep can run at a
-- 30-minute cadence and there's no reason to pay the RPC/round-trip for someone who
-- will always be filtered out.
-- =========================================================================

create or replace function public.get_stale_unread_conversations()
returns table (match_id uuid, recipient_id uuid, sender_id uuid, message_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id as match_id,
    case when latest.sender_id = m.user_a_id then m.user_b_id else m.user_a_id end as recipient_id,
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
  left join public.match_nudges mn on mn.match_id = m.id
  left join public.notification_settings ns
    on ns.profile_id = (case when latest.sender_id = m.user_a_id then m.user_b_id else m.user_a_id end)
  where m.unmatched_at is null
    and latest.read_at is null
    and latest.created_at <= now() - interval '1 hour'
    and (mn.unread_nudge_message_id is null or mn.unread_nudge_message_id <> latest.id)
    and coalesce(ns.nudge_unread, true) = true;
$$;

-- Same posture as get_profiles_needing_swipe_refresh_notification (0006/0031): a
-- SECURITY DEFINER read helper only the scheduled Edge Function's service-role client
-- ever calls.
revoke execute on function public.get_stale_unread_conversations() from public, anon, authenticated;

-- =========================================================================
-- "X is free to duo right now": fires on the false -> true transition of
-- is_looking_now (set_looking_now(), 0021). Renewals (already-on, calling it again
-- before the 60-minute window lapses) and turning off must not notify — both read as
-- old.is_looking_now already true, so the early return covers them without a WHEN
-- clause, matching this file's other conditional-trigger (reset_media_moderation, 0031)
-- rather than 0006/0021's unconditional ones.
--
-- Rate limit (max once per match pair per 6h) and the nudge_online opt-out are both
-- applied in the candidate query, same reasoning as get_stale_unread_conversations
-- above: an opted-out or recently-notified partner should never reach
-- notify_via_edge_function at all, not be filtered after the fact.
-- =========================================================================

create or replace function public.notify_looking_now()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
begin
  if new.is_looking_now is not true or coalesce(old.is_looking_now, false) = true then
    return new;
  end if;

  for v_match in
    select
      m.id as match_id,
      case when m.user_a_id = new.id then m.user_b_id else m.user_a_id end as partner_id
    from public.matches m
    left join public.match_nudges mn on mn.match_id = m.id
    left join public.notification_settings ns
      on ns.profile_id = (case when m.user_a_id = new.id then m.user_b_id else m.user_a_id end)
    where (m.user_a_id = new.id or m.user_b_id = new.id)
      and m.unmatched_at is null
      and coalesce(ns.nudge_online, true) = true
      and (mn.looking_now_notified_at is null or mn.looking_now_notified_at < now() - interval '6 hours')
  loop
    perform public.notify_via_edge_function(
      jsonb_build_object(
        'type', 'looking_now',
        'matchId', v_match.match_id,
        'togglerId', new.id,
        'recipientId', v_match.partner_id
      )
    );

    insert into public.match_nudges (match_id, looking_now_notified_at)
    values (v_match.match_id, now())
    on conflict (match_id) do update set looking_now_notified_at = excluded.looking_now_notified_at;
  end loop;

  return new;
end;
$$;

revoke execute on function public.notify_looking_now() from public, anon, authenticated;

-- `of is_looking_now` restricts firing to statements that actually assign that column
-- (i.e. set_looking_now()'s UPDATE) rather than every profile write — heartbeat() only
-- touches last_active_at, and the settings-screen PATCH grant (0031) doesn't include
-- this column at all, so neither would fire this even without the guard above.
create trigger on_profile_looking_now_toggled
  after update of is_looking_now on public.profiles
  for each row execute function public.notify_looking_now();
