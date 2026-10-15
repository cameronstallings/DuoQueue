-- 0082: invite links go straight to the App Store, credited to invites.
--
-- WHY. The invite function (supabase/functions/invite/index.ts) redirects to
-- app_config.app_store_url, and falls back to https://duoqueue.io while that is empty. It was
-- never set: 0065 section 7 documents "launch day is one UPDATE" and the UPDATE never ran.
-- Checked live on 2026-10-14: app_store_url = '', and GET .../functions/v1/invite/<code>
-- answers with Location: https://duoqueue.io. So everyone who taps an invite lands on the
-- website first, has to tap again to reach the store, and the install is credited to the
-- site's campaign rather than to invites.
--
-- THE VALUE: the App Store Connect campaign link for this app with campaign token "invite":
--   https://apps.apple.com/app/apple-store/id6798837181?pt=129274943&ct=invite&mt=8
-- id6798837181 and pt=129274943 are the app id and provider token the site already uses
-- (scripts/build-site.mjs, APP_STORE_URL and APP_STORE_PT). App Analytics shows a campaign
-- once it has 5 or more first-time downloads.
--
-- THE CONTRACT WITH THE INVITE FUNCTION (whoever edits supabase/functions/invite owns that code):
--   * app_config.app_store_url holds the COMPLETE destination, campaign parameters included.
--     The function reads it per request (no caching), so this UPDATE takes effect on the next
--     tap with no redeploy.
--   * The function redirects to it unchanged when it is an https URL
--     (_shared/invite-link.ts inviteRedirectTarget; URL.toString() leaves this string as is),
--     ALWAYS with a 302, live code or not, and reports whether the code resolved in an
--     X-Invite-Code header: "live" or "unknown" (inviteResponse). The function deployed on
--     2026-10-14 predates that change and still answers a dead code with a 404 carrying the
--     same Location, which a browser does not follow; the redeploy of invite fixes it. Anything
--     else falls back to the waitlist site, which stays the safe default if this row is ever
--     emptied.
--   * If the function ever needs a per-code or per-inviter campaign token, it should build it
--     from this value (replace the ct parameter), not hard-code a second store URL: this row
--     stays the one place the destination is decided.
--
-- Verify after applying (no app change needed; the Location is right on the old function too):
--   curl -sI https://oflexcazqfuvcikrewnb.supabase.co/functions/v1/invite/ABCDE12345
--   -> Location: https://apps.apple.com/app/apple-store/id6798837181?pt=129274943&ct=invite&mt=8
-- ABCDE12345 is not a live code. Before the invite redeploy that answer is a 404; after it, a
-- 302 with X-Invite-Code: unknown (a live code's link shows X-Invite-Code: live).
--
-- Revert: update public.app_config set value = '' where key = 'app_store_url';
--
-- Checks: supabase/checks/0082_invite_links_to_app_store.sql.

insert into public.app_config (key, value)
values ('app_store_url', 'https://apps.apple.com/app/apple-store/id6798837181?pt=129274943&ct=invite&mt=8')
on conflict (key) do update
  set value = excluded.value
  where public.app_config.value is distinct from excluded.value;
