-- 0080: a record of every push that was sent, so a push can be judged by what it did.
--
-- WHY. sendExpoPush (supabase/functions/_shared/expo-push.ts) POSTs to Expo and throws the
-- response away. Nothing records that a push was sent, whether Expo accepted it, or that a
-- token is dead. To measure the 15 Oct audit the swipe-refresh sends had to be ESTIMATED (about
-- 139) from token creation dates and timezones. The like alert (0072), the session and Discord
-- pushes (0073) and the first-message nudge (0075) are new, and without this none of them can
-- be judged, or switched off on evidence when people start turning pushes off.
--
-- WHAT IS STORED: who it went to, its category and event, when, how many tokens were tried,
-- how many Expo accepted, and Expo's error code. NO MESSAGE CONTENT: no title, no body, no
-- name, no data payload. The recipient id cascades from profiles (App Store 5.1.1(v)), so
-- deleting an account deletes its rows.
--
-- WHAT IT IS NOT: a budget. The one-a-day person-push budget and every per-pair dedupe live in
-- the ledgers that are written in SQL in the same transaction that decides to push
-- (new_player_alerts, like_alerts, first_message_nudges, match_event_pushes, match_nudges,
-- swipe_refresh_notifications). This table is written by the Edge Function AFTER the send, so
-- it lags; reading a budget from it would let two sends race through. It is for monitoring.
--
-- THE EDGE FUNCTION CONTRACT (sendExpoPush and its 4 callers):
--   insert one row per recipient per push, with the service-role client:
--     recipient_id   the profile pushed
--     category       data.category exactly as sent ("new_player", "new_message", ...)
--     event          what produced it: the event type for send-push-notification pushes
--                    ("new_like", "session_proposed", "discord_shared", "looking_now",
--                    "first_message_nudge", "new_match", ...), and "new_player_alert",
--                    "daily_swipes_refreshed", "nudge_unread" for the three sweeps
--     tokens         how many tokens were tried (0 is a valid row: "no_token")
--     accepted       how many Expo tickets came back status "ok"
--     ticket_status  'ok' (all accepted) | 'partial' | 'error' (none accepted) |
--                    'no_token' | 'transport_error' (the POST itself failed)
--     error          the first ticket's details.error (e.g. "DeviceNotRegistered") or the
--                    transport error message, truncated to 200 characters
--   and DELETE the push_tokens row for any token whose ticket says DeviceNotRegistered.
--   A failed insert here must never stop a push: log it and carry on.
--
-- Rows older than 90 days are deleted daily (push-log-cleanup-daily, 09:35 UTC; :35 is unused
-- on cron.job as of 2026-10-14). That is long enough to compare a month against the month
-- before it.
--
-- Useful reads (service role / SQL editor):
--   select event, ticket_status, count(*) from push_log where sent_at > now() - interval '7 days' group by 1, 2 order by 1, 2;
--   select date_trunc('day', sent_at) d, count(*) filter (where error = 'DeviceNotRegistered') from push_log group by 1 order by 1;
--
-- Checks: supabase/checks/0080_push_log.sql.

set local lock_timeout = '5s';

create table if not exists public.push_log (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  category      text not null,
  event         text,
  sent_at       timestamptz not null default now(),
  tokens        smallint not null default 0,
  accepted      smallint not null default 0,
  ticket_status text not null,
  error         text,
  constraint push_log_category_length check (char_length(category) between 1 and 40),
  constraint push_log_event_length check (event is null or char_length(event) between 1 and 40),
  constraint push_log_counts check (tokens >= 0 and accepted >= 0 and accepted <= tokens),
  constraint push_log_ticket_status check (
    ticket_status in ('ok', 'partial', 'error', 'no_token', 'transport_error')
  ),
  constraint push_log_error_length check (error is null or char_length(error) <= 200)
);

create index if not exists push_log_recipient_sent_at_idx on public.push_log (recipient_id, sent_at desc);
create index if not exists push_log_event_sent_at_idx on public.push_log (event, sent_at desc);
create index if not exists push_log_sent_at_idx on public.push_log (sent_at);

-- Server-only, and service_role granted explicitly (from 30 Oct 2026 new tables get no
-- automatic grants; service_role bypasses RLS but not a missing grant).
alter table public.push_log enable row level security;
revoke all on public.push_log from public, anon, authenticated;
grant select, insert, update, delete on public.push_log to service_role;

create or replace function public.prune_push_log()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  delete from public.push_log where sent_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke execute on function public.prune_push_log() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'push-log-cleanup-daily') then
    perform cron.unschedule('push-log-cleanup-daily');
  end if;
end;
$$;

select cron.schedule(
  'push-log-cleanup-daily',
  '35 9 * * *',
  $$select public.prune_push_log()$$
);
