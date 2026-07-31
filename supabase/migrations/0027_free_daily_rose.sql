-- Everyone (not just people who've bought Roses) gets one free Legendary Like every
-- 24 hours, on a rolling window from their last use — not a calendar-day reset like
-- Super Ping. Purchased rose credits still exist as a way to send *extra* ones beyond
-- the free daily one, checked only once the free one is on cooldown.

alter table public.consumable_credits add column last_free_rose_at timestamptz;

-- Both functions change their RETURNS TABLE column set, which create-or-replace
-- can't do — drop and recreate instead (grants are re-issued below).
drop function if exists public.get_consumable_credits();
drop function if exists public.send_rose(uuid);

create or replace function public.get_consumable_credits()
returns table (boosts int, roses int, free_rose_available boolean, free_rose_available_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(cc.boosts, 0),
    coalesce(cc.roses, 0),
    cc.last_free_rose_at is null or now() - cc.last_free_rose_at >= interval '24 hours',
    case
      when cc.last_free_rose_at is null or now() - cc.last_free_rose_at >= interval '24 hours' then null
      else cc.last_free_rose_at + interval '24 hours'
    end
  from (select auth.uid() as me) me
  left join public.consumable_credits cc on cc.profile_id = me.me;
$$;

grant execute on function public.get_consumable_credits() to authenticated;

create or replace function public.send_rose(p_target_id uuid)
returns table (matched boolean, match_id uuid, used_free_rose boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_roses int;
  v_last_free_rose_at timestamptz;
  v_free_available boolean;
  v_swipe_result record;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.consumable_credits (profile_id) values (v_me)
  on conflict (profile_id) do nothing;

  select roses, last_free_rose_at into v_roses, v_last_free_rose_at
  from public.consumable_credits
  where profile_id = v_me
  for update;

  v_free_available := v_last_free_rose_at is null or now() - v_last_free_rose_at >= interval '24 hours';

  if v_free_available then
    update public.consumable_credits set last_free_rose_at = now(), updated_at = now() where profile_id = v_me;
    used_free_rose := true;
  elsif coalesce(v_roses, 0) > 0 then
    update public.consumable_credits set roses = roses - 1, updated_at = now() where profile_id = v_me;
    used_free_rose := false;
  else
    raise exception 'rose_on_cooldown';
  end if;

  select * into v_swipe_result from public.perform_swipe(p_target_id, 'like');
  matched := v_swipe_result.matched;
  match_id := v_swipe_result.match_id;
  return next;
end;
$$;

grant execute on function public.send_rose(uuid) to authenticated;
