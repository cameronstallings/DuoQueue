-- 0064: actually run the new-player sweep.
--
-- (The plan calls this file 0063; 0061 was taken by 0061_waitlist.sql and the deck gates
-- landed as 0062, so it and 0063_new_player_alerts.sql each shift up by one.)
--
-- ITS OWN MIGRATION, ON PURPOSE, AND APPLIED SECOND. `send-new-player-alerts` had to be
-- deployed and hand-fired successfully before this file ran. Scheduling a post to a route
-- that does not exist yet buys nothing but an hour of 404s in net._http_response and a
-- confusing first debugging session. 0058 was split out for the same reason.
--
-- WHY :20. Read off cron.job on the live project rather than off the migrations, because the
-- schedule has drifted from what the files imply more than once:
--
--   :00        daily-swipes-refreshed-hourly      (0006)
--   :00, :30   reengagement-nudges-half-hourly    (0038)
--   :15        rate_limit_hits_cleanup_hourly     (0048)
--   :40 */6    verified-stats-sync-six-hourly     (0058)
--   :45        waitlist_attempts_cleanup_hourly   (0061)
--
-- :20 is free, and this job's run overlaps nobody else's.
--
-- WHY HOURLY, not half-hourly like the nudges. The per-recipient cooldown is 24 hours and the
-- announcement window is 48, so finer resolution buys literally nothing: a signup that misses
-- one sweep is picked up by the next one, and the copy ("someone new joined, come back
-- sometime") tolerates an hour of latency in a way "your duo is waiting" does not. Halving
-- the cadence would double the sweep's cost to change nothing a user could perceive.
--
-- The URL and the token come from public.app_config rather than being baked into the job
-- definition, matching 0048 and 0058 — rotating the shared secret is then one UPDATE and not
-- an unschedule/reschedule dance.
--
-- KILL SWITCH, and it belongs somewhere findable at 2am:
--
--   select cron.unschedule('new-player-alerts-hourly');
--
-- Everything this job can do is bounded by SQL in 0063 (four rate limits, quiet hours, the
-- 200-recipient cap), so the realistic reason to reach for that line is not a firehose but
-- wanting the pings to stop while something else is investigated.

select cron.schedule(
  'new-player-alerts-hourly',
  '20 * * * *',
  $$
  select net.http_post(
    url := (select value from public.app_config where key = 'edge_function_base_url')
           || '/send-new-player-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_config where key = 'internal_trigger_token')
    ),
    body := '{}'::jsonb
  );
  $$
);
