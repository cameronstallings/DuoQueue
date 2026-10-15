-- 0077: a proposed time that has passed can no longer be confirmed, and stops showing.
--
-- WHY. respond_session (0023) checks only status = 'pending', and nothing ever expires a
-- proposal, so the chat's session banner shows "Proposed: Sat, Oct 10, 7:00 PM" with Confirm
-- and Decline for as long as the row exists. Read live on 2026-10-14: the 5 Oct proposal for
-- 10 Oct 19:00 Chicago is still pending and can still be confirmed, four days after the time.
-- The shipped 1.0.1 banner (useActiveMatchSession) has no time filter, so the server has to
-- make the row stop being pending.
--
-- ONE THRESHOLD, 30 MINUTES, FOR BOTH HALVES. The plan said "reject anything in the past" for
-- respond_session and "cancel after 2 hours" for the sweep, which would leave a window in which
-- the banner shows a Confirm button that always fails. So both use the same line:
--   * respond_session does not CONFIRM a proposal whose time is more than 30 minutes gone. It
--     cancels it and returns the cancelled row, WITHOUT raising. Declining is always allowed
--     (it is a harmless way to clear the banner). 30 minutes of grace because "7:00, sure" at
--     7:05 is a real answer.
--
--     Why not raise. The first draft raised 'session_time_passed' with a hint. On the shipped
--     1.0.1 client that is a dead end: SessionBanner's onError shows "Something went wrong /
--     Please try again." (PostgREST hands back a plain object, not an Error, so the hint never
--     shows), invalidates nothing, and the banner's query (useActiveMatchSession) is never
--     refetched while the chat stays open, so every retry gives the same alert and the Confirm
--     button never goes away. A SUCCESSFUL call is the one thing 1.0.1 reacts to: its onSuccess
--     invalidates ["match-sessions", matchId], the re-read selects pending and confirmed only,
--     and the cancelled row drops out of the banner.
--
--     The same reasoning covers a proposal that is NO LONGER PENDING when the answer arrives
--     (the sweep below cancelled it, the proposer cancelled it, or it was already answered on a
--     double tap): respond_session returns the row as it now is instead of raising 'No pending
--     proposal to respond to', so the open chat refreshes to the truth. Nothing is written in
--     that case. A row that is not this caller's to answer (not in their match, or their own
--     proposal) still raises, exactly as before.
--
--     For a build that wants to SAY why (1.0.2): compare the returned row's status with what was
--     asked. Asked to confirm and got back 'cancelled' means "That time has passed. Pick a new
--     one."; any other status means somebody else changed it first.
--   * expire_stale_session_proposals() marks pending proposals whose time is more than 30
--     minutes gone as 'cancelled', every 15 minutes, and once now (on 2026-10-14 that is the
--     single 10 Oct proposal). 'cancelled' rather than a new status: the 1.0.1 banner selects
--     pending and confirmed only, so a cancelled row simply drops out, and adding an enum value
--     would be a change the shipped client cannot read.
--
-- Confirmed sessions are left alone here. "Playing ..." for a past confirmed session is the
-- client's to hide (the OTA filter on scheduled_at); the server has no "played" state to move
-- them to, and inventing one is out of scope.
--
-- respond_session is rebuilt from its live definition: same signature, same RETURNS
-- (match_sessions), same ACL (`create or replace` keeps it). The two changes above, nothing else.
--
-- Kill switch: select cron.unschedule('session-proposals-expire-15min');
-- Minutes 7, 22, 37 and 52 are used by nothing else on cron.job (2026-10-14).
--
-- Checks: supabase/checks/0077_session_proposals_expire.sql.

set local lock_timeout = '5s';

create or replace function public.respond_session(p_session_id uuid, p_accept boolean)
returns public.match_sessions
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_row public.match_sessions;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select ms.* into v_row
  from public.match_sessions ms
  join public.matches m on m.id = ms.match_id
  where ms.id = p_session_id
    and ms.proposed_by <> v_me
    and (m.user_a_id = v_me or m.user_b_id = v_me);

  if v_row.id is null then
    raise exception 'No pending proposal to respond to';
  end if;

  -- 0077: no longer pending (expired by the sweep, cancelled by the proposer, already
  -- answered). Return it as it is, so the shipped client's onSuccess re-reads the banner.
  if v_row.status <> 'pending' then
    return v_row;
  end if;

  -- 0077: a time more than 30 minutes gone is not confirmed; it is cancelled, as the sweep
  -- would, and returned. Declining still works.
  if p_accept and v_row.scheduled_at < now() - interval '30 minutes' then
    update public.match_sessions
       set status = 'cancelled'::match_session_status_enum
     where id = p_session_id
       and status = 'pending'
    returning * into v_row;
    if v_row.id is null then
      select ms.* into v_row from public.match_sessions ms where ms.id = p_session_id;
    end if;
    return v_row;
  end if;

  update public.match_sessions
  set status = case when p_accept then 'confirmed'::match_session_status_enum else 'declined'::match_session_status_enum end
  where id = p_session_id
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.expire_stale_session_proposals()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  update public.match_sessions
     set status = 'cancelled'
   where status = 'pending'
     and scheduled_at < now() - interval '30 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke execute on function public.expire_stale_session_proposals() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'session-proposals-expire-15min') then
    perform cron.unschedule('session-proposals-expire-15min');
  end if;
end;
$$;

select cron.schedule(
  'session-proposals-expire-15min',
  '7,22,37,52 * * * *',
  $$select public.expire_stale_session_proposals()$$
);

select public.expire_stale_session_proposals();
