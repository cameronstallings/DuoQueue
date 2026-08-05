-- Small follow-up to 0049_input_constraints.sql, covering three more directly
-- client-writable text columns found on a second pass over every RLS-granted
-- own-row INSERT/UPDATE policy (not just the columns named in the original brief):
--
--   * profile_languages.language_code / preferences.required_language — the app only
--     ever sends one of packages/shared-types/src/enums.ts's fixed LANGUAGE_CODES list
--     (a closed TS union, driven entirely by a picker — apps/mobile/app/filters.tsx,
--     apps/mobile/src/store/onboarding-store.ts), but that's a compile-time guarantee
--     for the shipped app only. Neither column had a matching CHECK, so a direct
--     PostgREST call (own row, RLS already allows it) could write any string into a
--     field several matching/filter queries compare by equality. Pinned to the exact
--     same list as the allow-list this always was in the client.
--   * push_tokens.expo_push_token — no length bound at all. The app only ever writes
--     what Notifications.getExpoPushTokenAsync() (Expo's own SDK) returns
--     (apps/mobile/src/lib/notifications.ts), but again that's client-side only; RLS
--     lets a caller write any string to their own row. sendExpoPush() (_shared/expo-
--     push.ts) already filters at send time to a "starts with Expo(nent)PushToken"
--     prefix, so a malformed row just gets silently skipped there today — this adds the
--     matching bound at the write itself, generous enough to never bind on a real token.
--
-- Existing rows checked before writing this (both empty or compliant, no NOT VALID
-- needed): profile_languages has exactly 1 row ('en', in-list); preferences has 0 rows
-- with required_language set; push_tokens is empty.

alter table public.profile_languages
  add constraint language_code_in_catalog
  check (language_code in (
    'en','es','pt','fr','de','it','ru','ja','ko','zh','ar','hi','tr','pl','nl','sv','vi','th','id','tl'
  ));

alter table public.preferences
  add constraint required_language_in_catalog
  check (required_language is null or required_language in (
    'en','es','pt','fr','de','it','ru','ja','ko','zh','ar','hi','tr','pl','nl','sv','vi','th','id','tl'
  ));

alter table public.push_tokens
  add constraint expo_push_token_length
  check (char_length(expo_push_token) between 1 and 4096);
