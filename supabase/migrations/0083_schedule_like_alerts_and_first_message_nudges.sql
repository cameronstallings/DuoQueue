-- 0083: switch on the like alert and the first-message nudge.
--
-- ITS OWN MIGRATION, ON PURPOSE, AND APPLIED LAST. Everything here produces pushes through
-- send-push-notification events that the deployed function does not know until it is
-- redeployed:
--
--   new_like             (0072)  from the swipes trigger below and the hourly like sweep
--   first_message_nudge  (0075)  from the hourly first-message sweep
--
-- Both write their ledger in the same transaction as the push request, so if this were applied
-- before the deploy, every alert it decided to send would be marked sent and then refused by
-- the old function with a 400: lost, not retried. Same reason 0064 waited for its function.
--
-- ORDER OF OPERATIONS:
--   1. Apply 0071 to 0082 (any time; each is safe against the shipped client and the deployed
--      functions, see their headers).
--   2. Deploy send-push-notification with the new events (new_like, session_proposed,
--      discord_shared, first_message_nudge; looking_now's category change), and hand-fire one
--      of each against a review account.
--   3. Apply this file.
--
-- WHAT IT CREATES
--
--   on_swipe_like_alert   a CONSTRAINT trigger, AFTER INSERT ON swipes, action = 'like' only,
--                         DEFERRABLE INITIALLY DEFERRED: it runs at COMMIT, calling
--                         enqueue_like_alert() (0072). That function never raises: any error
--                         becomes a WARNING and the swipe goes through.
--
--                         Deferred because accept_invite writes the invitee's like, then the
--                         inviter's like, then the match, and send_super_ping writes the like,
--                         then the super_pings row. A plain row trigger decided at the first
--                         like, before the rest existed: a rolled-back probe of accept_invite
--                         (15 Oct 2026) queued "Someone wants to duo with you" to the inviter
--                         right next to "New match!", and one of send_super_ping queued it next
--                         to the named Super Ping push, each spending the recipient's one
--                         person-push of the day. At commit, 0072's swiped-back, no-match and
--                         no-Super-Ping checks see the whole act and skip both.
--
--                         Nothing in the app can change when it fires: SET CONSTRAINTS is not
--                         something PostgREST lets a client run. The check scripts fire it early
--                         with SET CONSTRAINTS ... IMMEDIATE, because a rolled-back transaction
--                         never reaches a commit.
--   like-alerts-hourly           '10 * * * *'  select public.send_pending_like_alerts()
--   first-message-nudges-hourly  '50 * * * *'  select public.send_first_message_nudges()
--
-- :10 and :50 are unused on cron.job (2026-10-14: :00 daily-swipes-refreshed and
-- reengagement-nudges, :15 rate limit cleanup, :20 new-player alerts, :25 party invites
-- (09:25 daily), :30 reengagement-nudges, :35 push log cleanup (09:35 daily, 0080), :40 */6
-- verified stats, :45 waitlist cleanup, every 5 minutes looking-now expiry (0074), 7/22/37/52
-- session expiry (0077)). Both sweeps are pure SQL: no Edge Function of their own, the pushes
-- go out through notify_via_edge_function like every trigger's.
--
-- Scheduling is idempotent (unschedule if present, then schedule) and the trigger is dropped
-- if present first, so re-running this file cannot double anything.
--
-- KILL SWITCHES, for the 2am version of this problem:
--   drop trigger if exists on_swipe_like_alert on public.swipes;
--   select cron.unschedule('like-alerts-hourly');
--   select cron.unschedule('first-message-nudges-hourly');
-- Everything these can send is bounded in SQL anyway: one person-push a day per recipient,
-- one alert per liker and recipient ever, one nudge per match side ever and one a day per
-- recipient, quiet hours, 200 recipients a run.
--
-- Checks: supabase/checks/0083_schedule_like_alerts_and_first_message_nudges.sql.

set local lock_timeout = '5s';

drop trigger if exists on_swipe_like_alert on public.swipes;
create constraint trigger on_swipe_like_alert
  after insert on public.swipes
  deferrable initially deferred
  for each row
  when (new.action = 'like')
  execute function public.enqueue_like_alert();

do $$
begin
  if exists (select 1 from cron.job where jobname = 'like-alerts-hourly') then
    perform cron.unschedule('like-alerts-hourly');
  end if;
  if exists (select 1 from cron.job where jobname = 'first-message-nudges-hourly') then
    perform cron.unschedule('first-message-nudges-hourly');
  end if;
end;
$$;

select cron.schedule(
  'like-alerts-hourly',
  '10 * * * *',
  $$select public.send_pending_like_alerts()$$
);

select cron.schedule(
  'first-message-nudges-hourly',
  '50 * * * *',
  $$select public.send_first_message_nudges()$$
);
