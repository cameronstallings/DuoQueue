-- 0058: actually run the verified-stats sync.
--
-- `sync-verified-stats` has been deployed since 0039 and STEAM_WEB_API_KEY has been set
-- on the project since launch prep, but nothing ever called the function — so linking a
-- Steam account produced the badge and the display name (that path runs through
-- link-steam-callback at link time) while the playtime/rank figures it exists to refresh
-- never updated. This schedules it, using the same app_config-driven pattern as the
-- other two jobs so the URL and token are not baked into the job definition.
--
-- Every six hours, not hourly: Steam's per-key rate limit is generous but finite, the
-- data barely moves, and the function walks every linked account on each run. Offset to
-- :40 so it never lands on the same minute as the hourly swipe refresh (:00), the
-- half-hourly nudges (:00/:30), or the rate-limit prune (:15).
--
-- Riot is deliberately not part of this: RIOT_API_KEY is unset, development keys expire
-- every 24 hours, and a production key needs an approved application. The function
-- already treats each provider as independently optional and skips a provider whose key
-- is missing, so scheduling it now is safe and picks Riot up automatically if that key
-- ever appears.

select cron.schedule(
  'verified-stats-sync-six-hourly',
  '40 */6 * * *',
  $$
  select net.http_post(
    url := (select value from public.app_config where key = 'edge_function_base_url') || '/sync-verified-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_config where key = 'internal_trigger_token')
    ),
    body := '{}'::jsonb
  );
  $$
);
