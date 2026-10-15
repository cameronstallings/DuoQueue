-- 0076: "Swipes refreshed!" only for players who actually ran out, at 10:00 instead of midnight.
--
-- WHY. get_profiles_needing_swipe_refresh_notification (0053) selected every active, onboarded,
-- non-premium profile whose local hour was 0, and daily-swipes-refreshed pushed each one. It
-- never asked whether they had used any swipes. Read live on 2026-10-14: about 139 sends so
-- far, against 3 nights on which any of those players had hit the 25-swipe limit; a swipe
-- followed within 3 hours after 5% of them (32% for the new-player alert). It also landed at
-- midnight, on decks with 3 to 6 cards left. A push that is mostly noise teaches people to
-- switch pushes off, and the person-driven pushes depend on those same tokens.
--
-- NOW a player qualifies only when ALL of these hold:
--   * yesterday's daily_swipe_counters row (their LOCAL day, the same coalesce(timezone, 'utc')
--     day perform_swipe counts in) reached the free limit, 25;
--   * they have not swiped yet today (a player already swiping knows the swipes are back);
--   * their deck has at least one card: some profile passes deck_gate_hard AND
--     deck_gate_preferences for them (0062, with 0071's dormant rule), so the push never
--     points at an empty deck;
--   * local time 10:00-20:59 (local_hour_within, 0072); hourly runs mean in practice the 10:00
--     run, once per local day (the existing swipe_refresh_notifications ledger);
--   * not premium (unchanged), not demo, not banned, not suspended, onboarded, active, with a
--     push token and the daily_swipes_refreshed switch not off.
-- Expect 0 to 1 pushes a day instead of about 15.
--
-- THE SHIPPED CONTRACT. Same name, no arguments, same single column (profile_id), same ACL
-- (service_role only). daily-swipes-refreshed needs no change: it still writes the ledger
-- with the local date it computes from the same timezone, and still checks the switch. The
-- settings hint "Once a day, when your free swipes reset" stays true.
--
-- The free limit 25 is a literal in perform_swipe (0055) and here. Change both together.
--
-- Checks: supabase/checks/0076_swipe_refresh_only_when_used_up.sql.

set local lock_timeout = '5s';

create or replace function public.get_profiles_needing_swipe_refresh_notification()
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $fn$
  select p.id
  from public.profiles p
  cross join lateral (
    select (now() at time zone coalesce(p.timezone, 'utc'))::date as local_today
  ) d
  where p.is_active = true
    and p.is_admin_suspended = false
    and p.is_banned = false
    and p.is_demo = false
    and p.onboarding_completed = true
    and public.local_hour_within(p.timezone, 10, 20)
    and not public.is_premium(p.id)
    and exists (select 1 from public.push_tokens t where t.profile_id = p.id)
    and not exists (
      select 1 from public.notification_settings ns
      where ns.profile_id = p.id and ns.daily_swipes_refreshed = false
    )
    -- Ran out yesterday (local day).
    and exists (
      select 1 from public.daily_swipe_counters dsc
      where dsc.profile_id = p.id
        and dsc.day = d.local_today - 1
        and dsc.swipe_count >= 25
    )
    -- Has not swiped yet today.
    and not exists (
      select 1 from public.daily_swipe_counters dsc
      where dsc.profile_id = p.id
        and dsc.day = d.local_today
        and dsc.swipe_count > 0
    )
    -- Not already told today (the ledger daily-swipes-refreshed writes).
    and not exists (
      select 1 from public.swipe_refresh_notifications srn
      where srn.profile_id = p.id
        and srn.last_notified_day = d.local_today
    )
    -- And somebody is actually in the deck.
    and exists (
      select 1 from public.profiles c
      where c.id <> p.id
        and c.onboarding_completed = true
        and c.is_active = true
        and c.is_banned = false
        and c.is_admin_suspended = false
        and public.deck_gate_hard(p.id, c.id)
        and public.deck_gate_preferences(p.id, c.id)
    );
$fn$;

revoke execute on function public.get_profiles_needing_swipe_refresh_notification() from public, anon, authenticated;
grant execute on function public.get_profiles_needing_swipe_refresh_notification() to service_role;
