-- 0041: close a live critical hole — anon could mint paid consumable credits.
--
-- `grant_consumable_credits(p_profile_id, p_boosts, p_roses)` is SECURITY DEFINER and
-- deliberately trusts its caller: it takes a profile id as an argument, never consults
-- auth.uid(), and unconditionally adds to that profile's balance. That is correct for its
-- ONE intended caller — the revenuecat-webhook Edge Function, which runs with the service
-- role after verifying RevenueCat's shared secret — and catastrophic for anyone else.
--
-- 0013 tried to lock it down with `revoke execute ... from public, authenticated`, but
-- that list omits `anon`. Revoking from the PUBLIC pseudo-role only drops the implicit
-- blanket grant; Supabase's project default privileges ALSO grant EXECUTE to `anon` and
-- `authenticated` explicitly at creation time, and an explicit grant survives a PUBLIC
-- revoke untouched. `authenticated` was named so it went away; `anon` was not, so it
-- stayed — leaving the function callable over PostgREST with nothing but the anon key
-- that ships inside the app bundle, no login required, against any profile id:
--
--   POST /rest/v1/rpc/grant_consumable_credits
--   apikey: <bundled anon key>          (no Authorization header at all)
--   {"p_profile_id": "<any uuid>", "p_boosts": 999999, "p_roses": 999999}
--
-- 0031 §2 got this right for the sibling SECURITY DEFINER helpers by naming all three
-- roles (`from public, anon, authenticated`); this function was never revisited. Verified
-- live before writing this migration: it was the only function in `public` whose proacl
-- contained an `anon=X` entry.
--
-- Grants only — the function body is deliberately left untouched. An in-body caller check
-- would be dead code here (inside SECURITY DEFINER, `current_user` is the function owner,
-- not the caller), and rewriting a function on the live payment path to add dead code is
-- risk without benefit. The grant list IS the gate.
--
-- service_role keeps EXECUTE, so the revenuecat-webhook path is unaffected.

revoke execute on function public.grant_consumable_credits(uuid, int, int)
  from public, anon, authenticated;

grant execute on function public.grant_consumable_credits(uuid, int, int) to service_role;
