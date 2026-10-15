-- 0074: "Free to duo right now" turns itself off when the hour ends, pings your matches again
-- the next time, and its push can open the chat.
--
-- WHY. set_looking_now(true) sets is_looking_now = true and an expiry an hour out (0021), and
-- nothing ever set the flag back when that hour ended. Three things followed, all read live on
-- 2026-10-14:
--
--   * The switch kept reading ON. The app shows profile.is_looking_now with no expiry check,
--     while get_online_now had already dropped the player (it requires expires_at > now()).
--     4 real profiles have been stuck ON since 2 Oct.
--   * The push never fired twice. notify_looking_now returned early whenever the OLD row was
--     already true, so every later toggle-on counted as a "renewal" and pinged nobody. All 5
--     looking-now pushes ever sent went out on 2 Oct.
--   * And a stuck-ON player's next tap sends p_looking = false (the switch reads ON), so even
--     a server-side "treat expired as off" in the trigger alone would not have re-armed it.
--
-- WHAT CHANGES
--
--   1. expire_looking_now() sets is_looking_now = false (and the expiry NULL, exactly what
--      set_looking_now(false) writes) for every flag whose window has ended. pg_cron runs it
--      every 5 minutes, and this file runs it once, now, which clears the 5 stuck flags (4 real
--      and 1 demo). After a profile refresh the 1.0.1 switch then reads OFF, and the next tap
--      sends true. Writing is_looking_now fires notify_looking_now, which returns at once for
--      false, and set_profiles_updated_at, which moves updated_at (nothing reads it as
--      "the player did something"; last_active_at is not touched).
--
--   2. notify_looking_now treats an expired window as off: only a renewal INSIDE a live window
--      is silent. The 6-hour per-match cap (match_nudges.looking_now_notified_at) stays.
--
--   3. notify_looking_now skips a partner who:
--        * is blocked either way, or banned (a block also sets unmatched_at, which was already
--          checked; this does not depend on that);
--        * has the chat LOCKED (free 5-chat cap): the push would open a chat they cannot use;
--        * is in local quiet hours, 01:00-09:59. Cameron's rule for event-driven pushes about
--          a real person (0072). Unlike the like alert this one is not deferred: the window it
--          announces lasts 60 minutes, so a ping at 10:00 for a window that closed at 04:00
--          would be false. NEW BEHAVIOUR, flagged for Cameron; delete the one line marked
--          QUIET HOURS to undo it.
--      The partner loop is wrapped in its own exception block, so nothing in it can fail the
--      player's own set_looking_now.
--
--   The payload is unchanged: { "type": "looking_now", "matchId", "togglerId", "recipientId" }.
--
-- THE EDGE FUNCTION CHANGE THIS NEEDS (send-push-notification, case "looking_now"): send with
-- data.category "new_message" and data.matchId = event.matchId (setting column stays
-- nudge_online; sound stays on). 1.0.1 routes new_message + matchId to that chat; "nudge_online"
-- is not a routed category in 1.0.1, which is why a tap on this push opened nothing. The
-- planning critique dropped the OTA routing for nudge_online in favour of exactly this.
--
-- Kill switch for the sweep:  select cron.unschedule('looking-now-expire-5min');
--
-- Cron minutes in use (read off cron.job 2026-10-14): :00 daily-swipes-refreshed-hourly,
-- :00/:30 reengagement-nudges-half-hourly, :15 rate_limit_hits_cleanup_hourly, :20
-- new-player-alerts-hourly, 09:25 party-invites-expire-daily, :40 */6 verified-stats-sync,
-- :45 waitlist_attempts_cleanup_hourly. This job runs every 5 minutes and is one indexed
-- UPDATE (profiles_looking_now_idx is partial on is_looking_now = true), so sharing a minute
-- with the others costs nothing.
--
-- Checks: supabase/checks/0074_free_to_duo_fixes.sql.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Expire
-- ---------------------------------------------------------------------------
create or replace function public.expire_looking_now()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  update public.profiles
     set is_looking_now = false,
         looking_now_expires_at = null
   where is_looking_now = true
     and (looking_now_expires_at is null or looking_now_expires_at <= now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke execute on function public.expire_looking_now() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2 and 3. notify_looking_now
-- ---------------------------------------------------------------------------
create or replace function public.notify_looking_now()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_match record;
begin
  if new.is_looking_now is not true then
    return new;
  end if;
  -- A renewal inside a LIVE window pings nobody. An expired window counts as off (0074).
  if coalesce(old.is_looking_now, false) = true
     and old.looking_now_expires_at is not null
     and old.looking_now_expires_at > now() then
    return new;
  end if;

  begin
    for v_match in
      select
        m.id as match_id,
        partner.id as partner_id
      from public.matches m
      join public.profiles partner
        on partner.id = (case when m.user_a_id = new.id then m.user_b_id else m.user_a_id end)
      left join public.match_nudges mn on mn.match_id = m.id
      left join public.notification_settings ns on ns.profile_id = partner.id
      where (m.user_a_id = new.id or m.user_b_id = new.id)
        and m.unmatched_at is null
        and not public.is_blocked_pair(m.user_a_id, m.user_b_id)
        and partner.is_banned = false
        and coalesce(ns.nudge_online, true) = true
        and (mn.looking_now_notified_at is null or mn.looking_now_notified_at < now() - interval '6 hours')
        and public.local_hour_within(partner.timezone, 10, 0)  -- QUIET HOURS (0074)
        and public.is_conversation_unlocked_for(partner.id, m.id)
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
  exception
    when others then
      raise warning 'notify_looking_now failed: %', sqlerrm;
  end;

  return new;
end;
$fn$;

revoke execute on function public.notify_looking_now() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Schedule (idempotent), then clear what is stuck right now.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'looking-now-expire-5min') then
    perform cron.unschedule('looking-now-expire-5min');
  end if;
end;
$$;

select cron.schedule(
  'looking-now-expire-5min',
  '*/5 * * * *',
  $$select public.expire_looking_now()$$
);

select public.expire_looking_now();
