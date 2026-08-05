-- Data minimization follow-up to the link-steam-callback Edge Function fix: that
-- function used to store the ENTIRE Steam GetPlayerSummaries response in
-- linked_accounts.raw_data (0025_linked_accounts.sql), which — depending on the
-- Steam user's privacy settings — can include realname, loccountrycode/locstatecode,
-- timecreated, profileurl, personastate, and more. None of that is read or disclosed
-- anywhere in the app; the function now persists only {steamid, personaname,
-- avatarfull}. This backfills already-stored rows to match, so we don't keep holding
-- the wider payload for accounts linked before the fix shipped.
--
-- NOT APPLIED as part of this change — flagged for the migration owner to route
-- alongside 0044+.

update public.linked_accounts
set raw_data = jsonb_build_object(
  'steamid', external_id,
  'personaname', raw_data ->> 'personaname',
  'avatarfull', raw_data ->> 'avatarfull'
)
where provider = 'steam'
  and raw_data is not null
  and (
    raw_data - 'steamid' - 'personaname' - 'avatarfull' <> '{}'::jsonb
  );
