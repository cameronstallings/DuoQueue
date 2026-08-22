-- 0066: make the invite redemption rate limit real.
--
-- 0065 already applied to the live cluster (supabase_migrations.schema_migrations reads
-- 0065), so this is a new file rather than an edit to that one. Editing an applied
-- migration in place is how the repo and the database quietly stop agreeing: `supabase db
-- push` will never re-run a version it has already recorded, so the change would exist only
-- wherever somebody happened to paste it.
--
-- ============================================================================
-- WHAT WAS WRONG, AND HOW IT WAS FOUND
-- ============================================================================
--
-- 0065's redeem_invite_code says, in a comment:
--
--   "Ten wrong codes an hour is far more than a person who is retyping one, and it is what
--    turns the 50 bits in D4 into a bound an authenticated attacker also cannot get past."
--
-- That bound did not exist. Measured against the live cluster, one transaction, two halves:
--
--   check_rate_limit('probe_bucket', 10, '1 hour') called 12 times with nothing raising
--   after it       -> calls 1..10 allowed, 11 and 12 refused, 10 rows in rate_limit_hits
--
--   redeem_invite_code('GUESS0000n') called 12 times with a wrong code
--                      -> all 12 allowed, ZERO rows in rate_limit_hits
--
-- The control works. The caller was throwing its own accounting away.
-- check_rate_limit's last statement is `insert into public.rate_limit_hits`. PostgREST runs
-- each RPC in its own transaction, so when redeem_invite_code then does
-- `raise exception 'invite_not_found'`, that transaction aborts and the hit row goes with
-- it. The only path that ever committed a hit was a SUCCESSFUL redemption, and
-- invite_redemptions is primary-keyed on the invitee, so there can be at most one of those
-- per account. The counter could never reach two, let alone ten.
--
-- This is not a general flaw in check_rate_limit and no other caller has it:
-- perform_swipe, send_super_ping and get_or_create_invite_code all commit on their normal
-- path, which is the path that is being metered. It bites here because the path being
-- metered -- a wrong code -- was also the path that raised.
--
-- ============================================================================
-- THE FIX, AND WHY IT IS THIS ONE
-- ============================================================================
--
-- A wrong code now RETURNS ZERO ROWS instead of raising. The function then finishes
-- normally, check_rate_limit's insert commits, and the eleventh wrong code in an hour hits
-- `rate_limit_exceeded:redeem_invite` -- which is check_rate_limit's own raise, thrown
-- before it writes, so it correctly refuses without counting itself.
--
-- Nothing on the client changes. useInviteRedemption already reads
-- `if (error || !row) settleRedemption(null)`, so an empty result and a raised
-- invite_not_found were always the same outcome to the only caller there is. Zero rows is
-- also what resolve_invite_code has always returned for the same condition, so the two
-- functions now answer "no" the same way.
--
-- WHAT DELIBERATELY STILL RAISES. invite_window_closed and the blocked-pair case keep their
-- tokens, because neither is a guessing vector: both are only reachable after a code has
-- already resolved to a real person, so they cannot be reached by trying strings. Keeping
-- them raised keeps the reason visible in the Postgres logs for the one support question
-- this feature is likely to generate ("my friend's code says it did not work"). Their raise
-- does still discard that call's own rate-limit hit, and that is fine: you cannot spam a
-- branch you can only reach with a valid code you already hold.
--
-- WHAT THIS IS AND IS NOT WORTH. The entropy was never the problem: 50 bits of
-- gen_random_uuid() is ~35,000 years of guessing at a thousand a second, and that has not
-- changed. What was wrong was a written claim that a second bound existed. A security
-- control that silently does nothing is worse than an absent one, because it is the reason
-- nobody looks again.
create or replace function public.redeem_invite_code(p_code text)
returns table (inviter_id uuid, display_name text, connected boolean)
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_inviter uuid;
  v_name text;
  v_existing public.invite_redemptions%rowtype;
  v_created_at timestamptz;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_existing from public.invite_redemptions where invitee_id = v_me;
  if found then
    select p.display_name into v_name from public.profiles p where p.id = v_existing.inviter_id;
    inviter_id := v_existing.inviter_id;
    display_name := coalesce(v_name, 'Someone');
    connected := v_existing.connected_at is not null;
    return next;
    return;
  end if;

  -- Ten wrong codes an hour. This is now true; see the header for what it used to be.
  perform public.check_rate_limit('redeem_invite', 10, interval '1 hour');

  select r.inviter_id, r.display_name into v_inviter, v_name
  from public.resolve_invite_code(p_code) r;

  -- Zero rows, not a raise. Returning normally is what lets the check_rate_limit hit above
  -- survive the call, which is the entire point of this migration. Self-redemption answers
  -- the same way as an unknown code, so a code cannot be used to confirm whose it is.
  if v_inviter is null or v_inviter = v_me then
    return;
  end if;

  -- D3: the 14 day window, anchored on the account, not on the code.
  select p.created_at into v_created_at from public.profiles p where p.id = v_me;
  if v_created_at is null or v_created_at < now() - interval '14 days' then
    raise exception 'invite_window_closed'
      using hint = 'Invite codes only work on a new account.';
  end if;

  -- A block either direction means these two have already decided. Same empty answer as a
  -- bad code, so redeeming cannot be used to detect that somebody blocked you.
  if public.is_blocked_pair(v_me, v_inviter) then
    raise exception 'invite_not_found'
      using hint = 'That invite code did not work. Check it and try again.';
  end if;

  insert into public.invite_redemptions (invitee_id, inviter_id, code)
  values (v_me, v_inviter, public.normalize_invite_code(p_code))
  on conflict (invitee_id) do nothing;

  inviter_id := v_inviter;
  display_name := v_name;
  connected := false;
  return next;
end;
$fn$;

revoke execute on function public.redeem_invite_code(text) from public, anon;
grant execute on function public.redeem_invite_code(text) to authenticated;
